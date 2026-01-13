import { getFirestore } from "firebase-admin/firestore";

// Wrap plain strings into { ru: ... }
function asLangObj(v) {
  if (!v) return {};
  if (typeof v === "string") return { ru: v };
  if (typeof v === "object") return v;
  return {};
}

// For fields like summary/ethnobotany/... also check *_ru / *_en fallbacks
function asLangObjWithFallback(c, key) {
  const base = asLangObj(c[key]);
  if (base.ru || base.en) return base;
  const ru = c[`${key}_ru`] || c[`${key}Ru`] || c[`${key}__ru`];
  const en = c[`${key}_en`] || c[`${key}En`] || c[`${key}__en`];
  const out = {};
  if (ru) out.ru = String(ru);
  if (en) out.en = String(en);
  return Object.keys(out).length ? out : base;
}

export async function loadCards() {
  const db = getFirestore();
  const snap = await db.collection("cards").get();
  const out = [];

  snap.forEach((doc) => {
    const raw = doc.data() || {};

    const c =
      raw.payload && typeof raw.payload === "object"
        ? { ...raw, ...raw.payload }
        : raw;

    // title can be object OR split fields
    const titleObj = asLangObj(c.title);
    const title =
      (titleObj.ru || titleObj.en)
        ? titleObj
        : (() => {
            const ru = c.title_ru || c.name_ru || c.titleRu || c.nameRu;
            const en = c.title_en || c.name_en || c.titleEn || c.nameEn;
            const o = {};
            if (ru) o.ru = String(ru);
            if (en) o.en = String(en);
            return o;
          })();

    const normalized = {
      docId: doc.id,
      title,
      latin: c.latin || "",

      lastPostedAt: c.lastPostedAt || null,
      cooldownDays: c.cooldownDays || 60,
      disabled: !!c.disabled,

      // narrative sections with *_ru/*_en fallbacks
      summary:          asLangObjWithFallback(c, "summary"),
      ethnobotany:      asLangObjWithFallback(c, "ethnobotany"),
      modern_evidence:  asLangObjWithFallback(c, "modern_evidence"),
      interesting_fact: asLangObjWithFallback(c, "interesting_fact"),
      context:          asLangObjWithFallback(c, "context"),
      safety:           asLangObjWithFallback(c, "safety"),

      effects:   Array.isArray(c.effects)  ? c.effects  : [],
      sources:   Array.isArray(c.sources)  ? c.sources  : [],
      tags:      Array.isArray(c.tags)     ? c.tags     : (typeof c.tags === "object" ? c.tags : []),
      affiliate: c.affiliate || {},

      // ensure direct URL exists for image
      image_url:
        (c.image && typeof c.image.url === "string" ? c.image.url : "") ||
        c.illustration_url ||
        c.botanical_url ||
        c.image_url ||
        "",

      // keep original image object if any
      image: c.image || null,

      status: c.status ?? "ready",
    };

    out.push(normalized);
  });

  console.log("[loadCards] loaded", out.length, "cards");
  return out;
}
