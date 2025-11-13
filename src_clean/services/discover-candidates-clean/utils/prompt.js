function makeAvoidList(existingLatinSet, cap = 150) {
  const arr = Array.from(existingLatinSet || []);
  return arr.slice(0, cap).join(", ");
}

function injectAvoidIntoPrompt(promptText, avoidCsv) {
  const base = promptText || "";
  if (!avoidCsv) return base;
  return `${base}\n\nAvoid these species: ${avoidCsv}`;
}

module.exports = { makeAvoidList, injectAvoidIntoPrompt };
