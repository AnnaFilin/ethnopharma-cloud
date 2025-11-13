// importCandidates.js
// Import candidate plant names from a local .txt file into Firestore (ESM version)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// --- Resolve __dirname in ESM scope ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Initialize Firebase Admin SDK ---
initializeApp({ credential: applicationDefault() });
const db = getFirestore();

// --- Path to the local file ---
const FILE_PATH = path.resolve(
  __dirname,
  "ethno-pipeline-v2/candidate_latins.txt"
);

(async () => {
  try {
    const text = fs.readFileSync(FILE_PATH, "utf8");
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    console.log(`💡 Found ${lines.length} lines.`);

    const batch = db.batch();
    const candidatesCol = db.collection("candidates");
    let added = 0;

    for (const latin of lines) {
      const docId = latin.replace(/\s+/g, "_").toLowerCase();
      const docRef = candidatesCol.doc(docId);
      const snap = await docRef.get();

      if (!snap.exists) {
        batch.set(docRef, {
          latin,
          status: "new",
          addedAt: FieldValue.serverTimestamp(),
        });
        added++;
      }
    }

    await batch.commit();
    console.log(`✅ Added ${added} new candidates to Firestore.`);
  } catch (err) {
    console.error("❌ Import error:", err);
  }
})();
