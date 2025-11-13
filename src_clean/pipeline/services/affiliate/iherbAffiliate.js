// Shared iHerb affiliate helpers (ESM).
// Single source of truth for search URL generation, rcode handling, HTML fetch, and product link picking.

export const RCODE = (process.env.IHERB_RCODE || "AWS0707").trim();

export function searchUrl(q) {
  const base = "https://www.iherb.com/search";
  const kw = encodeURIComponent(q || "");
  const u = new URL(base + "?kw=" + kw);
  if (RCODE) u.searchParams.set("rcode", RCODE);
  return u.toString();
}

export function ensureRcode(url) {
  try {
    const u = new URL(url);
    if (RCODE && !u.searchParams.get("rcode"))
      u.searchParams.set("rcode", RCODE);
    return u.toString();
  } catch {
    return url;
  }
}

export async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.7",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}

export function pickProductLink(html, preferBrands = []) {
  // Collect candidate /pr/... links from various attributes.
  const hits = new Set();

  // href=".../pr/Brand/123..."
  {
    const re =
      /href=['"](?:https?:\/\/[^'"]+)?(\/pr\/[^"'?#]+?(?:\/\d+)?)(?:[?#][^'"]*)?['"]/gi;
    let m;
    while ((m = re.exec(html))) hits.add(m[1]);
  }
  // data-* variants used by iHerb
  {
    const re2 = /data-(?:ga-)?eec-producturl=['"](\/pr\/[^'"]+)['"]/gi;
    let m;
    while ((m = re2.exec(html))) hits.add(m[1]);
  }
  {
    const re3 = /data-product-url=['"](\/pr\/[^'"]+)['"]/gi;
    let m;
    while ((m = re3.exec(html))) hits.add(m[1]);
  }

  const links = Array.from(hits).map((p) => `https://www.iherb.com${p}`);
  if (!links.length) return null;

  // Prefer specific brands when present.
  for (const b of preferBrands) {
    const slug = b.toLowerCase().replace(/\s+/g, "-");
    const hit = links.find((u) => u.toLowerCase().includes(`/pr/${slug}-`));
    if (hit) return hit;
  }
  return links[0];
}
