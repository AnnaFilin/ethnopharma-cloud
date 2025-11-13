// scripts/updateCooldown.js
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Make sure your Firebase credentials are configured (e.g. via GOOGLE_APPLICATION_CREDENTIALS)
admin.initializeApp();

const db = getFirestore();

/**
 * Updates cooldownDays for all documents in a collection.
 */
async function updateAllCooldownDays(collectionName, newCooldownDays = 60) {
  console.log(
    `Starting update for '${collectionName}' → cooldownDays = ${newCooldownDays}`
  );
  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) {
    console.log("⚠️  No documents found.");
    return;
  }

  let batch = db.batch();
  let opCount = 0;
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    batch.update(doc.ref, { cooldownDays: newCooldownDays });
    opCount++;

    // Commit every 500 writes
    if (opCount % 500 === 0) {
      await batch.commit();
      batchCount++;
      console.log(
        `✅ Committed batch ${batchCount} (${opCount} docs updated so far)`
      );
      batch = db.batch();
    }
  }

  // Commit the remaining operations
  if (opCount % 500 !== 0) {
    await batch.commit();
    console.log(`✅ Final batch committed. Total updated: ${opCount}`);
  } else {
    console.log(`✅ All ${opCount} documents updated.`);
  }
}

// Run it
updateAllCooldownDays("cards", 60)
  .then(() => {
    console.log("🎉 Update complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
