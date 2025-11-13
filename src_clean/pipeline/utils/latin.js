// utils/latin.js
// Helpers for Latin plant name normalization and ID conversion.

/**
 * Trims whitespace from a string safely.
 * @param {string} s
 * @returns {string}
 */
export function norm(s) {
  return typeof s === "string" ? s.trim() : "";
}

/**
 * Normalizes a Latin name: lowercase and single-space.
 * @param {string} s
 * @returns {string}
 */
export function normalizeLatin(s) {
  return (typeof s === "string" ? s : "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts a Latin name into a Firestore-safe document ID.
 * @param {string} latin
 * @returns {string}
 */
export function latinToFirestoreId(latin) {
  return norm(latin).replace(/\s+/g, "-").toLowerCase();
}

/**
 * Generates a unique plant_id field from a Latin name.
 * @param {string} latin
 * @returns {string}
 */
export function plantIdFromLatin(latin) {
  return `plant_${norm(latin).replace(/\s+/g, "_").toLowerCase()}`;
}
