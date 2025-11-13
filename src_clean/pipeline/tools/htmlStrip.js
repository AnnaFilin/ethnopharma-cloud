// Very conservative HTML stripper (ESM)
export function stripHtml(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}
