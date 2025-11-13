// ethno-pipeline-v2/steps/03_enrichNarrative.js
// Build prompt from master_prompt.md (+ inject effects vocab IDs) and optionally call the LLM.
// ESM only. Comments in English.

import fs from "fs/promises";
import { readTextSync } from "../adapters/readV1Data.js";
import { toJSONString } from "../utils/json-parse.js";

/** Replace only the {EFFECTS_VOCAB_IDS} placeholder; do NOT inject any blocks. */
function ensureEffectsInPrompt(promptText, effectIdsCsv) {
  if (typeof promptText !== "string") return "";
  return promptText.replaceAll("{EFFECTS_VOCAB_IDS}", effectIdsCsv);
}

/** Load effect IDs as a CSV list from config/effects_vocab.json. */
async function loadEffectIdsCsv(effectsVocabPath) {
  try {
    const raw = await fs.readFile(effectsVocabPath, "utf8");
    const vocab = JSON.parse(raw);
    const ids = Object.keys(vocab);
    if (!ids.length) throw new Error("effects_vocab.json is empty");
    return ids.join(", ");
  } catch (e) {
    console.warn(
      `[enrichNarrative] WARN: cannot load effects vocab at ${effectsVocabPath}: ${e.message}`
    );
    // Minimal fallback to keep the prompt valid
    return "adaptogenic, anti-inflammatory, antioxidant, cognitive-support, immunomodulatory, anxiolytic, fatigue-resistance";
  }
}

/**
 * Build final prompt by replacing placeholders:
 * - {latin}
 * - {sources_json_array}
 * - {EFFECTS_VOCAB_IDS}
 */
export async function buildNarrativePrompt({
  latin,
  sources = [],
  promptPath = "./ethno-pipeline-v2/prompts/master_prompt.md",
  effectsVocabPath = "./ethno-pipeline-v2/config/effects_vocab.json",
} = {}) {
  if (!latin) throw new Error("buildNarrativePrompt: 'latin' is required");

  // 1) Base prompt from MD
  console.log("[DEBUG promptPath] Using:", promptPath);
  let promptText = readTextSync(promptPath);

  // 2) Replace base placeholders
  const sourcesJsonArray = toJSONString(sources);
  promptText = promptText.split("{latin}").join(latin);
  promptText = promptText.split("{sources_json_array}").join(sourcesJsonArray);

  // 3) Inject effects vocab IDs (IDs only, no extra blocks)
  const idsCsv = await loadEffectIdsCsv(effectsVocabPath);
  promptText = ensureEffectsInPrompt(promptText, idsCsv);

  return promptText;
}

/**
 * Call the model (if apiKey present) to get narrative JSON with effects (IDs only).
 * If no apiKey or in dryRun mode, returns { prompt, dryRun: true } for inspection.
 */
export async function enrichNarrative({
  latin,
  sources = [],
  promptPath = "./ethno-pipeline-v2/prompts/master_prompt.md",
  effectsVocabPath = "./ethno-pipeline-v2/config/effects_vocab.json",
  model = process.env.OPENAI_MODEL || "gpt-4o-mini",
  temperature = 0.2,
  apiKey = process.env.OPENAI_API_KEY,
  timeoutMs = 45000,
  dryRun = false,
} = {}) {
  const prompt = await buildNarrativePrompt({
    latin,
    sources,
    promptPath,
    effectsVocabPath,
  });

  if (!apiKey || dryRun) {
    // No network call — return the prompt so the caller can inspect it.
    return { prompt, dryRun: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an ethnobotany writer. Respond ONLY with a single valid JSON object exactly matching the requested OUTPUT schema.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `[OpenAI] HTTP ${res.status} ${res.statusText} ${errText}`
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "{}";

    let json;
    try {
      json = JSON.parse(content);
    } catch {
      return { prompt, raw: content, error: "invalid_json_from_model" };
    }

    // Minimal shape check: 6 mandatory sections with ru/en; effects is an array (0..5 IDs)
    const must = [
      "title",
      "summary",
      "ethnobotany",
      "modern_evidence",
      "interesting_fact",
      "context",
      "safety",
    ];
    const okShape =
      must.every((k) => json?.[k]?.ru && json?.[k]?.en) &&
      Array.isArray(json?.effects ?? []);

    if (!okShape) {
      return { prompt, json, warning: "incomplete_json_fields" };
    }

    return json;
  } catch (e) {
    return { prompt, error: String(e?.message || e) };
  }
}
