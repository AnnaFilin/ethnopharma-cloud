// Shared iNaturalist image finder (ESM).
// Given a latin name, returns an open-data S3 "large" image URL if possible.

export function toS3Large(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/photos\/(\d+)\/[^/]+\.(jpe?g|png)$/i);
    if (!m) return null;
    const id = m[1];
    const ext = (m[0].match(/\.(jpe?g|png)$/i) || ["", "jpg"])[1].toLowerCase();
    return `https://inaturalist-open-data.s3.amazonaws.com/photos/${id}/large.${ext}`;
  } catch {
    return null;
  }
}

async function fetchJSON(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Etnobotanics-BUDs/1.0 (+bot discovery)",
      "Accept": "application/json"
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function findS3ImageForLatin(latin) {
  const q = encodeURIComponent(latin);

  // 1) taxa → default_photo
  try {
    const taxa = await fetchJSON(`https://api.inaturalist.org/v1/taxa?q=${q}&per_page=1&locale=en`);
    const t = taxa?.results?.[0];
    const p = t?.default_photo;
    const candidates = [p?.large_url, p?.medium_url, p?.url, p?.original_url].filter(Boolean);
    for (const c of candidates) {
      const s3 = toS3Large(c) || c;
      if (/^https?:/.test(s3)) return s3;
    }
  } catch { /* ignore */ }

  // 2) fallback: observations
  try {
    const obs = await fetchJSON(`https://api.inaturalist.org/v1/observations?taxon_name=${q}&per_page=1&order=desc&order_by=created_at&photos=true`);
    const o = obs?.results?.[0];
    const any = o?.photos?.[0]?.url || o?.photos?.[0]?.original_url || o?.photos?.[0]?.medium_url;
    if (any) {
      const s3 = toS3Large(any) || any;
      if (/^https?:/.test(s3)) return s3;
    }
  } catch { /* ignore */ }

  return "";
}
