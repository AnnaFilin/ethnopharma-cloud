import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { info, warn, error, debug } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Paths / Config ----------
const PROMPT_PATH = path.join(
  __dirname,
  "prompts/master_prompt_enriched_safe.md"
);
const VOCAB_PATH = path.join(__dirname, "config/effects_vocab.json");
const STAGING_PATH = path.join(
  process.env.STAGING_DIR || "/tmp",
  "cards_ready.json"
); // Cloud Run: writable only /tmp
const STEPS_DIR = path.join(__dirname, "steps");
const SCHEMA_PATH = path.join(__dirname, "schema/card.schema.json");
const ALLOWLIST_PATH = path.join(__dirname, "config/domains.allowlist.json");

// const DEFAULT_LATINS = ["Withania somnifera", "Rhodiola rosea"];
const SOURCES_LIMIT = Number(process.env.SOURCES_LIMIT || 5);
const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const WRITE_TO_FIRESTORE =
  String(process.env.WRITE_TO_FIRESTORE || "1") !== "0";
const FORCE_CANDIDATES = process.env.FORCE_CANDIDATES === "1";

// ---------- Validation helpers ----------
const REQUIRED_CARD_KEYS = [
  "title",
  "summary",
  "ethnobotany",
  "modern_evidence",
  "interesting_fact",
  "context",
  "safety",
  "effects",
];

function hasRuEn(v) {
  return (
    v &&
    typeof v === "object" &&
    typeof v.ru === "string" &&
    typeof v.en === "string"
  );
}

function validateCardShape(card) {
  if (!card || typeof card !== "object")
    return { ok: false, reason: "not-an-object" };
  if (card.error) return { ok: false, reason: `llm-error:${card.error}` };

  for (const k of REQUIRED_CARD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(card, k)) {
      return { ok: false, reason: `missing-key:${k}` };
    }
  }
  const ruEnFields = [
    "title",
    "summary",
    "ethnobotany",
    "modern_evidence",
    "interesting_fact",
    "context",
    "safety",
  ];
  for (const f of ruEnFields) {
    if (!hasRuEn(card[f])) return { ok: false, reason: `bad-ru-en:${f}` };
  }
  if (!Array.isArray(card.effects))
    return { ok: false, reason: "effects-not-array" };
  return { ok: true, reason: "ok" };
}

// ---------- Firestore (lazy) ----------
let _cardsCol = null;
async function getCardsCol() {
  if (_cardsCol) return _cardsCol;
  const { Firestore } = await import("@google-cloud/firestore");
  const db = new Firestore();
  _cardsCol = db.collection("cards");
  return _cardsCol;
}

function latinToFirestoreId(latin) {
  return norm(latin).replace(/\s+/g, "-").toLowerCase();
}

const plantIdFromLatin = (latin) =>
  `plant_${norm(latin).replace(/\s+/g, "_").toLowerCase()}`;

async function saveCardToFirestore(input) {
  if (!WRITE_TO_FIRESTORE) return { ok: false, reason: "WRITE_TO_FIRESTORE=0" };

  let id, data;
  if (input && input.id && input.data) {
    ({ id, data } = input);
  } else {
    const card = input || {};
    const latin = card.latin || card?.payload?.latin;
    if (!latin) return { ok: false, reason: "no-latin" };
    id = latinToFirestoreId(latin);
    data = card;
  }

  try {
    const col = await getCardsCol();
    await col.doc(id).set(data, { merge: true });
    console.log(`[firestore] upsert cards/${id}`);
    return { ok: true, id };
  } catch (e) {
    console.error("[firestore] write failed:", e?.message || e);
    return { ok: false, reason: e?.message || "unknown" };
  }
}

// ---------- JSON helpers ----------
async function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function safeParseJsonObject(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  let text = String(raw).trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  try {
    const obj = JSON.parse(text);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

async function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

const norm = (s) => (typeof s === "string" ? s.trim() : "");

function normalizeLatin(s) {
  return (typeof s === "string" ? s : "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function getExistingLatinSet(filePath) {
  const arr = await readJsonSafe(filePath, []);
  const set = new Set();
  if (Array.isArray(arr)) {
    for (const it of arr) {
      const lat = normalizeLatin(it?.latin || it?.title?.en || "");
      if (lat) set.add(lat);
    }
  }
  return set;
}

// ---------- Prompt sanitizer ----------
async function sanitizePromptFile(srcPath) {
  try {
    const raw = await fs.readFile(srcPath, "utf8");
    const cleaned = raw
      .replace(
        /#\s*GUARDED INPUT[\s\S]*?(?=^TASK|^LANGUAGE|^OUTPUT SCHEMA|$)/gim,
        ""
      )
      .replace(
        /STRICT IDENTITY RULE[\s\S]*?(?=^STYLE|^LANGUAGE|^OUTPUT SCHEMA|^TASK|$)/gim,
        ""
      )
      .replace(/PLANT_LATIN\s*=.*$/gim, "")
      .replace(/ACCEPTABLE_SYNONYMS\s*=.*$/gim, "")
      .replace(/PLANT_MISMATCH/gi, "");
    const relaxedPath = srcPath.replace(/\.md$/i, ".relaxed.md");
    await fs.writeFile(relaxedPath, cleaned, "utf8");
    return relaxedPath;
  } catch (e) {
    console.warn("[prompt] sanitize failed, using original:", e?.message);
    return srcPath;
  }
}

// ---------- Dynamic loaders ----------
async function loadFn(absFilePath, candidateNames = [], fallback = null) {
  const href = pathToFileURL(absFilePath).href;
  try {
    const mod = await import(href);
    const cand = [...candidateNames, "default"];
    for (const name of cand) {
      const fn = mod[name];
      if (typeof fn === "function") return fn;
    }
  } catch (e) {
    console.warn(`[loader] Failed to import ${absFilePath}:`, e?.message);
  }
  return fallback;
}

async function loadOptionalFn(abs, names = [], fallback = (x) => x) {
  const fn = await loadFn(abs, names, null);
  return fn || fallback;
}

// ---------- Steps ----------
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

// ---------- Core per-plant run ----------
async function runOne(latin) {
  const L = norm(latin);
  console.log(`→ running index.js for ${L}`);
  console.log("[debug latin raw]", JSON.stringify(latin));
  console.log("[debug normalized]", JSON.stringify(L));

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
    console.error("[03_enrichNarrative] threw:", e?.message || e);
    return null;
  }

  const res =
    resRaw && resRaw.json
      ? safeParseJsonObject(resRaw.json)
      : safeParseJsonObject(resRaw);
  if (!res) return null;

  const v = validateCardShape(res);
  if (!v.ok) {
    console.warn(
      `[enrichNarrative] invalid shape for ${L} — ${v.reason} — skipping`
    );
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

  // --- image: support old & new shapes; normalize to {url, credit, license, source, status}
  console.log("[debug pickImage input]", L);

  // --- image (локальная рабочая логика)
  const imgRes = await pickImage(L);
  console.log("[debug pickImage output]", JSON.stringify(imgRes, null, 2));

  let withImg = { ...card };
  if (imgRes && typeof imgRes === "object") {
    if (imgRes.image && typeof imgRes.image === "object" && imgRes.image.url) {
      const { url, credit = "", license = "", source } = imgRes.image;
      const status = imgRes.image.status || imgRes.status || (url ? "ok" : "");
      withImg.image = { url, credit, license, source, status };
    } else if (imgRes.url || imgRes.credit || imgRes.license) {
      const { url, credit = "", license = "" } = imgRes;
      const status = imgRes.status || (url ? "ok" : "");
      withImg.image = { url, credit, license, status };
    } else if (Array.isArray(imgRes.images) && imgRes.images.length > 0) {
      const first =
        imgRes.images.find((x) => x && (x.url || x.imageUrl)) ||
        imgRes.images[0];
      if (first) {
        const url = first.url || first.imageUrl || "";
        const status = first.status || "ok";
        if (url) {
          withImg.image = {
            url,
            credit: first.credit || "",
            license: first.license || "",
            source: first.source || "",
            status,
          };
        }
      }
    }
  }
  // Чистим возможные плоские поля, но уже у card:
  delete card.url;
  delete card.credit;
  delete card.license;

  // Главное: переносим картинку в card, чтобы остальной код ниже НЕ менять
  if (withImg.image) card.image = withImg.image;

  console.log("[image]", {
    hasImage: !!card.image?.url,
    url: card.image?.url || null,
  });

  const affRes = await addAffiliate({ card, dryRun: DRY });
  if (affRes?.affiliate) card.affiliate = affRes.affiliate;

  // --- Quality gate: возвращаем использование SCHEMA_PATH, ALLOWLIST_PATH, VOCAB_PATH
  const effectsVocab = await readJsonSafe(VOCAB_PATH, {});
  const allowlistArr = await readJsonSafe(ALLOWLIST_PATH, []);
  const gateRes = await qualityGate(card, {
    schemaPath: SCHEMA_PATH,
    allowlist: Array.isArray(allowlistArr) ? allowlistArr : [],
    effectsVocab: effectsVocab || {},
  });
  const pass = gateRes?.ok === true || gateRes?.pass !== false;
  if (!pass) {
    console.warn("[qualityGate] FAIL", gateRes);
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
    // гарантируем image в payload
    payload: { ...card, image: card.image || null },
  };

  const saveRes = await saveCardToFirestore({
    id: latinToFirestoreId(L),
    data: finalDoc,
  });
  if (!saveRes.ok) {
    console.warn("[firestore] skip:", saveRes.reason);
  }
  console.log("[verify] saved payload image:", {
    latin: L,
    hasImage: !!finalDoc.payload?.image?.url,
    url: finalDoc.payload?.image?.url || null,
  });

  return finalDoc;
}

// ---------- Candidates (Firestore) ----------
let _dbForCandidates = null,
  _FV = null;
async function getCandidatesCol() {
  if (_dbForCandidates)
    return { col: _dbForCandidates.collection("candidates"), FV: _FV };
  const mod = await import("@google-cloud/firestore");
  _dbForCandidates = new mod.Firestore();
  _FV = mod.FieldValue;
  return { col: _dbForCandidates.collection("candidates"), FV: _FV };
}

/** Pick up to N candidates and lock them */
async function pickAndLockCandidates(limit = 1) {
  const { col, FV } = await getCandidatesCol();
  const snap = await col
    .where("status", "==", "new")
    .limit(limit * 3)
    .get();
  const picked = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (d.lockedAt) continue;
    await doc.ref.set({ lockedAt: FV.serverTimestamp() }, { merge: true });
    picked.push({ id: doc.id, latin: d.latin });
    if (picked.length >= limit) break;
  }
  return picked;
}

/** Mark candidate as finished (status → hasCard) */
async function markCandidateHasCard(id, cardSlug) {
  const { col, FV } = await getCandidatesCol();
  await col.doc(id).set(
    {
      status: "hasCard",
      cardRef: `cards/${cardSlug}`,
      updatedAt: FV.serverTimestamp(),
      lockedAt: FV.delete(),
    },
    { merge: true }
  );
}

/** Unlock candidate on failure */
async function unlockCandidate(id) {
  const { col, FV } = await getCandidatesCol();
  await col.doc(id).set(
    {
      lockedAt: FV.delete(),
      updatedAt: FV.serverTimestamp(),
    },
    { merge: true }
  );
}

// ---------- Main ----------
async function main() {
  // ВАЖНО: делаем envLatins изменяемым, чтобы обнулить при FORCE_CANDIDATES
  let envLatins = (process.env.LATINS || "").trim();
  if (FORCE_CANDIDATES) {
    console.log("[diag] FORCE_CANDIDATES=1 → ignoring ENV LATINS");
    process.env.LATINS = "";
    envLatins = ""; // ← критично: иначе оставался бы старый текст и шёл mode=ENV
  }

  let latins = [];
  let candidateMap = new Map();

  if (envLatins) {
    latins = envLatins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    console.log(`[diag] mode=ENV latins size=${latins.length}`);
  } else {
    const limit = Math.max(1, Number(process.env.CANDIDATES_LIMIT || 1));
    const picked = await pickAndLockCandidates(limit);
    latins = picked.map((p) => p.latin).filter(Boolean);
    candidateMap = new Map(picked.map((p) => [normalizeLatin(p.latin), p.id]));
    console.log(`[diag] mode=CANDIDATES picked=${picked.length}`);
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
          console.log(
            `[candidates] ${latin} → hasCard (id=${candId}, ref=cards/${slug})`
          );
        }
        ready.push(card);
      } else if (candId) {
        await unlockCandidate(candId);
      }
    } catch (e) {
      console.error(`[orchestrator] ERROR for ${latin}:`, e?.message || e);
      const candId = candidateMap.get(normalizeLatin(latin));
      if (candId) await unlockCandidate(candId);
    }
  }

  console.log(`[orchestrator] ready count = ${ready.length}`);
}

main().catch((e) => {
  console.error("[orchestrator] FATAL:", e?.stack || e);
  process.exit(1);
});
