const { db } = require("./firestore.js");

const HISTORY_CAP = 500; // keep only the latest N history items

async function loadConfig() {
  const snap = await db.collection("settings").doc("discover_config").get();
  if (!snap.exists) {
    return {
      prompt: "",
      maxNewPerRun: 20,
      provider: "test",
      filters: {
        excludeGenera: [],
        excludeSpecies: [],
        allowGenera: [],
        lang: "la",
      },
      historySpecies: [],
      lastRunAt: null,
    };
  }
  const data = snap.data();
  return {
    prompt: data.prompt || "",
    maxNewPerRun: Number.isFinite(data.maxNewPerRun) ? data.maxNewPerRun : 20,
    provider: data.provider || "test",
    filters: {
      excludeGenera: Array.isArray(data?.filters?.excludeGenera)
        ? data.filters.excludeGenera
        : [],
      excludeSpecies: Array.isArray(data?.filters?.excludeSpecies)
        ? data.filters.excludeSpecies
        : [],
      allowGenera: Array.isArray(data?.filters?.allowGenera)
        ? data.filters.allowGenera
        : [],
      lang: data?.filters?.lang || "la",
    },
    historySpecies: Array.isArray(data.historySpecies)
      ? data.historySpecies
      : [],
    model: data.model || undefined,
    lastRunAt: data.lastRunAt || null,
  };
}

function mergeConfig(base, overrideBody = {}) {
  const out = { ...base };
  if (overrideBody.prompt) out.prompt = overrideBody.prompt;
  if (Number.isFinite(overrideBody.maxNew))
    out.maxNewPerRun = overrideBody.maxNew;
  if (overrideBody.provider) out.provider = overrideBody.provider;
  if (overrideBody.filters) {
    out.filters = {
      ...base.filters,
      ...overrideBody.filters,
      excludeGenera:
        overrideBody.filters.excludeGenera ?? base.filters.excludeGenera ?? [],
      excludeSpecies:
        overrideBody.filters.excludeSpecies ??
        base.filters.excludeSpecies ??
        [],
      allowGenera:
        overrideBody.filters.allowGenera ?? base.filters.allowGenera ?? [],
      lang: overrideBody.filters.lang ?? base.filters.lang ?? "la",
    };
  }
  return out;
}

module.exports = { HISTORY_CAP, loadConfig, mergeConfig };
