// src_clean/pipeline/utils/json-parse.js
// Safe JSON parsing helpers to avoid try/catch noise across the code.

/**
 * Parses a JSON string and ensures the result is a plain object.
 * Returns null if parse fails or result is not an object.
 * @param {string} text
 * @returns {Record<string, any> | null}
 */
export function safeParseJsonObject(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const val = JSON.parse(text);
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely convert any object to a pretty JSON string.
 * Used for prompt templates and debugging.
 */
export function toJSONString(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    throw new Error(`Cannot stringify object: ${e.message}`);
  }
}
