// src_clean/utils/normalize.js
// Utility to normalize any input into a clean string form.

/**
 * Normalize any input to a safe string.
 * Accepts either a plain string or an object containing
 * common query keys such as { latin, query, q }.
 */
export function normalizeInput(input) {
  if (typeof input === "string") return input.trim();

  if (input && typeof input === "object") {
    const keys = ["latin", "query", "q"];
    for (const k of keys) {
      const v = input[k];
      if (typeof v === "string") return v.trim();
    }
  }

  return "";
}
