import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { info, warn, error, debug } from "./utils/logger.js";
import { safeParseJsonObject } from "./utils/json-parse.js";
import { readJsonSafe } from "./utils/fs-json.js";
import { validateCardShape } from "./utils/validateCard.js";
import { normalizeImageResult } from "./utils/normalizeImage.js";
import {
  norm,
  normalizeLatin,
  latinToFirestoreId,
  plantIdFromLatin,
} from "./utils/latin.js";

import {
  saveCardToFirestore,
  pickAndLockCandidates,
  markCandidateHasCard,
  unlockCandidate,
} from "./services/firestore.js";
import { loadFn, loadOptionalFn } from "./utils/loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("[DEBUG] __dirname =", __dirname);
console.log("[DEBUG] steps exists:", await fs.readdir(__dirname));

/* ─────────────────────────────────────────
   Paths / Config
────────────────────────────────────────── */
const PROMPT_PATH = path.join(
  __dirname,
  "prompts/master_prompt_enriched_safe.md"
);
const VOCAB_PATH = path.join(__dirname, "config/effects_vocab.json");

const STEPS_DIR = path.join(__dirname, "steps");

const SCHEMA_PATH = path.join(__dirname, "schema/card.schema.json");
const ALLOWLIST_PATH = path.join(__dirname, "config/domains.allowlist.json");

const SOURCES_LIMIT = Number(process.env.SOURCES_LIMIT || 5);
const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const FORCE_CANDIDATES = process.env.FORCE_CANDIDATES === "1";

/* ─────────────────────────────────────────
   Steps
────────────────────────────────────────── */
const fetchSources = await loadFn(path.join(STEPS_DIR, "02_fetchSources.js"), [
  "fetchSources",
]);
const enrichNarrative = await loadFn(
  path.join(STEPS_DIR, "03_enrichNarrative.js"),
  ["enrichNarrative"]
);
const extractEffects = await loadFn(
  path.join(STEPS_DIR, "04_extractEffects.js"),
  ["extractEffects"]
);
const pickImage = await loadFn(path.join(STEPS_DIR, "05_pickImage.js"), [
  "pickImage",
]);
const addAffiliate = await loadOptionalFn(
  path.join(STEPS_DIR, "06_affiliate.js"),
  ["addAffiliate"],
  async ({ card }) => card
);
const qualityGate = await loadOptionalFn(
  path.join(STEPS_DIR, "08_qualityGate.js"),
  ["qualityGate"],
  () => ({ pass: true })
);

if (!fetchSources || !enrichNarrative || !extractEffects || !pickImage) {
  throw new Error(
    "[orchestrator] Required step export not found (02/03/04/05)."
  );
}

/* ─────────────────────────────────────────
   Core per-plant run
────────────────────────────────────────── */
async function runOne(latin) {
  const L = norm(latin);
  info(`→ running index.js for ${L}`);
  debug("latin", "raw:", JSON.stringify(latin));
  debug("latin", "normalized:", JSON.stringify(L));

  const sources = await fetchSources(L, {
    maxItems: SOURCES_LIMIT,
    dryRun: DRY,
  }).catch(() => []);
  let resRaw;
  try {
    resRaw = await enrichNarrative({
      latin: L,
      sources,
      promptPath: PROMPT_PATH,
      effectsVocabPath: VOCAB_PATH,
      dryRun: DRY,
    });
  } catch (e) {
    error("[03_enrichNarrative] threw:", e?.message || e);
    return null;
  }

  let res;
  try {
    if (
      resRaw &&
      typeof resRaw === "object" &&
      typeof resRaw.json === "string"
    ) {
      res = safeParseJsonObject(resRaw.json);
    } else if (typeof resRaw === "string") {
      res = safeParseJsonObject(resRaw);
    } else if (resRaw && typeof resRaw === "object") {
      // enrichNarrative returned object directly
      res = resRaw;
    } else {
      res = null;
    }
  } catch (e) {
    error(`[03_enrichNarrative] parse error for ${L}:`, e?.message || e);
    res = null;
  }

  if (!res) {
    warn(`[03_enrichNarrative] no valid JSON/object for ${L} — skipping`);
    return null;
  }

  const v = validateCardShape(res);
  if (!v.ok) {
    warn(`[enrichNarrative] invalid shape for ${L} — ${v.reason} — skipping`);
    return null;
  }

  const effects = await extractEffects({
    narrative: res,
    detailed: true,
    dryRun: DRY,
  });

  const card = {
    latin: L,
    title: res.title,
    summary: res.summary,
    ethnobotany: res.ethnobotany,
    modern_evidence: res.modern_evidence,
    interesting_fact: res.interesting_fact,
    context: res.context,
    safety: res.safety,
    effects: Array.isArray(effects?.effects) ? effects.effects : [],
    sources,
  };

  // image
  debug("image", "pickImage input:", L);
  const imgRes = await pickImage(L);
  debug("image", "pickImage output:", JSON.stringify(imgRes, null, 2));

  const normalizedImage = normalizeImageResult(imgRes);
  if (normalizedImage) card.image = normalizedImage;

  // legacy cleanup on flat fields
  delete card.url;
  delete card.credit;
  delete card.license;

  info("[image]", {
    hasImage: !!card.image?.url,
    url: card.image?.url || null,
  });

  const affRes = await addAffiliate({ card, dryRun: DRY });
  if (affRes?.affiliate) card.affiliate = affRes.affiliate;

  // Quality gate
  const effectsVocab = await readJsonSafe(VOCAB_PATH, {});
  const allowlistArr = await readJsonSafe(ALLOWLIST_PATH, []);
  const gateRes = await qualityGate(card, {
    schemaPath: SCHEMA_PATH,
    allowlist: Array.isArray(allowlistArr) ? allowlistArr : [],
    effectsVocab: effectsVocab || {},
  });
  const pass = gateRes?.ok === true || gateRes?.pass !== false;
  if (!pass) {
    warn("[qualityGate] FAIL", gateRes);
    return null;
  }

  const finalDoc = {
    latin: L,
    plant_id: plantIdFromLatin(L),
    status: "ready",
    cooldownDays: 7,
    disabled: false,
    postedCount: 0,
    lastPostedAt: null,
    payload: { ...card, image: card.image || null }, // ensure image inside payload
  };

  const saveRes = await saveCardToFirestore({
    id: latinToFirestoreId(L),
    data: finalDoc,
  });
  if (!saveRes.ok) {
    warn("[firestore] skip:", saveRes.reason);
  }
  info("[verify] saved payload image:", {
    latin: L,
    hasImage: !!finalDoc.payload?.image?.url,
    url: finalDoc.payload?.image?.url || null,
  });

  return finalDoc;
}

/* ─────────────────────────────────────────
   Main
────────────────────────────────────────── */
async function main() {
  // make envLatins mutable to clear when FORCE_CANDIDATES
  let envLatins = (process.env.LATINS || "").trim();
  if (FORCE_CANDIDATES) {
    info("[diag] FORCE_CANDIDATES=1 → ignoring ENV LATINS");
    process.env.LATINS = "";
    envLatins = ""; // critical: otherwise stale ENV was forcing mode=ENV
  }

  let latins = [];
  let candidateMap = new Map();

  if (envLatins) {
    latins = envLatins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    info(`[diag] mode=ENV latins size=${latins.length}`);
  } else {
    const limit = Math.max(1, Number(process.env.CANDIDATES_LIMIT || 1));
    const picked = await pickAndLockCandidates(limit);
    latins = picked.map((p) => p.latin).filter(Boolean);
    candidateMap = new Map(picked.map((p) => [normalizeLatin(p.latin), p.id]));
    info(`[diag] mode=CANDIDATES picked=${picked.length}`);
  }

  const ready = [];
  for (const latin of latins) {
    try {
      const card = await runOne(latin);
      const candId = candidateMap.get(normalizeLatin(latin));
      const slug = latinToFirestoreId(latin);
      if (card) {
        if (candId) {
          await markCandidateHasCard(candId, slug);
          info(
            `[candidates] ${latin} → hasCard (id=${candId}, ref=cards/${slug})`
          );
        }
        ready.push(card);
      } else if (candId) {
        await unlockCandidate(candId);
      }
    } catch (e) {
      error(`[orchestrator] ERROR for ${latin}:`, e?.message || e);
      const candId = candidateMap.get(normalizeLatin(latin));
      if (candId) await unlockCandidate(candId);
    }
  }

  info(`[orchestrator] ready count = ${ready.length}`);
}

main().catch((e) => {
  error("[orchestrator] FATAL:", e?.stack || e);
  process.exit(1);
});
