// ethnopharma-public/tools/countCards.js

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function main() {
  const snap = await db.collection("cards").get();

  console.log("Total cards:", snap.size);

  console.log("Sample cards (first 10):");
  for (const doc of snap.docs.slice(0, 10)) {
    const data = doc.data() || {};
    console.log("-", doc.id, "latin:", data.latin || null);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("countCards error:", err);
  process.exit(1);
});
