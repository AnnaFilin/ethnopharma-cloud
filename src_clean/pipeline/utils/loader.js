// // utils/loader.js
// // Dynamic import helpers for pipeline steps.

// import { pathToFileURL } from "node:url";

// /**
//  * Dynamically loads a module and returns one of candidate functions.
//  * @param {string} absFilePath
//  * @param {string[]} candidateNames
//  * @param {Function|null} fallback
//  * @returns {Promise<Function|null>}
//  */
// export async function loadFn(
//   absFilePath,
//   candidateNames = [],
//   fallback = null
// ) {
//   const href = pathToFileURL(absFilePath).href;
//   try {
//     const mod = await import(href);
//     const cand = [...candidateNames, "default"];
//     for (const name of cand) {
//       const fn = mod[name];
//       if (typeof fn === "function") return fn;
//     }
//   } catch (e) {
//     console.warn(`[loader] Failed to import ${absFilePath}:`, e?.message);
//   }
//   return fallback;
// }

// /**
//  * Loads a module function if it exists, otherwise returns fallback.
//  * @param {string} abs
//  * @param {string[]} names
//  * @param {Function} fallback
//  * @returns {Promise<Function>}
//  */
// export async function loadOptionalFn(abs, names = [], fallback = (x) => x) {
//   const fn = await loadFn(abs, names, null);
//   return fn || fallback;
// }
// utils/loader.js
// Dynamic import helpers for pipeline steps.

import { pathToFileURL } from "node:url";
import { warn } from "./logger.js";

/**
 * Dynamically imports a module and returns one of the specified functions.
 * @param {string} absFilePath
 * @param {string[]} candidateNames
 * @param {Function|null} fallback
 * @returns {Promise<Function|null>}
 */
export async function loadFn(
  absFilePath,
  candidateNames = [],
  fallback = null
) {
  const href = pathToFileURL(absFilePath).href;
  try {
    const mod = await import(href);
    const cand = [...candidateNames, "default"];
    for (const name of cand) {
      const fn = mod[name];
      if (typeof fn === "function") return fn;
    }
  } catch (e) {
    warn(`[loader] Failed to import ${absFilePath}: ${e?.message}`);
  }
  return fallback;
}

/**
 * Loads a function if the module exists, otherwise returns a fallback.
 * @param {string} abs
 * @param {string[]} names
 * @param {Function} fallback
 * @returns {Promise<Function>}
 */
export async function loadOptionalFn(abs, names = [], fallback = (x) => x) {
  const fn = await loadFn(abs, names, null);
  return fn || fallback;
}
