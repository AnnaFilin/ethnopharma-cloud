// src_clean/utils/meta.js
// Simple heuristic mapping from hostname → source type.

/**
 * Guess the metadata type of a source URL based on its host.
 * Used to categorize references (db, review, flora, etc.).
 */
export function guessTypeFromHost(host) {
  if (host.includes("pubmed")) return "review";
  if (host.includes("cochranelibrary")) return "systematic-review";
  if (host.includes("who.int")) return "guideline";
  if (host.includes("powo.science.kew.org")) return "db";
  if (host.includes("plants.usda.gov")) return "db";
  if (host.includes("herbmed.org")) return "db";
  if (host.includes("floraofchina.org")) return "flora";
  if (host.includes("mycobank.org") || host.includes("indexfungorum.org"))
    return "fungi-db";
  if (host.includes("ods.od.nih.gov")) return "monograph";
  return "web";
}
