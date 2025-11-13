// src_clean/pipeline/utils/fs-json.js
// File-system JSON helpers kept minimal for later use.
// Note: we use node:fs/promises to be ESM-friendly.

import fs from "node:fs/promises";
import path from "node:path";

/**
 * Reads JSON file and returns parsed value (or null on any error).
 * @param {string} filePath
 * @returns {Promise<any|null>}
 */
export async function readJsonSafe(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Writes value to JSON file with pretty formatting.
 * Creates parent directory if needed.
 * @param {string} filePath
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function writeJsonPretty(filePath, value) {
  await ensureDirFor(filePath);
  const text = JSON.stringify(value, null, 2);
  await fs.writeFile(filePath, text, "utf8");
}

/**
 * Ensures directory for a given file path exists.
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}
