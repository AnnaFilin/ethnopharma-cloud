// tools/countCandidates.mjs
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function main() {
  const snap = await db.collection("candidates").get();

  console.log("Total candidates:", snap.size);
  console.log("Sample IDs (first 10):");
  snap.docs.slice(0, 10).forEach((doc) => {
    console.log("-", doc.id);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
