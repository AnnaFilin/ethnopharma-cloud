import { renderCover } from "../render/renderCover.js";
import { renderPhotoBuffer, pickDirectImageUrl } from "./image.js";
import { buildCaption, buildFullText, splitIntoChunks } from "./text.withEffects.js";


const DEFAULT_LANG = (process.env.POST_LANG || "ru").toLowerCase();

async function sendPhoto(ctxOrBot, target, bufferOrUrl, caption = "") {
  if (!bufferOrUrl) return;
  const opts = { caption, parse_mode: "HTML" };
  if (typeof target === "string") {
    return ctxOrBot.telegram.sendPhoto(
      target,
      typeof bufferOrUrl === "string" ? bufferOrUrl : { source: bufferOrUrl },
      opts
    );
  } else {
    return ctxOrBot.replyWithPhoto(
      typeof bufferOrUrl === "string" ? bufferOrUrl : { source: bufferOrUrl },
      opts
    );
  }
}

async function sendText(ctxOrBot, target, text) {
  if (!text) return;
  const opts = { parse_mode: "HTML", disable_web_page_preview: true };
  if (typeof target === "string") {
    return ctxOrBot.telegram.sendMessage(target, text, opts);
  } else {
    return ctxOrBot.reply(text, opts);
  }
}

export async function postCardImageAndText(ctxOrBot, target, card, lang = DEFAULT_LANG) {
  try {
    const norm = card || {};
    const caption = (buildCaption(norm, lang) || "").trim();
    const safeCaption = caption || norm.latin || "Без описания";

    // -------------------------------
    // 1️⃣ IMAGE: direct photo or cover
    // -------------------------------
    const imgUrl = pickDirectImageUrl(norm);
    console.log("[postCard] image candidate:", imgUrl || "(none)");

    if (imgUrl) {
      try {
        const buf = await renderPhotoBuffer(imgUrl, norm, lang);
        await sendPhoto(ctxOrBot, target, buf, safeCaption);
      } catch (e) {
        console.warn("[renderPhotoBuffer fail]", e?.message);
        try {
          const cover = await renderCover(norm, lang);
          await sendPhoto(ctxOrBot, target, cover, safeCaption);
        } catch (e2) {
          console.warn("[renderCover fail]", e2?.message);
          await sendText(ctxOrBot, target, safeCaption);
        }
      }
    } else {
      console.warn("[no image_url] → render cover");
      const cover = await renderCover(norm, lang);
      await sendPhoto(ctxOrBot, target, cover, safeCaption);
    }

    // -------------------------------
    // 2️⃣ TEXT: full body
    // -------------------------------
    const full = (buildFullText(norm, lang) || "").trim();
    if (full) {
      const chunks = splitIntoChunks(full, 3500);
      for (const chunk of chunks) await sendText(ctxOrBot, target, chunk);
    } else {
      console.warn("[postCard] no full text");
    }

    console.log("[postCard] ✅ sent with image/cover");
  } catch (err) {
    console.error("[postCard] ❌", err);
    try {
      await sendText(ctxOrBot, target, "Publish error (image stage).");
    } catch {}
  }
}
