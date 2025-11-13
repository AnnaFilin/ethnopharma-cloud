// Audits v1 ready-cards against v2 contract & business rules (ESM)
import fs from "fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function auditV1AgainstV2({
  v1Path,
  schemaPath,
  allowlistPath,
  effectsVocabPath,
  outPath,
}) {
  const cards = readJson(v1Path);
  const schema = readJson(schemaPath);
  const allow = new Set(readJson(allowlistPath));
  const vocab = new Set(Object.keys(readJson(effectsVocabPath)));

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const report = [];
  let ok = 0;

  for (const c of cards) {
    const item = { latin: c.latin, issues: [] };

    const clone = JSON.parse(JSON.stringify(c));
    if (!clone.category) clone.category = "plant";
    if (!clone.status) clone.status = "ready";

    if (!validate(clone)) {
      item.issues.push({ type: "schema", errors: validate.errors });
    }

    const badSources = (clone.sources || []).filter(
      (s) => !allow.has(domainOf(s.url))
    );
    if (badSources.length)
      item.issues.push({ type: "sources.allowlist", count: badSources.length });

    if (!clone.sources || clone.sources.length < 2) {
      item.issues.push({
        type: "sources.count",
        value: clone.sources ? clone.sources.length : 0,
      });
    }

    const eff = clone.effects || [];
    if (!Array.isArray(eff) || eff.length === 0) {
      item.issues.push({ type: "effects.empty" });
    } else {
      const unknown = eff.filter((e) => !vocab.has(e));
      if (unknown.length)
        item.issues.push({ type: "effects.unknown", values: unknown });
    }

    const sections = [
      "title",
      "summary",
      "ethnobotany",
      "modern_evidence",
      "interesting_fact",
      "context",
      "safety",
    ];
    for (const sec of sections) {
      const v = clone[sec];
      if (
        !v ||
        typeof v !== "object" ||
        !v.ru ||
        !v.en ||
        !String(v.ru).trim() ||
        !String(v.en).trim()
      ) {
        item.issues.push({ type: `section.${sec}.missing_or_empty` });
      }
    }

    const img = clone.image || {};
    if (!img.url || !img.credit || !img.license || img.status !== "ok") {
      item.issues.push({ type: "image.incomplete" });
    }

    const aff = clone.affiliate || {};
    const note = aff.note || {};
    if (
      aff.vendor !== "iHerb" ||
      !aff.url ||
      !aff.product_url ||
      !note.ru ||
      !note.en ||
      !note.he
    ) {
      item.issues.push({ type: "affiliate.incomplete" });
    }

    if (!Array.isArray(clone.tags))
      item.issues.push({ type: "tags.not_array" });

    if (item.issues.length === 0) ok += 1;
    report.push(item);
  }

  fs.writeFileSync(
    outPath,
    JSON.stringify(
      { total: cards.length, ready_like: ok, items: report },
      null,
      2
    )
  );
  return { total: cards.length, ready_like: ok };
}
