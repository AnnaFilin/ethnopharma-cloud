const http = require("http");

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

// --- Minimal HTTP helpers (no extra deps) ---
function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

// --- Core logic (kept from your function handler) ---
async function handleDiscoverCandidates(req, res) {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method Not Allowed" });
      return;
    }

    const body = await readJsonBody(req);
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
    const raw = await generateRawList(cfg.provider, {
      prompt: cfg.prompt,
      excludeList,
      model: cfg.model,
    });

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

    sendJson(res, 200, response);
  } catch (err) {
    console.error("discover-candidates error:", err);
    sendJson(res, 500, { error: String((err && err.message) || err) });
  }
}

// --- Cloud Run entrypoint: listen on PORT ---
const PORT = Number(process.env.PORT) || 8080;

const server = http.createServer(async (req, res) => {
  // Single endpoint behavior (same as before): POST /
  if (req.url === "/" || req.url === "") {
    await handleDiscoverCandidates(req, res);
    return;
  }
  sendJson(res, 404, { error: "Not Found" });
});

server.listen(PORT, () => {
  console.log(`[discover-candidates] listening on ${PORT}`);
});
