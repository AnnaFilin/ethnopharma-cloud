// reconcile-candidates.mjs
// One-off reconciliation (ESM): mark candidates that already have cards.
// Default: dry run (no writes). Use `--apply` to write updates.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const APPLY = process.argv.includes("--apply"); // default false => dryRun

// ---- helpers: normalization ----
function titleCaseLatin(s) {
  if (!s || typeof s !== "string") return "";
  const parts = s.trim().replace(/\s+/g, " ").split(" ");
  return parts
    .map((w, i) =>
      i === 0
        ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        : w.toLowerCase()
    )
    .join(" ");
}

function snakeCaseLatin(s) {
  if (!s || typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// Try to read latin from card data, otherwise infer from docId
function latinFromCard(docId, data) {
  if (data && typeof data.latin === "string" && data.latin.trim()) {
    return titleCaseLatin(data.latin);
  }
  const inferred = docId.replace(/_/g, " ");
  return titleCaseLatin(inferred);
}

async function main() {
  const dryRun = !APPLY;
  const result = {
    totalCandidates: 0,
    totalCards: 0,
    matched: 0,
    updated: 0,
    skipped: 0,
    dryRun,
    sampleUpdated: [],
  };

  // ---- 1) Read all cards and build lookup sets ----
  const cardsSnap = await db.collection("cards").get();
  result.totalCards = cardsSnap.size;

  const cardLatinSet = new Set();
  const cardDocIdSet = new Set();

  cardsSnap.forEach((doc) => {
    const data = doc.data() || {};
    const latin = latinFromCard(doc.id, data);
    if (latin) cardLatinSet.add(titleCaseLatin(latin));
    cardDocIdSet.add(doc.id); // snake_case
  });

  // ---- 2) Scan candidates and decide updates ----
  const candSnap = await db.collection("candidates").get();
  result.totalCandidates = candSnap.size;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of candSnap.docs) {
    const cand = doc.data() || {};
    const latinTitle = titleCaseLatin(cand.latin || "");
    const idSnake = doc.id;

    const hasCardByLatin = latinTitle && cardLatinSet.has(latinTitle);
    const hasCardById = cardDocIdSet.has(idSnake);

    const alreadyHasCardStatus = cand.status === "hasCard";

    if (hasCardByLatin || hasCardById) {
      const update = {};
      if (!alreadyHasCardStatus) update.status = "hasCard";
      if (!cand.source) update.source = "imported";

      if (Object.keys(update).length > 0) {
        update.updatedAt = FieldValue.serverTimestamp();

        if (dryRun) {
          result.matched += 1;
          result.updated += 1;
          if (result.sampleUpdated.length < 10)
            result.sampleUpdated.push(idSnake);
        } else {
          batch.update(doc.ref, update);
          opsInBatch += 1;
          result.matched += 1;
          result.updated += 1;
          if (result.sampleUpdated.length < 10)
            result.sampleUpdated.push(idSnake);

          if (opsInBatch >= 450) {
            await batch.commit();
            batch = db.batch();
            opsInBatch = 0;
          }
        }
      } else {
        result.matched += 1;
        result.skipped += 1;
      }
    } else {
      result.skipped += 1;
    }
  }

  if (!dryRun && opsInBatch > 0) {
    await batch.commit();
  }

  const report = {
    totalCandidates: result.totalCandidates,
    totalCards: result.totalCards,
    matched: result.matched,
    updated: result.updated,
    skipped: result.skipped,
    dryRun: result.dryRun,
    sampleUpdated: result.sampleUpdated,
  };
  console.log(JSON.stringify(report));
}

main().catch((err) => {
  console.error("Reconciliation failed:", err && err.stack ? err.stack : err);
  process.exit(1);
});
