// src_clean/pipeline/utils/logger.js
// Minimal logger with opt-in debug namespaces.
// Usage idea (later):
//   import { info, warn, error, debug } from "./utils/logger.js";
//   info("message"); debug("images", "input:", data);

const DEBUG_ENV = process.env.DEBUG || ""; // e.g. "images,fetch" or "all"
const namespaces = new Set(
  DEBUG_ENV.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

function isEnabled(ns) {
  if (!ns) return false;
  if (namespaces.has("all")) return true;
  return namespaces.has(ns);
}

export function info(...args) {
  // Keep info concise in production logs
  console.info(...args);
}

export function warn(...args) {
  console.warn(...args);
}

export function error(...args) {
  console.error(...args);
}

export function debug(ns, ...args) {
  if (isEnabled(ns)) {
    // Prefix debug lines with namespace for clarity
    console.log(`[debug:${ns}]`, ...args);
  }
}
