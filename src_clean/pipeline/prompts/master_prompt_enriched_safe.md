The assistant may read and reason about the full SOURCES above, but must not cite any URL outside them.

---

## Sections to produce

1. **Title**

- RU/EN common name(s) if available in SOURCES; otherwise transliteration.
- Keep it short (1–3 words).

2. **Summary**

- One–two sentences overview of what the plant is and why it is notable.
- Mention something specific from SOURCES if possible (compound, property, or cultural context).

3. **Ethnobotany**

- Describe traditional uses, geography/cultures of use, and typical preparation forms (infusion, amulet, fumigation, etc.).
- Be specific; use details from SOURCES only.

4. **Modern evidence**

- Brief, evidence-based summary of modern research (mention year, direction, or study type if available).
- Keep a neutral and factual tone; no promises.

5. **Interesting fact**

- Add one or two concise, verifiable details from SOURCES: etymology, myth, chemistry, or history.
- Avoid generic trivia; prefer vivid, informative facts.

6. **Context**

- Where/when it’s used today: supplements, teas, cosmetics, functional beverages, etc.
- Keep neutral tone and concrete forms of use.

7. **Safety**

- Include cautions or contraindications if mentioned in SOURCES.
- Otherwise write:  
  RU: «Считается безопасным при умеренном применении.»  
  EN: "Generally considered safe when used appropriately."

---

## Effects (compact)

From the provided SOURCES only, identify up to **5** scientifically supported effects of **{latin}**.

**Rules**

- Use ONLY these IDs: **{EFFECTS_VOCAB_IDS}**
- If unsure, return an empty array.
- Output effects as IDs only (no metadata, no quotes, no URLs).

---

## OUTPUT (valid JSON)

Return exactly one JSON object with the following shape:

```json
{
  "title": { "ru": "<short name ru>", "en": "<short name en>" },
  "summary": { "ru": "<~400–500 chars>", "en": "<~400–500 chars>" },
  "ethnobotany": { "ru": "<~400–500 chars>", "en": "<~400–500 chars>" },
  "modern_evidence": { "ru": "<~400–500 chars>", "en": "<~400–500 chars>" },
  "interesting_fact": { "ru": "<~300–400 chars>", "en": "<~300–400 chars>" },
  "context": { "ru": "<~350–450 chars>", "en": "<~350–450 chars>" },
  "safety": { "ru": "<~250–350 chars>", "en": "<~250–350 chars>" },
  "effects": [
    "<effect_id>",
    "<effect_id>",
    "<effect_id>",
    "<effect_id>",
    "<effect_id>"
  ]
}
```
