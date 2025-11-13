const { FieldValue } = require("firebase-admin/firestore");
const {
  db,
  readExistingSets,
  persistCandidates,
} = require("./utils/firestore.js");
const { loadConfig, mergeConfig, HISTORY_CAP } = require("./utils/config.js");
const {
  titleCaseLatin,
  snakeIdFromLatin,
  validateLatin,
  cleanLineToLatin,
} = require("./utils/latin.js");
const { generateRawList } = require("./utils/openai.js");

// Optional helpers for prompt shaping (currently not used in production flow)
// const { makeAvoidList, injectAvoidIntoPrompt } = require("./utils/prompt.js");

/**
 * Cloud Function: discoverCandidates
 * ----------------------------------
 * Generates and saves new ethnobotanical candidate species
 * based on current Firestore data and dynamic AI generation.
 *
 * HTTP method: POST
 * Params (JSON body):
 *   - dryRun: boolean (optional)
 *   - provider: 'openai' | 'test'
 *   - prompt: custom prompt text
 *   - model: optional model name
 */
exports.discoverCandidates = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const body = typeof req.body === "object" && req.body ? req.body : {};
    const dryRun = !!body.dryRun;

    const baseCfg = await loadConfig();
    const cfg = mergeConfig(baseCfg, body);

    // 1️⃣ Gather existing data
    const { existingLatin, existingIds } = await readExistingSets();

    // Combine existing + history to guide model
    const excludeList = Array.from(
      new Set([...Array.from(existingLatin), ...(cfg.historySpecies || [])])
    );

    // 2️⃣ Generate candidates
    // (Current production prompt logic — no avoid-list injection)
    const raw = await generateRawList(cfg.provider, {
      prompt: cfg.prompt,
      excludeList,
      model: cfg.model,
    });

    /**
     * 🔸 Alternative (commented out):
     * To re-enable explicit avoid-list injection from utils/prompt.js:
     *
     * const avoidListCsv = makeAvoidList(existingLatin, 150);
     * const basePrompt =
     *   cfg.prompt ||
     *   "Medicinal ethnobotanical species traditionally used in world folk medicine; avoid toxic; 10–20 items.";
     * const promptWithAvoid = injectAvoidIntoPrompt(basePrompt, avoidListCsv);
     *
     * const raw = await generateRawList(cfg.provider, {
     *   prompt: promptWithAvoid,
     *   excludeList,
     *   model: cfg.model,
     * });
     */

    // 3️⃣ Parse and normalize output
    const proposedList = (raw || [])
      .map(cleanLineToLatin)
      .filter(Boolean)
      .map(titleCaseLatin);

    const valid = [];
    const invalid = [];
    for (const lat of proposedList) {
      if (validateLatin(lat)) valid.push(lat);
      else invalid.push(lat);
    }

    // 4️⃣ Deduplicate and limit by config
    const deduped = valid.filter((lat) => {
      const id = snakeIdFromLatin(lat);
      return !existingLatin.has(lat) && !existingIds.has(id);
    });

    const limit = Math.max(0, Number(cfg.maxNewPerRun) || 0);
    const toAdd = limit ? deduped.slice(0, limit) : deduped;

    // 5️⃣ Persist results
    let added = 0;
    if (!dryRun && toAdd.length) {
      added = await persistCandidates(toAdd);

      await db
        .collection("settings")
        .doc("discover_config")
        .set(
          {
            lastRunAt: FieldValue.serverTimestamp(),
            historySpecies: Array.from(
              new Set([...cfg.historySpecies, ...valid])
            ).slice(-HISTORY_CAP),
          },
          { merge: true }
        );
    }

    // 6️⃣ Response
    const response = {
      prompt: cfg.prompt || null,
      proposed: proposedList.length,
      added,
      skippedDuplicates: valid.length - deduped.length,
      invalid,
      addedItems: toAdd,
      dryRun,
      runId: `discover_${new Date().toISOString()}`,
    };

    console.log(
      "[discover-candidates]",
      JSON.stringify({
        proposed: response.proposed,
        added: response.added,
        skippedDuplicates: response.skippedDuplicates,
        invalid: response.invalid.length,
        limit,
        dryRun,
      })
    );

    res.status(200).json(response);
  } catch (err) {
    console.error("discover-candidates error:", err);
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
