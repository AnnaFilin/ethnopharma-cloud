// Safe FS helpers: backups and atomic writes (ESM)
import fs from "fs";
import path from "path";

export function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(
    d.getHours()
  )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export function backupFile(srcPath, dstDir) {
  ensureDir(dstDir);
  if (!fs.existsSync(srcPath)) return null;
  const base = path.basename(srcPath);
  const bkp = path.join(dstDir, `${timestamp()}.${base}`);
  fs.copyFileSync(srcPath, bkp);
  return bkp;
}

export function writeAtomic(dstPath, data) {
  const tmp = `${dstPath}.tmp`;
  fs.writeFileSync(tmp, data, "utf8");
  fs.renameSync(tmp, dstPath);
}
