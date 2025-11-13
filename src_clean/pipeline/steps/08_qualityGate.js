// ethno-pipeline-v2/steps/08_qualityGate.js
// Business rules beyond JSON Schema: allowlist & vocab checks, no HTML, etc.
// Safe string handling + concise diagnostics.

import fs from "fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { stripHtml } from "../tools/htmlStrip.js";

const toStr = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const t = (v) => toStr(v).trim();

function inAllowlist(url, allow) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return allow.has(host);
  } catch {
    return false;
  }
}

/**
 * @param {object} card
 * @param {object} cfg
 * @param {string} cfg.schemaPath
 * @param {string[]} cfg.allowlist
 * @param {Record<string, any>} cfg.effectsVocab
 */
export function qualityGate(card, { schemaPath, allowlist, effectsVocab }) {
  console.log("[08_qualityGate] start");

  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  // 6 sections with ru/en text
  const sections = [
    "title",
    "summary",
    "ethnobotany",
    "modern_evidence",
    "interesting_fact",
    "context",
    "safety",
  ];
  for (const sec of sections) {
    if (!card[sec]) return { ok: false, reason: `missing ${sec}` };
    for (const k of ["ru", "en"]) {
      const before = toStr(card[sec][k]);
      const after = stripHtml(before);
      if (!t(after)) return { ok: false, reason: `empty ${sec}.${k}` };
      if (after !== before)
        return { ok: false, reason: `html_detected ${sec}.${k}` };
    }
  }

  // Sources
  if (!Array.isArray(card.sources) || card.sources.length < 2) {
    return { ok: false, reason: "sources.count" };
  }
  const allow = new Set(allowlist);
  for (const s of card.sources) {
    if (!inAllowlist(s.url, allow))
      return { ok: false, reason: "sources.allowlist" };
  }

  // Effects
  const vocab = new Set(Object.keys(effectsVocab || {}));
  if (!Array.isArray(card.effects) || card.effects.length === 0) {
    return { ok: false, reason: "effects.empty" };
  }
  for (const e of card.effects) {
    if (!vocab.has(e)) return { ok: false, reason: `effects.unknown:${e}` };
  }

  // Clone + schema
  const clone = JSON.parse(JSON.stringify(card));
  clone.category = clone.category || "plant";
  clone.status = "ready";

  const valid = validate(clone);
  if (!valid) return { ok: false, reason: "schema", errors: validate.errors };

  return { ok: true };
}

export default qualityGate;
