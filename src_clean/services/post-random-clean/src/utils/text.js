export function normalizeText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(normalizeText).filter(Boolean).join(" ");
  if (typeof v === "object") {
    // bi-objects
    if (typeof v.ru === "string" || typeof v.en === "string") {
      return normalizeText(v.ru ?? v.en ?? "");
    }
    if (typeof v.text === "string") return v.text;
    try {
      return Object.values(v).map(normalizeText).filter(Boolean).join(" ");
    } catch {
      return "";
    }
  }
  return "";
}

export function truncate(s, max) {
  const t = normalizeText(s).trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

export function formatSources(sourcesLike, limit = 3) {
  if (!sourcesLike) return "";
  if (Array.isArray(sourcesLike)) {
    // object sources {title,url,type}
    const objs = sourcesLike
      .map((x) => {
        if (!x) return "";
        if (typeof x === "string") return x;
        if (typeof x === "object") {
          if (x.title && x.url) return `${x.title} (${x.url})`;
          if (x.url) return x.url;
          return normalizeText(x);
        }
        return normalizeText(x);
      })
      .filter(Boolean);
    return objs.slice(0, limit).join("; ");
  }
  return normalizeText(sourcesLike);
}

/** pick title (bi + legacy) */
export function pickTitle(card, lang = "ru") {
  const ru = normalizeText(
    card.title_ru || (card.title && card.title.ru) || card.title
  );
  const en = normalizeText(
    card.title_en || (card.title && card.title.en) || card.title
  );
  const latin = normalizeText(card.latin);
  const base = lang === "en" ? en || ru : ru || en;
  return latin ? `${base} (${latin})` : base;
}
