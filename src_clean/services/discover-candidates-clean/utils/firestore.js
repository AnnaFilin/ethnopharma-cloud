const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { titleCaseLatin, snakeIdFromLatin } = require("./latin.js");

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// read candidates + cards → sets for fast checks
async function readExistingSets() {
  const [candSnap, cardsSnap] = await Promise.all([
    db.collection("candidates").get(),
    db.collection("cards").get(),
  ]);
  const existingLatin = new Set();
  const existingIds = new Set();

  candSnap.forEach((doc) => {
    const d = doc.data() || {};
    if (d.latin) existingLatin.add(titleCaseLatin(d.latin));
    existingIds.add(doc.id);
  });
  cardsSnap.forEach((doc) => {
    const d = doc.data() || {};
    const latin = d.latin
      ? titleCaseLatin(d.latin)
      : titleCaseLatin(doc.id.replace(/_/g, " "));
    if (latin) existingLatin.add(latin);
    existingIds.add(doc.id);
  });

  return { existingLatin, existingIds };
}

// batch-write new candidates
async function persistCandidates(latins) {
  if (!latins.length) return 0;
  let batch = db.batch();
  let ops = 0,
    wrote = 0;

  for (const latin of latins) {
    const id = snakeIdFromLatin(latin);
    const ref = db.collection("candidates").doc(id);
    batch.set(
      ref,
      {
        latin,
        status: "new",
        source: "suggested",
        addedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    ops++;
    wrote++;
    if (ops >= 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return wrote;
}

module.exports = { db, FieldValue, readExistingSets, persistCandidates };
