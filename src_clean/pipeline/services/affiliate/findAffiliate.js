// // Find affiliate links for a single plant (ESM).
// // Uses shared helpers from lib/iherbAffiliate.js.
// // Returns: { url: "<search-url-with-rcode>", product_url?: "<direct-product-with-rcode>" }

// import {
//   RCODE,
//   searchUrl,
//   ensureRcode,
//   fetchText,
//   pickProductLink,
// } from "./iherbAffiliate.js";

// export async function findAffiliate(query) {
//   const q = (query || "").trim();
//   const base = { url: searchUrl(q) };

//   if (!q) return base;

//   const preferBrands = [
//     "NOW Foods",
//     "Jarrow Formulas",
//     "Life Extension",
//     "Thorne",
//     "California Gold Nutrition",
//   ];
//   const queries = [q, `${q} extract`, `${q} supplement`];

//   for (const qi of queries) {
//     try {
//       const html = await fetchText(searchUrl(qi));
//       const product = pickProductLink(html, preferBrands);
//       if (product) return { ...base, product_url: ensureRcode(product) };
//     } catch {
//       // ignore and try next variant
//     }
//   }
//   return base;
// }
// ethno-pipeline-v2/services/affiliate/findAffiliate.js
// Find affiliate links for a single plant (ESM).
// Uses shared helpers from lib/iherbAffiliate.js.
// Returns: { url: "<search-url-with-rcode>", product_url?: "<direct-product-with-rcode>" }

import {
  RCODE,
  searchUrl,
  ensureRcode,
  fetchText,
  pickProductLink,
} from "./iherbAffiliate.js";

/** Safely normalize any input to a trimmed string (never call .trim on non-strings). */
// function toQueryString(input) {
//   if (typeof input === "string") return input.trim();
//   if (input && typeof input === "object") {
//     // Accept common keys we might receive
//     for (const k of ["latin", "query", "q", "name", "title"]) {
//       const v = input[k];
//       if (typeof v === "string") return v.trim();
//     }
//   }
//   return "";
// }
// ДО: for (const k of ["latin", "query", "q", "name", "title"]) ...
// ПОСЛЕ:
function toQueryString(input) {
  if (typeof input === "string") return input.trim();
  if (input && typeof input === "object") {
    // nested titles first
    if (typeof input?.title?.en === "string") return input.title.en.trim();
    if (typeof input?.title?.ru === "string") return input.title.ru.trim();
    // then common flat keys
    for (const k of ["latin", "query", "q", "name", "title"]) {
      const v = input[k];
      if (typeof v === "string") return v.trim();
    }
  }
  return "";
}

export async function findAffiliate(query) {
  // DIAGNOSTIC: show input type and resolved query once per call
  const q = toQueryString(query);
  // Keep base search URL regardless of q (as before)
  const base = { url: searchUrl(q) };
  // Optional: tiny trace (harmless in production logs)
  console.log(
    "[affiliate] input.type:",
    typeof query,
    "resolved:",
    q || "(empty)",
    "rcode:",
    RCODE || "(none)"
  );

  if (!q) return base;

  const preferBrands = [
    "NOW Foods",
    "Jarrow Formulas",
    "Life Extension",
    "Thorne",
    "California Gold Nutrition",
  ];
  const queries = [q, `${q} extract`, `${q} supplement`];

  for (const qi of queries) {
    try {
      const html = await fetchText(searchUrl(qi));
      const product = pickProductLink(html, preferBrands);
      if (product) return { ...base, product_url: ensureRcode(product) };
    } catch {
      // ignore and try next variant
    }
  }
  return base;
}
