// firestore_ping.mjs — diagnostics for Firestore NOT_FOUND
import fs from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
console.log("KEY PATH =", keyPath);

if (!keyPath || !fs.existsSync(keyPath)) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS not set or file not found");
  process.exit(1);
}
const serviceAccountRaw = fs.readFileSync(keyPath, "utf8");
const serviceAccount = JSON.parse(serviceAccountRaw);

console.log("SERVICE ACCOUNT project_id =", serviceAccount.project_id);

// (На всякий случай пробросим переменные проекта в процесс)
process.env.GOOGLE_CLOUD_PROJECT = serviceAccount.project_id;
process.env.GCLOUD_PROJECT = serviceAccount.project_id;

// Явная инициализация Admin SDK этим ключом и projectId
initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();

async function main() {
  const now = new Date().toISOString();
  console.log(
    "About to write to: projects/" +
      serviceAccount.project_id +
      "/databases/(default)/documents/ping/healthcheck"
  );

  await db
    .collection("ping")
    .doc("healthcheck-from-script")
    .set({ ok: true, now });
  console.log("Ping write OK at", now);
}

main().catch((e) => {
  console.error("Ping failed:", e);
  process.exit(1);
});
