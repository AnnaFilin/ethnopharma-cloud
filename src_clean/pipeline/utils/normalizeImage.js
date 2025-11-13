// utils/normalizeImage.js
// Normalizes various image result shapes into a single consistent structure.

/**
 * Converts any pickImage() output into a unified shape:
 * { url, credit, license, source, status } | null
 * @param {any} imgRes
 * @returns {object|null}
 */
export function normalizeImageResult(imgRes) {
  if (!imgRes || typeof imgRes !== "object") return null;

  // Case A: { image: { url, ... }, status? }
  if (imgRes.image && typeof imgRes.image === "object") {
    const { url, credit = "", license = "", source } = imgRes.image;
    const status = imgRes.image.status || imgRes.status || (url ? "ok" : "");
    return url ? { url, credit, license, source, status } : null;
  }

  // Case B: flat { url, credit, license, status }
  if (imgRes.url || imgRes.credit || imgRes.license) {
    const { url, credit = "", license = "" } = imgRes;
    const status = imgRes.status || (url ? "ok" : "");
    return url ? { url, credit, license, status } : null;
  }

  // Case C: { images: [...] }
  if (Array.isArray(imgRes.images) && imgRes.images.length > 0) {
    const first =
      imgRes.images.find((x) => x && (x.url || x.imageUrl)) || imgRes.images[0];
    if (first) {
      const url = first.url || first.imageUrl || "";
      const status = first.status || "ok";
      if (url) {
        return {
          url,
          credit: first.credit || "",
          license: first.license || "",
          source: first.source || "",
          status,
        };
      }
    }
  }

  return null;
}

/* ─────────────────────────────────────────
   Image normalization helper
────────────────────────────────────────── */
/**
 * Normalizes various pickImage shapes to: { url, credit, license, source, status } | null
 */
// function normalizeImageResult(imgRes) {
//   if (!imgRes || typeof imgRes !== "object") return null;

//   // Case A: { image: { url, credit, ... }, status? }
//   if (imgRes.image && typeof imgRes.image === "object") {
//     const { url, credit = "", license = "", source } = imgRes.image;
//     const status = imgRes.image.status || imgRes.status || (url ? "ok" : "");
//     return url ? { url, credit, license, source, status } : null;
//   }

//   // Case B: flat { url, credit, license, status }
//   if (imgRes.url || imgRes.credit || imgRes.license) {
//     const { url, credit = "", license = "" } = imgRes;
//     const status = imgRes.status || (url ? "ok" : "");
//     return url ? { url, credit, license, status } : null;
//   }

//   // Case C: { images: [...] }
//   if (Array.isArray(imgRes.images) && imgRes.images.length > 0) {
//     const first =
//       imgRes.images.find((x) => x && (x.url || x.imageUrl)) || imgRes.images[0];
//     if (first) {
//       const url = first.url || first.imageUrl || "";
//       const status = first.status || "ok";
//       if (url) {
//         return {
//           url,
//           credit: first.credit || "",
//           license: first.license || "",
//           source: first.source || "",
//           status,
//         };
//       }
//     }
//   }
//   return null;
// }
