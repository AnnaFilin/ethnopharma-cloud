// ethno-pipeline-v2/steps/04_extractEffects.js
// Offline fallback: extract effect IDs from narrative w/out LLM.
// Safe string handling (no (x || "").trim()) + minimal diagnostics.

import fs from "fs";

/** Safe to-string + trim */
const toStr = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const t = (v) => toStr(v).trim();

/** Load effects vocab once; returns Map<normalizedName, id> */
function loadVocab(vocabPath) {
  try {
    const raw = JSON.parse(fs.readFileSync(vocabPath, "utf8"));
    // raw may be { id: { en, ru } } or array; support both
    const map = new Map();
    if (Array.isArray(raw)) {
      for (const it of raw) {
        const id = toStr(it?.id);
        const en = toStr(it?.en || it?.name_en);
        const ru = toStr(it?.ru || it?.name_ru);
        if (id) {
          if (en) map.set(en.toLowerCase(), id);
          if (ru) map.set(ru.toLowerCase(), id);
        }
      }
    } else if (raw && typeof raw === "object") {
      for (const [id, val] of Object.entries(raw)) {
        const en = toStr(val?.en);
        const ru = toStr(val?.ru);
        if (en) map.set(en.toLowerCase(), id);
        if (ru) map.set(ru.toLowerCase(), id);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Very simple rule-base: scan narrative text for known effect names */
function scanEffects(narrative, vocabMap, limit = 5) {
  const bucket = new Set();

  // Collect all candidate text fields we might scan
  const sources = [
    t(narrative?.summary?.en),
    t(narrative?.summary?.ru),
    t(narrative?.ethnobotany),
    t(narrative?.modern_evidence),
    t(narrative?.context),
    t(narrative?.safety),
    t(narrative?.interesting_fact),
  ].filter(Boolean);

  const text = sources.join("\n").toLowerCase();
  for (const name of vocabMap.keys()) {
    if (text.includes(name)) {
      bucket.add(vocabMap.get(name));
      if (bucket.size >= limit) break;
    }
  }
  return Array.from(bucket);
}

/**
 * @param {object} opts
 * @param {object} opts.narrative - object returned by step 03
 * @param {string} [opts.effectsVocabPath] - path to vocab json (optional if step03 already fused IDs)
 * @param {boolean} [opts.detailed=false]
 * @param {boolean} [opts.dryRun=true]
 */
export async function extractEffects({
  narrative,
  effectsVocabPath = "./config/effects_vocab.json",

  detailed = false,
  dryRun = true,
} = {}) {
  console.log(
    "[04_extractEffects] start, detailed:",
    !!detailed,
    "dryRun:",
    !!dryRun
  );

  // If step03 already has IDs, just pass them through
  if (Array.isArray(narrative?.effects) && narrative.effects.length > 0) {
    console.log(
      "[04_extractEffects] narrative.effects present:",
      narrative.effects.length
    );
    return { effects: narrative.effects };
  }

  const vocabMap = loadVocab(effectsVocabPath);
  console.log("[04_extractEffects] vocab keys:", vocabMap.size);

  const effects = scanEffects(narrative, vocabMap, 5);
  console.log("[04_extractEffects] extracted effects:", effects.length);

  return detailed ? { effects, method: "rule-base" } : { effects };
}

export default extractEffects;
