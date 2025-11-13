// Uses Node 20/22 global fetch on Cloud Run
async function generateRawList(provider, { prompt, excludeList, model }) {
  if (provider === "test") {
    if (prompt && prompt.includes("\n")) {
      return prompt
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[discover-candidates] OPENAI_API_KEY is missing");
      return [];
    }

    const regions = [
      "Amazonian and Andean folk medicine",
      "African ethnomedicine",
      "Ayurvedic and Tibetan traditions",
      "Polynesian and Oceanic healing plants",
      "Native North American herbalism",
      "European medieval and monastic herbals",
      "Central Asian steppe traditions",
      "Middle Eastern and Persian medicine",
      "Chinese traditional folk medicine",
    ];
    const randomRegion = regions[Math.floor(Math.random() * regions.length)];

    const sample = Array.isArray(excludeList)
      ? excludeList
          .slice()
          .sort(() => 0.5 - Math.random())
          .slice(0, 30)
      : [];

    const systemPromptA = [
      "You are an ethnobotanical research assistant.",
      "Output ONLY a newline-separated list of valid Latin binomial plant names.",
      "No numbering, no comments, no parentheses, no synonyms.",
      "Return a name ONLY if the species has documented traditional medicinal OR ritual use in a named folk/indigenous tradition.",
      "If you are not reasonably certain, omit it.",
      "Do NOT include plants used only as food, fiber, dye, timber, spice, or ornamentals without medicinal/ritual use.",
      "Do not repeat any species listed as 'already known'.",
    ].join(" ");

    const userPromptA = [
      prompt && prompt.trim().length
        ? prompt.trim()
        : `Find 10–30 lesser-known medicinal plants used in folk or ritual medicine of ${randomRegion}.`,
      "Return ONLY species with documented traditional use (healing, protective, ceremonial, divinatory, etc.) in a named tradition/region.",
      "Avoid toxic or dangerous species and mainstream global staples.",
      sample.length
        ? `These are examples of species already known to me: ${sample.join(
            ", "
          )}`
        : "",
      "Do not repeat any of them.",
    ]
      .filter(Boolean)
      .join("\n");

    const useModel = model || "gpt-4o-mini";

    async function callOpenAI(inputText, temperature = 0.2, maxTokens = 700) {
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: useModel,
          temperature,
          max_output_tokens: maxTokens,
          input: inputText,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error("[discover-candidates][openai] HTTP", resp.status, text);
        return "";
      }
      const data = await resp.json();
      return (
        data.output_text ||
        (data.output &&
          data.output[0] &&
          data.output[0].content &&
          data.output[0].content[0] &&
          data.output[0].content[0].text) ||
        ""
      );
    }

    try {
      const firstInput = `${systemPromptA}\n\n${userPromptA}`;
      const firstOut = await callOpenAI(firstInput, 0.25, 800);
      if (!firstOut) {
        console.warn("[discover-candidates][openai] empty output_text (A)");
        return [];
      }

      const firstList = firstOut
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!firstList.length) return [];

      const systemPromptB = [
        "You strictly filter a given list of Latin plant names.",
        "Output ONLY those species that have documented traditional medicinal OR ritual use in named folk/indigenous traditions.",
        "Return ONLY a newline-separated list of Latin binomials from the provided list; no new names, no comments.",
      ].join(" ");

      const userPromptB = [
        "From the following list, keep ONLY those with documented ethnomedicinal or ritual use in specific traditions.",
        "If uncertain about any item, drop it.",
        "List:",
        firstList.join("\n"),
      ].join("\n");

      const secondOut = await callOpenAI(
        `${systemPromptB}\n\n${userPromptB}`,
        0.15,
        700
      );
      if (!secondOut) return firstList;

      const filtered = secondOut
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return filtered.length ? filtered : firstList;
    } catch (e) {
      console.error("[discover-candidates][openai] error:", e);
      return [];
    }
  }

  return [];
}

module.exports = { generateRawList };
