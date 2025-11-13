import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function importEffects() {
  // абсолютный путь до effects_vocab.json
  const filePath = path.resolve(
    "./ethno-pipeline-v2/config/effects_vocab.json"
  );

  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const batch = db.batch();

  Object.entries(data).forEach(([key, value]) => {
    const ref = db.collection("effects_vocab").doc(key.toLowerCase());
    batch.set(ref, value);
  });

  await batch.commit();
  console.log(`✅ Imported ${Object.keys(data).length} effects.`);
}

importEffects().catch(console.error);
