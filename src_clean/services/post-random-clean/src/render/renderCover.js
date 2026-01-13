import { createCanvas, loadImage } from '@napi-rs/canvas';
import { normalizeText, pickTitle } from "../utils/text.js";

function ensureString(v, name) {
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`renderCover: ${name} is required`);
  }
}

/** Tiny http(s) guard */
function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

/** Pick the best image URL (new schema -> legacy -> none) */
function pickImageUrl(card) {
  // new schema
  const imgObjUrl =
    card &&
    card.image &&
    card.image.status === "ok" &&
    typeof card.image.url === "string"
      ? card.image.url
      : "";

  // legacy fallbacks
  const legacy1 = normalizeText(card.illustration_url || card.botanical_url);
  const legacy2 = normalizeText(card.image_url);

  const candidates = [imgObjUrl, legacy1, legacy2].filter(isHttpUrl);
  return candidates.length ? candidates[0] : "";
}

/** Estimate average luma (0..255) on a region of the canvas */
function sampleLuma(ctx, x, y, w, h, step = 8) {
  // clamp region
  const W = ctx.canvas.width,
    H = ctx.canvas.height;
  const rx = Math.max(0, Math.min(x, W - 1));
  const ry = Math.max(0, Math.min(y, H - 1));
  const rw = Math.max(1, Math.min(w, W - rx));
  const rh = Math.max(1, Math.min(h, H - ry));

  const img = ctx.getImageData(rx, ry, rw, rh).data;
  // downsample by "step" to keep it cheap
  let sum = 0,
    count = 0;
  const stride = 4;
  for (let yy = 0; yy < rh; yy += step) {
    for (let xx = 0; xx < rw; xx += step) {
      const i = (yy * rw + xx) * stride;
      const r = img[i],
        g = img[i + 1],
        b = img[i + 2];
      // Rec. 601 luma
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += l;
      count++;
    }
  }
  return count ? sum / count : 128;
}

/** Render 1280x720 PNG cover */
export async function renderCover(card, lang = "ru") {
  const W = 1280;
  const H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1) Base gradient background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0f2b24"); // deep green
  g.addColorStop(1, "#1b1b1b"); // graphite
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 2) Optional background photo (full opacity; no double darkening)
  const bgUrl = pickImageUrl(card);
  if (bgUrl) {
    try {
      const img = await loadImage(bgUrl);
      // cover-fit
      const ratio = Math.max(W / img.width, H / img.height);
      const iw = img.width * ratio;
      const ih = img.height * ratio;
      const ix = (W - iw) / 2;
      const iy = (H - ih) / 2;

      ctx.save();
      ctx.globalAlpha = 1; // draw photo fully opaque
      ctx.drawImage(img, ix, iy, iw, ih);
      ctx.restore();

      // 2.1) Adaptive overlay for readability (light if too dark, dark if too bright)
      // sample the text area (left block where title sits)
      const textRegionX = 60;
      const textRegionY = 60;
      const textRegionW = W - 160;
      const textRegionH = 280;
      const luma = sampleLuma(
        ctx,
        textRegionX,
        textRegionY,
        textRegionW,
        textRegionH,
        10
      );

      // Choose overlay based on luma:
      // - very bright bg -> darker overlay
      // - very dark bg -> subtle white veil
      // - otherwise -> tiny neutral dark overlay
      let overlay = null;
      if (luma >= 200) overlay = "rgba(0,0,0,0.22)";
      else if (luma >= 170) overlay = "rgba(0,0,0,0.16)";
      else if (luma <= 60) overlay = "rgba(255,255,255,0.12)";
      else if (luma <= 90) overlay = "rgba(255,255,255,0.08)";
      else overlay = "rgba(0,0,0,0.12)";

      ctx.save();
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } catch {
      // if image fails, we keep the gradient background
    }
  }

  // 3) Title block
  const title = pickTitle(card, lang);
  ctx.fillStyle = "#f5f2e8"; // warm beige
  ctx.font = "700 68px 'Inter', 'SF Pro Display', Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // add a subtle shadow to improve legibility over photos
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  // line wrap
  const maxWidth = W - 160;
  const x = 80;
  let y = 80;

  function wrap(text, font, lineHeight, maxW) {
    ctx.font = font;
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const m = ctx.measureText(test);
      if (m.width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  const lines = wrap(title, ctx.font, 76, maxWidth).slice(0, 3); // max 3 lines
  const lineH = 76;
  for (const ln of lines) {
    ctx.fillText(ln, x, y);
    y += lineH;
  }
  ctx.restore(); // remove shadow for next texts

  // 4) Category badge
  const cat = (card && card.category) || "plant";
  const badge = String(cat).toUpperCase();
  ctx.font = "600 28px 'Inter', Arial";
  ctx.fillStyle = "rgba(245,242,232,0.90)";
  ctx.fillText(badge, x, y + 24);

  // 5) Footer
  const footer = "Этноботаника × БАДы";
  ctx.font = "500 24px 'Inter', Arial";
  ctx.fillStyle = "rgba(245,242,232,0.80)";
  ctx.textAlign = "right";
  ctx.fillText(footer, W - 60, H - 60);

  // 6) PNG buffer
  return canvas.toBuffer("image/png");
}

export default renderCover;
