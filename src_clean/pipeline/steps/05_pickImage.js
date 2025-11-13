import { findS3ImageForLatin } from "../services/images/inatImage.js";
import { getInatAttribution } from "../services/images/inatAttribution.js";

/* --- Check URL --- */
function isValidUrl(u) {
  try {
    const url = new URL(u);
    return (
      url.protocol === "https:" &&
      !/wikimedia\.org|wikipedia\.org/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

/* --- Openverse --- */
async function queryOpenverse(latin) {
  const api = `https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(
    latin
  )}&license_type=commercial&format=json&page_size=10`;
  try {
    const r = await fetch(api);
    const j = await r.json();
    const arr = Array.isArray(j?.results) ? j.results : [];
    return arr
      .map((x) => ({
        url: x?.url || "",
        credit: x?.attribution || x?.creator || "",
        license: x?.license || "",
        source: "openverse",
      }))
      .filter((x) => isValidUrl(x.url));
  } catch {
    return [];
  }
}

/* --- Unsplash fallback --- */
async function queryUnsplash(latin) {
  const api = `https://source.unsplash.com/800x600/?${encodeURIComponent(
    latin
  )}`;
  try {
    const r = await fetch(api, { redirect: "manual" });
    const url = r.headers.get("location");
    if (isValidUrl(url)) return [{ url, source: "unsplash" }];
    return [];
  } catch {
    return [];
  }
}

/* --- Flickr fallback --- */
async function queryFlickr(latin) {
  const api = `https://www.flickr.com/services/feeds/photos_public.gne?format=json&nojsoncallback=1&tags=${encodeURIComponent(
    latin
  )}`;
  try {
    const r = await fetch(api);
    const j = await r.json();
    const items = Array.isArray(j?.items) ? j.items : [];
    return items
      .map((x) => ({
        url: x.media?.m || "",
        credit: x.author || "",
        license: "",
        source: "flickr",
      }))
      .filter((x) => isValidUrl(x.url));
  } catch {
    return [];
  }
}

/* --- main function --- */
export async function pickImage(latinName) {
  console.log("[debug pickImage input]", latinName);

  // 🔍 Check image exsists (HEAD)
  async function isImageOk(url) {
    try {
      const r = await fetch(url, { method: "HEAD" });
      const type = r.headers.get("content-type") || "";
      const len = Number(r.headers.get("content-length") || 0);
      return r.ok && type.startsWith("image/") && len > 1000;
    } catch {
      return false;
    }
  }

  // 1️⃣ iNaturalist
  const inatUrl = await findS3ImageForLatin(latinName);
  if (isValidUrl(inatUrl) && (await isImageOk(inatUrl))) {
    try {
      const att = await getInatAttribution({
        latin: latinName,
        imageUrl: inatUrl,
      });
      const out = {
        url: inatUrl,
        credit: att?.credit || "",
        license: att?.license || "",
        source: "iNaturalist",
        status: "ok",
      };
      console.log("[debug pickImage output]", JSON.stringify(out, null, 2));
      return out;
    } catch {
      return { url: inatUrl, source: "iNaturalist", status: "ok" };
    }
  } else {
    console.warn(`[pickImage] iNat invalid or broken: ${inatUrl}`);
  }

  // 2️⃣ Openverse
  const ov = await queryOpenverse(latinName);
  for (const o of ov) {
    if (await isImageOk(o.url)) {
      const out = { ...o, status: "ok" };
      console.log("[debug pickImage output]", JSON.stringify(out, null, 2));
      return out;
    }
  }

  // 3️⃣ Unsplash
  const uns = await queryUnsplash(latinName);
  for (const u of uns) {
    if (await isImageOk(u.url)) {
      const out = { ...u, status: "ok" };
      console.log("[debug pickImage output]", JSON.stringify(out, null, 2));
      return out;
    }
  }

  // 4️⃣ Flickr
  const fl = await queryFlickr(latinName);
  for (const f of fl) {
    if (await isImageOk(f.url)) {
      const out = { ...f, status: "ok" };
      console.log("[debug pickImage output]", JSON.stringify(out, null, 2));
      return out;
    }
  }

  // 5️⃣ nothing found
  const miss = { url: "", status: "missing" };
  console.log("[debug pickImage output]", JSON.stringify(miss, null, 2));
  return miss;
}
