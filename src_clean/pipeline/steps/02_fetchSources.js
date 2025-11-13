// ethno-pipeline-v2/steps/02_fetchSources.js
// Fetch safe list of reference URLs for a given plant (ESM version).
// No duplicate logic, no unsafe .trim(), minimal logs for debugging.

import { normalizeInput } from "../utils/normalize.js";
import { loadAllowlist } from "../utils/allowlist.js";
import { hostOf, fetchTitle } from "../utils/net.js";
import { guessTypeFromHost } from "../utils/meta.js";

/**
 * Main entry: find and return safe source URLs for a given plant.
 * @param {string|object} input - latin name or object {latin|query|q}
 * @param {object} opts - { allowlistPath?, maxItems? }
 */
export async function fetchSources(
  input,
  {
    allowlistPath = "ethno-pipeline-v2/config/domains.allowlist.json",
    maxItems = 4,
  } = {}
) {
  // --- diagnostics
  console.log("[02_fetchSources] typeof input:", typeof input);

  const latin = normalizeInput(input);
  if (!latin) {
    console.log("[02_fetchSources] empty query → []");
    return [];
  }

  console.log("[02_fetchSources] resolved query:", latin);

  const allow = loadAllowlist(allowlistPath);
  const q = encodeURIComponent(latin);

  const candidates = [
    `https://pubmed.ncbi.nlm.nih.gov/?term=${q}`,
    `https://www.who.int/search?page=1&pagesize=10&query=${q}`,
    `https://powo.science.kew.org/?q=${q}`,
    `https://www.herbmed.org/?s=${q}`,
    `https://plants.usda.gov/home/names?keyword=${q}`,
    `https://ods.od.nih.gov/search.aspx?search=${q}`,
  ];

  const picked = [];
  for (const url of candidates) {
    const host = hostOf(url);
    if (!allow.has(host)) continue; // enforce allowlist
    const title = await fetchTitle(url);
    picked.push({
      title: title || host,
      url,
      type: guessTypeFromHost(host),
    });
    if (picked.length >= maxItems) break;
  }

  console.log("[02_fetchSources] picked:", picked.length);
  return picked;
}

export default fetchSources;
