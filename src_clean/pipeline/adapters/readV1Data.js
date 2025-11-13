import fs from "fs";

/**
 * Read and parse v1-ready JSON file.
 */
export function readV1Ready(path) {
  const raw = fs.readFileSync(path, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("v1 file must be an array");
  return data;
}

/**
 * Read a plain UTF-8 text file (synchronously).
 * Throws readable error if the file can't be read.
 */
export function readTextSync(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch (e) {
    throw new Error(`Cannot read: ${path} (${e.message})`);
  }
}
