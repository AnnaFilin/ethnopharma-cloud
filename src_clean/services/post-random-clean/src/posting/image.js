import { createCanvas, loadImage } from "@napi-rs/canvas";
import { pickTitle } from "../utils/text.js";

/** Best direct image URL (new schema → legacy) */
export function pickDirectImageUrl(card) {
  if (!card) return "";

  // 🔹 1. Try structured image object
  const fromImageObj =
    card?.image && typeof card.image === "object"
      ? card.image.url || card.image.src || ""
      : "";

  // 🔹 2. Common top-level fields (after payload flattening)
  const candidates = [
    fromImageObj,
    card?.image_url,
    card?.illustration_url,
    card?.botanical_url,
    card?.imageUrl,
  ].filter(Boolean);

  for (const u of candidates) {
    try {
      const x = new URL(u);
      if (/^https?:$/.test(x.protocol)) return u;
    } catch {
      // ignore invalid URL
    }
  }

  return "";
}

/** Render remote photo into 1280x720 (cover-fit) and draw title */
export async function renderPhotoBuffer(url, card, lang = "ru") {
  const W = 1280,
    H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // background
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, H);

  // image cover-fit
  const img = await loadImage(url);
  const r = Math.max(W / img.width, H / img.height);
  const iw = img.width * r;
  const ih = img.height * r;
  const ix = (W - iw) / 2;
  const iy = (H - ih) / 2;
  ctx.drawImage(img, ix, iy, iw, ih);

  // very subtle global veil for legibility
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // title box (bigger font, equal paddings)
  const title = pickTitle(card, lang) || "";
  if (title) {
    const padX = 28,
      padY = 24;
    const boxPad = 20;
    const maxW = W - 2 * (padX + 30);

    const fontSize = 64;
    ctx.font = `700 ${fontSize}px 'Inter', Arial, sans-serif`;
    ctx.textBaseline = "top";

    // wrap
    const words = String(title).split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const kept = lines.slice(0, 2);
    const lineH = fontSize + 6;
    const boxW =
      Math.max(...kept.map((t) => ctx.measureText(t).width)) + boxPad * 2;
    const boxH = kept.length * lineH + boxPad * 2;

    const bx = padX,
      by = H - padY - boxH;

    ctx.fillStyle = "rgba(0,0,0,0.32)";
    const r2 = 16;
    ctx.beginPath();
    ctx.moveTo(bx + r2, by);
    ctx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r2);
    ctx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r2);
    ctx.arcTo(bx, by + boxH, bx, by, r2);
    ctx.arcTo(bx, by, bx + boxW, by, r2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f5f2e8";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 1;
    kept.forEach((t, i) => {
      ctx.fillText(t, bx + boxPad, by + boxPad + i * lineH);
    });
    ctx.shadowBlur = 0;
  }

  return canvas.toBuffer("image/jpeg", { quality: 0.92 });
}
