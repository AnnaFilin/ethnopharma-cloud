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

// Helpers for env flags
function isTrue(value) {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function isNotFalse(value) {
  if (!value) return true;
  const v = String(value).trim().toLowerCase();
  return v !== "false" && v !== "0" && v !== "no" && v !== "off";
}

// Raw channels config from env
const RAW_CHANNELS = [
  {
    id: process.env.CHANNEL_ID_RU,
    lang: "ru",
    enabled: isNotFalse(process.env.POST_TO_RU),
  },
  {
    id: process.env.CHANNEL_ID_EN,
    lang: "en",
    enabled: isTrue(process.env.POST_TO_EN),
  },
];

const CHANNELS = RAW_CHANNELS.filter((ch) => ch.id && ch.enabled);

console.log("[postRandom] channels config:", RAW_CHANNELS);
console.log("[postRandom] active channels:", CHANNELS);

// HTTP handler
functions.http("postRandom", async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Use POST" });
    }
    if (!BOT_TOKEN) {
      throw new Error("BOT_TOKEN is missing");
    }
    if (!CHANNELS.length) {
      throw new Error(
        "No channels configured (check CHANNEL_ID_RU / CHANNEL_ID_EN and POST_TO_RU / POST_TO_EN)"
      );
    }

    const bot = new Telegraf(BOT_TOKEN);
    const results = [];

    for (const { id: channelId, lang } of CHANNELS) {
      console.log(`[postRandom] posting to channel ${channelId} lang=${lang}`);

      const result = await postOnce({
        load: () => loadCards(),
        channelId,
        lang,
        send: (card) => postCardImageAndText(bot, channelId, card, lang),
      });

      results.push({
        channelId,
        lang,
        ...result,
      });
    }

    return res.status(200).json({ ok: true, results });
  } catch (e) {
    console.error("postRandom error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Export
export const postRandom = async (req, res) =>
  functions.get("postRandom")(req, res);
