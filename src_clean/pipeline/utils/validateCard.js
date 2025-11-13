// utils/validateCard.js
// Validation helpers for generated ethnobotanical cards.

/**
 * Required keys for a valid card.
 * @type {string[]}
 */
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

/**
 * Checks if an object has ru/en text fields.
 * @param {object} v
 * @returns {boolean}
 */
function hasRuEn(v) {
  return (
    v &&
    typeof v === "object" &&
    typeof v.ru === "string" &&
    typeof v.en === "string"
  );
}

/**
 * Validates that a card has the required structure.
 * @param {object} card
 * @returns {{ok: boolean, reason: string}}
 */
export function validateCardShape(card) {
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
