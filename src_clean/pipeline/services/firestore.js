// services/firestore.js
// Firestore helpers for cards and candidates management (exact original logic).

import { Firestore } from "@google-cloud/firestore";
import { info, warn, error } from "../utils/logger.js";

let _cardsCol = null;
let _dbForCandidates = null;
let _FV = null;

/** Returns Firestore collection for cards (cached). */
export async function getCardsCol() {
  if (_cardsCol) return _cardsCol;
  const db = new Firestore();
  _cardsCol = db.collection("cards");
  return _cardsCol;
}

/**
 * Saves full card document (with nested payload) to Firestore.
 * Mirrors original logic from index.cleaned.js.
 * @param {{ id?: string, data?: object, latin?: string, payload?: object }} input
 */
// export async function saveCardToFirestore(input) {
//   try {
//     let id, data;
//     if (input && input.id && input.data) {
//       ({ id, data } = input);
//     } else {
//       const card = input || {};
//       const latin = card.latin || card?.payload?.latin;
//       if (!latin) return { ok: false, reason: "no-latin" };
//       id = latin.replace(/\s+/g, "-").toLowerCase();
//       data = card;
//     }

//     const col = await getCardsCol();
//     await col.doc(id).set(data, { merge: true });
//     info(`[firestore] upsert cards/${id}`);
//     return { ok: true, id };
//   } catch (e) {
//     error("[firestore] write failed:", e?.message || e);
//     return { ok: false, reason: e?.message || "unknown" };
//   }
// }
export async function saveCardToFirestore(input) {
  const WRITE_TO_FIRESTORE =
    String(process.env.WRITE_TO_FIRESTORE || "1") !== "0";
  if (!WRITE_TO_FIRESTORE) {
    info(`[firestore] WRITE_TO_FIRESTORE=0 — skip`);
    return { ok: false, reason: "dry-run" };
  }
  try {
    let id, data;
    if (input && input.id && input.data) {
      ({ id, data } = input);
    } else {
      const card = input || {};
      const latin = card.latin || card?.payload?.latin;
      if (!latin) return { ok: false, reason: "no-latin" };
      id = latin.replace(/\s+/g, "-").toLowerCase();
      data = card;
    }

    const col = await getCardsCol();
    await col.doc(id).set(data, { merge: true });
    info(`[firestore] upsert cards/${id}`);
    return { ok: true, id };
  } catch (e) {
    error("[firestore] write failed:", e?.message || e);
    return { ok: false, reason: e?.message || "unknown" };
  }
}

/** Returns Firestore collection reference for candidates (cached). */
export async function getCandidatesCol() {
  if (_dbForCandidates)
    return { col: _dbForCandidates.collection("candidates"), FV: _FV };
  const mod = await import("@google-cloud/firestore");
  _dbForCandidates = new mod.Firestore();
  _FV = mod.FieldValue;
  return { col: _dbForCandidates.collection("candidates"), FV: _FV };
}

/**
 * Picks and locks new candidates for processing.
 * @param {number} limit
 */
export async function pickAndLockCandidates(limit = 1) {
  const { col, FV } = await getCandidatesCol();
  const snap = await col
    .where("status", "==", "new")
    .limit(limit * 3)
    .get();
  const picked = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    if (d.lockedAt) continue;
    await doc.ref.set({ lockedAt: FV.serverTimestamp() }, { merge: true });
    picked.push({ id: doc.id, latin: d.latin });
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * Marks a candidate as finished (status → hasCard) and links to Firestore card.
 * @param {string} id - candidate doc id
 * @param {string} cardSlug - related card slug
 */
export async function markCandidateHasCard(id, cardSlug) {
  const { col, FV } = await getCandidatesCol();
  await col.doc(id).set(
    {
      status: "hasCard",
      cardRef: `cards/${cardSlug}`,
      updatedAt: FV.serverTimestamp(),
      lockedAt: FV.delete(),
    },
    { merge: true }
  );
}

/** Unlocks candidate when pipeline fails (status unchanged). */
export async function unlockCandidate(id) {
  const { col, FV } = await getCandidatesCol();
  await col.doc(id).set(
    {
      lockedAt: FV.delete(),
      updatedAt: FV.serverTimestamp(),
    },
    { merge: true }
  );
}
