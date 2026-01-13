import crypto from "node:crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ---------- Helpers ----------
function asDateOrNull(v) {
  try {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (v.toDate && typeof v.toDate === "function") {
      // Firestore Timestamp
      return v.toDate();
    }
    const d = new Date(v);
    return Number.isFinite(+d) ? d : null;
  } catch {
    return null;
  }
}


function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Try to build a short caption (<= 1024 chars)
function buildCaption(card, lang = "ru", max = 1024) {
  const pieces = [];

  if (
    card.caption &&
    (card.caption[lang] || typeof card.caption === "string")
  ) {
    pieces.push(
      typeof card.caption === "string" ? card.caption : card.caption[lang]
    );
  }

  const p = card.payload || card;
  if (p.title && typeof p.title === "string") pieces.push(p.title);
  if (p.summary && typeof p.summary === "string") pieces.push(p.summary);
  if (p.effects && Array.isArray(p.effects)) pieces.push(p.effects.join(" · "));
  if (p.sources && Array.isArray(p.sources)) {
    pieces.push(`Sources: ${p.sources.length}`);
  }

  if (card.latin) pieces.unshift(card.latin);

  let text = pieces.filter(Boolean).join("\n");
  if (!text) text = String(card.latin || "");
  if (text.length > max) text = text.slice(0, max - 1) + "…";
  return text;
}

function getImageUrl(card) {
  return card.imageUrl || card.image || card.payload?.imageUrl || null;
}

// Normalize raw card
function normalizeCard(raw) {
  const postedCount = Number.isFinite(raw.postedCount) ? raw.postedCount : 0;
  const cooldownDays = Number.isFinite(raw.cooldownDays) ? raw.cooldownDays : 7;
  const disabled = !!raw.disabled;
  const status = raw.status ?? "ready";
  const lastPostedAt = asDateOrNull(raw.lastPostedAt);

  const cardId =
    raw.id ||
    raw.docId ||
    (raw.latin
      ? raw.latin.toLowerCase().replace(/\s+/g, "-")
      : crypto.randomUUID());

  return {
    ...raw,
    cardId,
    postedCount,
    cooldownDays,
    disabled,
    status,
    lastPostedAt,
  };
}

// ---------- Eligibility check with cooldown (in days) ----------
function isEligible(card, now) {
  if (card.disabled) return false;
  if (card.status !== "ready") return false;
  if (!card.lastPostedAt) return true;

  // Calculate the difference in full days
  const diffDays = Math.floor((+now - +card.lastPostedAt) / (1000 * 60 * 60 * 24));

  // Use the card's cooldownDays or default to 60
  const cooldownDays = Number.isFinite(card.cooldownDays) ? card.cooldownDays : 60;

  return diffDays >= cooldownDays;
}


// ---------- Sort ----------
function sortForPosting(cards) {
  return [...cards].sort((a, b) => {
    if (a.postedCount !== b.postedCount) return a.postedCount - b.postedCount;
    const at = a.lastPostedAt ? +a.lastPostedAt : 0;
    const bt = b.lastPostedAt ? +b.lastPostedAt : 0;
    if (at !== bt) return at - bt;
    return Math.random() < 0.5 ? -1 : 1;
  });
}

// ---------- Default sender ----------
async function defaultSend(card, ctx) {
  const { telegram, channelId, caption } = ctx;
  if (!telegram)
    throw new Error("No telegram client provided, pass `send` or `telegram`.");

  const imageUrl = getImageUrl(card);
  if (imageUrl) {
    const r = await telegram.sendPhoto(channelId, imageUrl, { caption });
    return r?.message_id || r?.messageId || null;
  } else {
    const r = await telegram.sendMessage(channelId, caption);
    return r?.message_id || r?.messageId || null;
  }
}

// ---------- Main ----------
export async function postOnce({
  load,
  telegram,
  channelId,
  lang = "ru",
  send,
  now = () => new Date(),
} = {}) {
  const startedAt = new Date();

  try {
    if (!load || typeof load !== "function") {
      throw new Error("`load` must be a function that returns an array of cards");
    }
    if (!channelId) {
      throw new Error("`channelId` is required");
    }

    const raw = await Promise.resolve(load());
    const cards = (Array.isArray(raw) ? raw : []).map(normalizeCard);

    const eligible = cards.filter((c) => isEligible(c, now()));
    if (eligible.length === 0) {
      return { ok: false, reason: "NO_ELIGIBLE_CARDS", count: cards.length };
    }

    const sorted = sortForPosting(eligible);
    const selected = sorted[0] || pickRandom(eligible);

    const caption = buildCaption(selected, lang, 1024);

    const messageId = await (send
      ? send(selected, { telegram, channelId, caption, lang, now: now() })
      : defaultSend(selected, {
          telegram,
          channelId,
          caption,
          lang,
          now: now(),
        }));

    // 🟢 Firestore update
    try {
      const db = getFirestore();
      await db.collection("cards").doc(selected.docId).update({
        lastPostedAt: FieldValue.serverTimestamp(),
        postedCount: FieldValue.increment(1),
      });
      console.log(`[postOnce] updated lastPostedAt for ${selected.latin}`);
    } catch (e) {
      console.warn("[postOnce] Firestore update failed:", e.message);
    }

    const durationMs = Date.now() - +startedAt;

    return {
      ok: true,
      cardId: selected.cardId,
      latin: selected.latin || null,
      messageId: messageId || null,
      durationMs,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "UNCAUGHT",
      error: String(error && error.message ? error.message : error),
    };
  }
}

export default postOnce;
