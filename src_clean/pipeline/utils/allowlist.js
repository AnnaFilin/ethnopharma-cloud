// src_clean/utils/allowlist.js
// Utilities for handling domain allowlists safely.

import fs from "fs";

/** Default allowlist of trusted domains. */
export const DEFAULT_ALLOWLIST = [
  "ods.od.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "cochranelibrary.com",
  "who.int",
  "powo.science.kew.org",
  "plants.usda.gov",
  "herbmed.org",
  "floraofchina.org",
  "mycobank.org",
  "indexfungorum.org",
];

/**
 * Load allowlist file if available, otherwise fallback to default list.
 * @param {string} filePath - path to JSON file with domains.
 * @returns {Set<string>} a set of allowed hostnames.
 */
export function loadAllowlist(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(data) && data.length
      ? new Set(data)
      : new Set(DEFAULT_ALLOWLIST);
  } catch {
    return new Set(DEFAULT_ALLOWLIST);
  }
}
