function titleCaseLatin(s) {
  if (!s || typeof s !== "string") return "";
  const parts = s.trim().replace(/\s+/g, " ").split(" ");
  return parts
    .map((w, i) =>
      i === 0
        ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        : w.toLowerCase()
    )
    .join(" ");
}

function snakeIdFromLatin(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function validateLatin(s) {
  return /^[A-Z][a-z]+(?:\s+[a-z\-]+){1,2}$/.test(s);
}

function cleanLineToLatin(line) {
  if (!line) return "";
  let s = String(line)
    .replace(/^[\s*\-\d\.\)\]]+\s*/, "")
    .replace(/\s*\(.*?\)\s*$/, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[;,]+$/, "").trim();
  return titleCaseLatin(s);
}

module.exports = {
  titleCaseLatin,
  snakeIdFromLatin,
  validateLatin,
  cleanLineToLatin,
};
