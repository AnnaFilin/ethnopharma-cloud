# 🧭 Pipeline Steps Overview

This document outlines the processing steps that compose the **EthnoPharma content pipeline**.  
Each step performs a specific transformation or enrichment on the candidate plant data.  
The goal of this map is to provide a high-level understanding of inputs, outputs, and helper functions used in each module.

---

## 01_findCandidates.js

**Purpose:**  
Identifies potential plant candidates for further processing.  
Usually filters, validates, and normalizes initial data.

**Input:**

- Raw plant list / discovery query  
  **Output:**
- Array of normalized candidate objects

**Helpers:**

- `normalizeLatin()`
- `validateCandidateShape()`
- `deduplicateCandidates()`

---

## 02_fetchSources.js

**Purpose:**  
Collects ethnobotanical and scientific source material for each candidate.

**Input:**

- Candidate object  
  **Output:**
- Array of source documents (URLs, texts, metadata)

**Helpers:**

- `fetchUrl()`
- `extractTextFromHtml()`
- `validateSource()`

---

## 03_enrichNarrative.js

**Purpose:**  
Generates bilingual narrative sections (summary, ethnobotany, evidence, etc.) using LLM prompts.

**Input:**

- Source documents  
  **Output:**
- Structured narrative object

**Helpers:**

- `buildPrompt()`
- `sanitizePromptFile()`
- `validateCardShape()`

---

## 04_extractEffects.js

**Purpose:**  
Parses text to extract biological or psychological effects.

**Input:**

- Narrative text  
  **Output:**
- Array of standardized effects

**Helpers:**

- `matchEffectsVocabulary()`
- `normalizeEffectLabels()`

---

## 05_pickImage.js

**Purpose:**  
Finds a suitable image for the plant using iNaturalist or similar sources.

**Input:**

- Candidate object  
  **Output:**
- `{ url, credit, license, status }`

**Helpers:**

- `inatImage()`
- `normalizeImageResult()`

---

## 06_affiliate.js

**Purpose:**  
Attaches affiliate links (e.g. iHerb) if matching products are found.

**Input:**

- Candidate or card object  
  **Output:**
- Same object enriched with `affiliate` section

**Helpers:**

- `findAffiliate()`
- `iherbAffiliate()`

---

## 07_normalize.js

**Purpose:**  
Unifies structure and ensures consistent key naming across the card payload.

**Input:**

- Raw card object  
  **Output:**
- Normalized card ready for quality check

**Helpers:**

- `normalizeLatin()`
- `applySchemaDefaults()`

---

## 08_qualityGate.js

**Purpose:**  
Performs validation before the card is written to Firestore.

**Input:**

- Normalized card  
  **Output:**
- Boolean or `{ ok, reason }`

**Helpers:**

- `validateCardShape()`
- `hasRuEn()`

---

## 09_assignPlantId.js

**Purpose:**  
Generates unique `plant_id` and slug identifiers for Firestore storage.

**Input:**

- Validated card  
  **Output:**
- Same card with `plant_id` and `latin_id`

**Helpers:**

- `plantIdFromLatin()`
- `latinToFirestoreId()`

---

## 10_post.js

**Purpose:**  
Posts or saves the completed ethnobotanical card to Firestore or external systems.

**Input:**

- Final card object  
  **Output:**
- Confirmation / Firestore document reference

**Helpers:**

- `saveCardToFirestore()`
- `markCandidateHasCard()`
- `unlockCandidate()`

---

### Notes

- Each step is executed sequentially by the orchestrator (`index.cleaned.js`).
- Shared helper functions should be extracted to `/utils` or `/services` to maintain modularity.
- Each step must be idempotent and safely runnable under `--dryRun` mode.
