// steps/06_affiliate.js

import { findAffiliate } from "../services/affiliate/findAffiliate.js";

export async function affiliate({ card } = {}) {
  const base = card && typeof card === "object" ? card : {};
  const q =
    base.latin || base?.title?.en || base?.title?.ru || base?.title || "";

  try {
    const found = await findAffiliate(q);
    if (found && found.url) {
      const note = {
        ru: "Купить на iHerb",
        en: "Buy on iHerb",
        he: "לקנות ב-iHerb",
      };
      const vendor = "iHerb";
      const url = found.url;
      const product_url = found.product_url || found.url; // ensure required
      return { ...base, affiliate: { vendor, note, url, product_url } };
    }
  } catch (_e) {
    // keep affiliate optional
  }

  return { ...base, affiliate: null };
}

export default affiliate;
