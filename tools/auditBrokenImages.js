// tools/auditBrokenImages.js
import fs from "node:fs";
import admin from "firebase-admin";

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
const COLLECTION = process.env.COLLECTION;
const IMAGE_FIELD = process.env.IMAGE_FIELD || "imageUrl";
const LIMIT = Number(process.env.LIMIT || "500");
const OUT = process.env.OUT || "broken_images.json";

if (!PROJECT_ID) {
  console.error("Missing env GCP_PROJECT (or GCLOUD_PROJECT).");
  process.exit(1);
}
if (!COLLECTION) {
  console.error("Missing env COLLECTION (e.g. cards_ready).");
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

function getByPath(obj, path) {
  return path
    .split(".")
    .reduce(
      (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
      obj
    );
}

async function fetchWithTimeout(url, options, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      ...options,
      redirect: "follow",
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function checkImageUrl(url) {
  if (!url || typeof url !== "string")
    return { ok: false, reason: "missing_or_not_string" };
  if (!/^https?:\/\//i.test(url)) return { ok: false, reason: "not_http_url" };

  try {
    const head = await fetchWithTimeout(url, { method: "HEAD" }, 8000);
    const ct = head.headers.get("content-type") || "";
    if (head.ok && ct.toLowerCase().startsWith("image/"))
      return { ok: true, status: head.status, contentType: ct, method: "HEAD" };
    if (head.ok && !ct.toLowerCase().startsWith("image/"))
      return {
        ok: false,
        reason: "not_image_content_type",
        status: head.status,
        contentType: ct,
        method: "HEAD",
      };
  } catch {}

  try {
    const get = await fetchWithTimeout(url, { method: "GET" }, 10000);
    const ct = get.headers.get("content-type") || "";
    if (get.ok && ct.toLowerCase().startsWith("image/"))
      return { ok: true, status: get.status, contentType: ct, method: "GET" };
    if (!get.ok)
      return {
        ok: false,
        reason: "http_not_ok",
        status: get.status,
        contentType: ct,
        method: "GET",
      };
    return {
      ok: false,
      reason: "not_image_content_type",
      status: get.status,
      contentType: ct,
      method: "GET",
    };
  } catch (e) {
    return { ok: false, reason: "network_error_or_timeout", error: String(e) };
  }
}

async function main() {
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Collection: ${COLLECTION}`);
  console.log(`Image field: ${IMAGE_FIELD}`);
  console.log(`Limit: ${LIMIT}`);

  const snap = await db.collection(COLLECTION).limit(LIMIT).get();

  const broken = [];
  let checked = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const url = getByPath(data, IMAGE_FIELD);
    const result = await checkImageUrl(url);

    checked += 1;

    if (!result.ok) {
      broken.push({
        id: doc.id,
        imageUrl: url ?? null,
        reason: result.reason,
        status: result.status ?? null,
        contentType: result.contentType ?? null,
      });
      console.log(
        `[BROKEN] ${doc.id} ${result.reason} ${result.status ?? ""} ${
          url ?? ""
        }`
      );
    }
  }

  fs.writeFileSync(
    OUT,
    JSON.stringify({ checked, brokenCount: broken.length, broken }, null, 2)
  );
  console.log(
    `\nDone. Checked: ${checked}. Broken: ${broken.length}. Saved: ${OUT}`
  );
}

await main();
