// import_cards_ready_to_firestore.js (ESM)
// One-time Firestore upsert from cards_ready.json with safe defaults.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import slugify from "slugify";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Admin SDK using Application Default Credentials (from GOOGLE_APPLICATION_CREDENTIALS)
initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// Resolve project root & input JSON path (adjusted to your actual location)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// IMPORTANT: path relative to where you run `node ...`
const INPUT_FILE = path.resolve(
  process.cwd(),
  "ethno-pipeline-v2/data/_staging/cards_ready.json"
);

// Defaults added when fields are missing
const DEFAULTS = {
  status: "ready",
  postedCount: 0,
  disabled: false,
  cooldownDays: 7,
  // postedAt / lastPostedAt are omitted until first post
};

function makeDocIdFromLatin(latin) {
  return slugify(String(latin || "").trim(), { lower: true, strict: true });
}

function normalizeCard(raw) {
  if (!raw || !raw.latin) {
    throw new Error("Each card must have a 'latin' field.");
  }
  const docId = makeDocIdFromLatin(raw.latin);
  if (!docId) throw new Error(`Cannot derive docId from latin="${raw.latin}"`);

  // defaults (override with incoming values if present)
  const base = {
    latin: raw.latin,
    ...DEFAULTS,
  };
  if (typeof raw.status === "string") base.status = raw.status;
  if (typeof raw.postedCount === "number") base.postedCount = raw.postedCount;
  if (typeof raw.disabled === "boolean") base.disabled = raw.disabled;
  if (typeof raw.cooldownDays === "number")
    base.cooldownDays = raw.cooldownDays;

  // keep full original card inside payload
  const payload = { ...raw };

  const docData = {
    latin: base.latin,
    status: base.status,
    postedCount: base.postedCount,
    disabled: base.disabled,
    cooldownDays: base.cooldownDays,
    payload,
  };
  return { docId, docData };
}

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`File not found: ${INPUT_FILE}`);
    process.exit(1);
  }
  const text = fs.readFileSync(INPUT_FILE, "utf8");
  let items = JSON.parse(text);

  // Accept array or { cards: [...] }
  if (!Array.isArray(items)) {
    if (Array.isArray(items.cards)) items = items.cards;
    else
      throw new Error(
        "cards_ready.json must be an array or have a 'cards' array."
      );
  }

  console.log(`Importing ${items.length} cards...`);
  const col = db.collection("cards");
  const BATCH_SIZE = 300;
  let imported = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (raw) => {
        const { docId, docData } = normalizeCard(raw);
        await col.doc(docId).set(docData, { merge: true }); // upsert
      })
    );
    imported += chunk.length;
    console.log(`Upserted ${imported}/${items.length}`);
  }

  console.log("Done ✅");
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
