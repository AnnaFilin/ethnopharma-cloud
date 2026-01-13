import { createRequire } from "module";
const require = createRequire(import.meta.url);
// ---- Env & feature flags ----
const DEFAULT_LANG = (process.env.POST_LANG || "ru").toLowerCase();
const DISABLE_EFFECTS = process.env.DISABLE_EFFECTS === "1";

// ---- Effects vocab cache (filled asynchronously once) ----
let EFFECTS_VOCAB = Object.create(null);
let VOCAB_READY = false;
let VOCAB_LOAD_STARTED = false;

/**
 * Warm up effects vocabulary from Firestore into memory.
 * Safe to call multiple times; runs only once per process.
 */


function warmEffectsVocabOnce() {
  if (VOCAB_LOAD_STARTED || DISABLE_EFFECTS) return;
  VOCAB_LOAD_STARTED = true;

  let db;
  try {
    const { initializeApp, getApps, applicationDefault } = require("firebase-admin/app");
    const { getFirestore } = require("firebase-admin/firestore");

    if (!getApps().length) {
      initializeApp({ credential: applicationDefault() });
    }

    db = getFirestore();
  } catch (err) {
    console.warn("[effects] Firebase not ready yet:", err?.message || err);
    VOCAB_LOAD_STARTED = false; 
    return;
  }

  db.collection("effects_vocab")
    .get()
    .then((snap) => {
      const acc = Object.create(null);
      snap.forEach((doc) => {
        const k = String(doc.id || "").trim();
        const v = doc.data() || {};
        if (k) acc[k] = v;
      });
      EFFECTS_VOCAB = acc;
      VOCAB_READY = true;
      console.log(`[effects] loaded ${Object.keys(EFFECTS_VOCAB).length} records from Firestore`);
    })
    .catch((err) => {
      console.warn("[effects] failed to load from Firestore:", err?.message || err);
      VOCAB_LOAD_STARTED = false;
    });
}


// Kick off async warm-up on module load (non-blocking)
warmEffectsVocabOnce();

// ---- Utils ----
function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pickLang(obj, lang = DEFAULT_LANG) {
  if (!obj || typeof obj !== "object") return "";
  if (lang === "ru") return obj.ru ?? obj.en ?? obj.he ?? "";
  if (lang === "he") return obj.he ?? obj.en ?? obj.ru ?? "";
  return obj.en ?? obj.ru ?? obj.he ?? "";
}

function compactJoin(parts, sep = "\n") {
  return parts.filter(Boolean).join(sep);
}

function trimToLimitNoMidWord(text = "", limit = 1024) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const noBrokenTag = cut.replace(/<[^>]*$/g, "");
  const lastSpace = noBrokenTag.lastIndexOf(" ");
  const safe = lastSpace > 0 ? noBrokenTag.slice(0, lastSpace) : noBrokenTag;
  return `${safe}…`;
}

function heading(key, lang = DEFAULT_LANG) {
  const map = {
    summary: { ru: "Кратко", en: "Summary", he: "תקציר" },
    ethnobotany: { ru: "Этноботаника", en: "Ethnobotany", he: "אתנובוטניקה" },
    modern_evidence: { ru: "Современные данные", en: "Modern evidence", he: "עדויות עכשוויות" },
    interesting_fact: { ru: "Интересный факт", en: "Interesting fact", he: "עובדה מעניינת" },
    context: { ru: "Контекст", en: "Context", he: "הקשר" },
    safety: { ru: "Безопасность", en: "Safety", he: "בטיחות" },
    sources: { ru: "Источники", en: "Sources", he: "מקורות" },
    effects: { ru: "Эффекты", en: "Effects", he: "השפעות" },
  };
  const rec = map[key] || {};
  const title = pickLang(rec, lang) || key;
  return `<b>${esc(title)}:</b>`;
}

function getTagsForLang(tags, lang = DEFAULT_LANG) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "object") {
    return tags[lang] || tags.ru || tags.en || tags.he || [];
  }
  return [];
}

// ---- Effects normalization & resolution (sync, via in-memory cache) ----
const MISSING_EFFECT_KEYS = new Set();
let missingLogged = false;

/** Normalize a key: lowercase, unify separators, drop parens and non-letters (keep hyphens). */
function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[()]/g, "")
    .replace(/[^a-zа-яё\-]/gi, "")
    .trim();
}

/**
 * Resolve label by checking the in-memory vocabulary.
 * If the vocabulary hasn't finished loading yet, we fall back to the raw key (no Firestore roundtrips here).
 */
function resolveEffectLabel(effectItem, lang = DEFAULT_LANG) {
  // Accept pre-localized object
  if (effectItem && typeof effectItem === "object" && !Array.isArray(effectItem)) {
    const txt = pickLang(effectItem, lang);
    if (txt) return txt;
  }

  const raw = String(effectItem || "").trim();
  if (!raw) return "";

  if (DISABLE_EFFECTS) return raw; // feature-flag quick escape

  // If cache is ready, try to map by several normalized variants
  const candidates = VOCAB_READY
    ? [
        raw,
        raw.toLowerCase(),
        normalizeKey(raw),
        normalizeKey(raw).replace(/-/g, " "),
      ]
    : null;

  if (candidates) {
    // Direct docId lookup (common case: ids are lowercase keys)
    for (const cand of candidates) {
      const rec = EFFECTS_VOCAB[cand];
      if (rec) {
        return rec[lang] || rec.en || raw;
      }
    }
    // Fuzzy match across keys (normalization equality)
    for (const [dictKey, rec] of Object.entries(EFFECTS_VOCAB)) {
      if (normalizeKey(dictKey) === normalizeKey(raw)) {
        return rec[lang] || rec.en || raw;
      }
    }
  }

  // Cache not ready or no match found — fallback to raw and log once
  if (!MISSING_EFFECT_KEYS.has(raw)) {
    MISSING_EFFECT_KEYS.add(raw);
    if (!missingLogged) {
      missingLogged = true;
      setTimeout(() => {
        const list = Array.from(MISSING_EFFECT_KEYS).join(", ");
        console.warn("[effects][missing keys] Add to effects_vocab (Firestore):", list);
      }, 0);
    }
  }
  return raw;
}

/** Build the "Effects" section as a bulleted list (sync). */
function buildEffectsBlock(card, lang = DEFAULT_LANG) {
  if (DISABLE_EFFECTS) return "";

  const list = Array.isArray(card?.effects) ? card.effects : [];
  if (!list.length) return "";

  const items = list
    .slice(0, 8) // keep compact
    .map((x) => resolveEffectLabel(x, lang))
    .filter(Boolean)
    .map((txt) => `• ${esc(txt)}`)
    .join("\n");

  return items ? `${heading("effects", lang)}\n${items}` : "";
}

// ---- Visual helpers ----
function hr() {
  return "<i>— — —</i>";
}

function formatTitleLine(card, lang = DEFAULT_LANG) {
  const localTitle = pickLang(card?.title || {}, lang);
  const latin = card?.latin || "";
  const left = localTitle ? `<b>${esc(localTitle)}</b>` : "";
  const right = latin ? `<i>(${esc(latin)})</i>` : "";
  return [left, right].filter(Boolean).join(" ");
}

// ---- Affiliate / Sources ----
function formatAffiliate(card, lang = DEFAULT_LANG) {
  const url = card?.affiliate?.product_url || card?.affiliate?.url || "";
  if (!url) return "";

  const label =
    lang === "ru" ? "Партнёрская ссылка" : lang === "he" ? "קישור שותפים" : "Affiliate link";

  const text =
    lang === "ru" ? "Купить на iHerb" : lang === "he" ? "לקנות ב-iHerb" : "Buy on iHerb";

  return `<b>${esc(label)}:</b> <a href="${esc(url)}">${esc(text)}</a>`;
}

function formatSources(card) {
  const arr = Array.isArray(card?.sources) ? card.sources : [];
  if (!arr.length) return "";

  const lines = arr
    .map((s) => {
      if (typeof s === "string") {
        const url = s;
        return `• <a href="${esc(url)}">${esc(url)}</a>`;
      }
      const title = s?.title || s?.name || s?.label || s?.url || "";
      const url = s?.url || "";
      if (!title && !url) return "";
      if (url) return `• <a href="${esc(url)}">${esc(title)}</a>`;
      return `• ${esc(title)}`;
    })
    .filter(Boolean)
    .join("\n");

  return lines;
}

// ---- Public builders ----

/**
 * Build Telegram photo caption:
 * - Only Summary/Кратко… (if present) + tags
 * - Max length 1024, smart trimming
 */
export function buildCaption(card, lang = DEFAULT_LANG) {
  const summary = pickLang(card?.summary || {}, lang);
  const summaryLabel = lang === "ru" ? "Кратко" : lang === "he" ? "תקציר" : "Summary";
  const summaryLine = summary ? `<b>${esc(summaryLabel)}:</b> ${esc(summary)}` : "";

  const tags = getTagsForLang(card?.tags, lang);
  const tagsLine = tags.length ? esc(tags.join(" ")) : "";

  let caption = [summaryLine, tagsLine].filter(Boolean).join("\n");

  if (caption.length > 1024) {
    if (summaryLine) {
      const tail = [tagsLine].filter(Boolean).join("\n");
      const remaining = 1024 - (tail.length + (tail ? 1 : 0));
      const trimmedSummary = trimToLimitNoMidWord(summary.replace(/^\s+/, ""), Math.max(0, remaining));
      const newSummaryLine = `<b>${esc(summaryLabel)}:</b> ${esc(trimmedSummary)}`;
      caption = [newSummaryLine, tail].filter(Boolean).join("\n");
    }
    if (caption.length > 1024) {
      caption = trimToLimitNoMidWord(caption, 1024);
    }
  }

  return caption;
}

/**
 * Build full HTML text for a separate message:
 * - One-line title at top (bold local, italic Latin)
 * - Narrative sections with headings
 * - Effects block (bullets), then affiliate, sources, tags
 */
export function buildFullText(card, lang = DEFAULT_LANG) {
  // Title
  const oneLineTitle = formatTitleLine(card, lang);

  // Main narrative sections
  const mainBlocks = [];
  const sections = [
    ["ethnobotany", pickLang(card?.ethnobotany || {}, lang)],
    ["modern_evidence", pickLang(card?.modern_evidence || {}, lang)],
    ["interesting_fact", pickLang(card?.interesting_fact || {}, lang)],
    ["context", pickLang(card?.context || {}, lang)],
    ["safety", pickLang(card?.safety || {}, lang)],
  ];

  for (const [key, text] of sections) {
    if (!text) continue;
    mainBlocks.push(`${heading(key, lang)}\n${esc(text)}`);
  }

  // Meta: effects / affiliate / sources / tags
  const metaBlocks = [];

  const effectsBlock = buildEffectsBlock(card, lang);
  if (effectsBlock) metaBlocks.push(effectsBlock);

  const affiliateLine = formatAffiliate(card, lang);
  if (affiliateLine) metaBlocks.push(affiliateLine);

  const src = formatSources(card);
  if (src) metaBlocks.push(`${heading("sources", lang)}\n${src}`);

  const tagsArr = getTagsForLang(card?.tags, lang);
  if (tagsArr.length) metaBlocks.push(esc(tagsArr.join(" ")));

  // Compose body with gentle dividers
  const bodyBlocks = [...mainBlocks];
  if (metaBlocks.length) {
    bodyBlocks.push(hr());
    bodyBlocks.push(...metaBlocks);
  }

  const body = bodyBlocks.join("\n\n");
  return [oneLineTitle, hr(), "", body].filter(Boolean).join("\n");
}

/**
 * Split long text into chunks (safe for Telegram 4096)
 */
export function splitIntoChunks(input, maxLen = 3500) {
  const text = (input ?? "").toString();
  if (text.length <= maxLen) return [text];

  const chunks = [];
  const paras = text.split(/\n{2,}/);
  let buf = "";

  const pushBuf = () => {
    if (!buf) return;
    if (buf.length <= maxLen) {
      chunks.push(buf);
    } else {
      const lines = buf.split(/\n/);
      let part = "";
      for (const line of lines) {
        const candidate = part ? `${part}\n${line}` : line;
        if (candidate.length > maxLen) {
          if (part) {
            chunks.push(part);
            part = line;
          } else {
            chunks.push(trimToLimitNoMidWord(line, maxLen));
            part = "";
          }
        } else {
          part = candidate;
        }
      }
      if (part) chunks.push(part);
    }
    buf = "";
  };

  for (const p of paras) {
    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length > maxLen) {
      pushBuf();
      if (p.length > maxLen) {
        let rest = p;
        while (rest.length > maxLen) {
          chunks.push(trimToLimitNoMidWord(rest, maxLen));
          rest = rest.slice(Math.min(rest.length, maxLen));
        }
        if (rest) buf = rest;
      } else {
        buf = p;
      }
    } else {
      buf = candidate;
    }
  }
  pushBuf();
  return chunks;
}
