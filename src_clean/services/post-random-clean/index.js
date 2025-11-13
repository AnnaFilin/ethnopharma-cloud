// Cloud Run entrypoint for Telegram posting service

import functions from "@google-cloud/functions-framework";
import { Telegraf } from "telegraf";

import { loadCards } from "./src/sheets.js";         
import { postOnce } from "./src/core/postOnce.js";
import { postCardImageAndText } from "./src/posting/postCard.js";

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}


// Env
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID   = process.env.CHANNEL_ID;
const POST_LANG = (process.env.POST_LANG || "ru").toLowerCase();

// HTTP handler
functions.http("postRandom", async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }
    if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");
    if (!CHAT_ID)   throw new Error("CHANNEL_ID is missing");

    const bot = new Telegraf(BOT_TOKEN);

    const result = await postOnce({
      load: () => loadCards(),                            
      channelId: CHAT_ID,
      lang: POST_LANG,
      send: (card) => postCardImageAndText(bot, CHAT_ID, card, POST_LANG),
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error("postRandom error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Export
export const postRandom = async (req, res) => functions.get("postRandom")(req, res);
