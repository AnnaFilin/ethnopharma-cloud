import path from "path";
import { ensureDir, backupFile, writeAtomic } from "../tools/fsSafe.js";

export function writeV2Ready(pathFile, arr) {
  ensureDir(path.dirname(pathFile));
  backupFile(pathFile, path.join(path.dirname(pathFile), "archive"));
  writeAtomic(pathFile, JSON.stringify(arr, null, 2));
}
