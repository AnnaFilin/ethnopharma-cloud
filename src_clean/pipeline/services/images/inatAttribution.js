// ethno-pipeline/lib/inatAttribution.js
// Resolve iNaturalist attribution (credit / license / source) by imageUrl or latin.
// 1) Try /v1/photos/:id if photo_id can be parsed from imageUrl
// 2) Fallback: /v1/taxa?q=<latin> → default_photo
// Returns: { credit, license, source, meta: { inat: { taxon_id, photo_id } } }

const API = "https://api.inaturalist.org/v1";

function licensePretty(code) {
  if (!code) return null;
  const c = String(code).toLowerCase();
  // API returns like "cc-by", "cc-by-nc-sa", etc.
  // We convert to "CC BY", "CC BY NC SA", etc. (dash → space, uppercased)
  if (c.startsWith("cc-"))
    return c.toUpperCase().replace(/-/g, " ").replace(/^CC /, "CC ");
  return code;
}

function parsePhotoIdFromUrl(url = "") {
  // Works for: https://inaturalist-open-data.s3.amazonaws.com/photos/180567584/large.jpeg
  // and for iNat web URLs containing /photos/ID
  const m = String(url).match(/photos\/(\d+)\//);
  return m ? Number(m[1]) : null;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchPhotoAttribution(photoId) {
  const j = await getJSON(`${API}/photos/${photoId}`);
  const r = Array.isArray(j?.results) ? j.results[0] : null;
  if (!r) return null;
  return {
    credit: r.attribution || null,
    license: licensePretty(r.license_code || r.license || null),
    source: r.url || r.native_page_url || "iNaturalist",
    meta: {
      inat: { taxon_id: r.taxon?.id || null, photo_id: r.id || photoId },
    },
  };
}

async function fetchTaxonDefaultPhoto(latin) {
  const j = await getJSON(
    `${API}/taxa?q=${encodeURIComponent(latin)}&per_page=1`
  );
  const t = Array.isArray(j?.results) ? j.results[0] : null;
  const p = t?.default_photo || null;
  if (!t || !p) return null;
  return {
    credit: p.attribution || null,
    license: licensePretty(p.license_code || p.license || null),
    source: p.url || p.medium_url || "iNaturalist",
    meta: { inat: { taxon_id: t.id || null, photo_id: p.id || null } },
  };
}

/**
 * @param {{ latin?: string, imageUrl?: string }} arg
 */
export async function getInatAttribution(arg = {}) {
  const latin = arg.latin || "";
  const imageUrl = arg.imageUrl || "";

  // 1) Try by photo id from imageUrl
  const pid = parsePhotoIdFromUrl(imageUrl);
  if (pid) {
    try {
      const att = await fetchPhotoAttribution(pid);
      if (att?.license) return att;
      // if no license in photo payload — continue to fallback
    } catch {
      // ignore and fallback
    }
  }

  // 2) Fallback by latin → taxa.default_photo
  if (latin) {
    try {
      const att2 = await fetchTaxonDefaultPhoto(latin);
      if (att2?.license) return att2;
      return att2; // may be null or missing license
    } catch {
      // ignore
    }
  }

  // Nothing found
  return {
    credit: null,
    license: null,
    source: "iNaturalist",
    meta: { inat: { taxon_id: null, photo_id: pid || null } },
  };
}
