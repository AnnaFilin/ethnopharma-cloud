// // utils/sanitizePrompt.js
// // Cleans a master prompt file from unnecessary sections.

// import fs from "node:fs/promises";

// /**
//  * Sanitizes the master prompt file and writes a relaxed version.
//  * @param {string} srcPath
//  * @returns {Promise<string>} path to relaxed file
//  */
// export async function sanitizePromptFile(srcPath) {
//   try {
//     const raw = await fs.readFile(srcPath, "utf8");
//     const cleaned = raw
//       .replace(
//         /#\s*GUARDED INPUT[\s\S]*?(?=^TASK|^LANGUAGE|^OUTPUT SCHEMA|$)/gim,
//         ""
//       )
//       .replace(
//         /STRICT IDENTITY RULE[\s\S]*?(?=^STYLE|^LANGUAGE|^OUTPUT SCHEMA|^TASK|$)/gim,
//         ""
//       )
//       .replace(/PLANT_LATIN\s*=.*$/gim, "")
//       .replace(/ACCEPTABLE_SYNONYMS\s*=.*$/gim, "")
//       .replace(/PLANT_MISMATCH/gi, "");
//     const relaxedPath = srcPath.replace(/\.md$/i, ".relaxed.md");
//     await fs.writeFile(relaxedPath, cleaned, "utf8");
//     return relaxedPath;
//   } catch (e) {
//     console.warn("[prompt] sanitize failed, using original:", e?.message);
//     return srcPath;
//   }
// }
// utils/sanitizePrompt.js
// Removes guarded sections from the master prompt to produce a relaxed version.

import fs from "node:fs/promises";
import { warn } from "./logger.js";

/**
 * Sanitizes the master prompt file and writes a relaxed copy.
 * @param {string} srcPath
 * @returns {Promise<string>} - path to the relaxed file
 */
export async function sanitizePromptFile(srcPath) {
  try {
    const raw = await fs.readFile(srcPath, "utf8");
    const cleaned = raw
      .replace(
        /#\s*GUARDED INPUT[\s\S]*?(?=^TASK|^LANGUAGE|^OUTPUT SCHEMA|$)/gim,
        ""
      )
      .replace(
        /STRICT IDENTITY RULE[\s\S]*?(?=^STYLE|^LANGUAGE|^OUTPUT SCHEMA|^TASK|$)/gim,
        ""
      )
      .replace(/PLANT_LATIN\s*=.*$/gim, "")
      .replace(/ACCEPTABLE_SYNONYMS\s*=.*$/gim, "")
      .replace(/PLANT_MISMATCH/gi, "");
    const relaxedPath = srcPath.replace(/\.md$/i, ".relaxed.md");
    await fs.writeFile(relaxedPath, cleaned, "utf8");
    return relaxedPath;
  } catch (e) {
    warn(`[prompt] sanitize failed, using original: ${e?.message}`);
    return srcPath;
  }
}
