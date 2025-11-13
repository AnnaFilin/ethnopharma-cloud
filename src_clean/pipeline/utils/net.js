// src_clean/utils/net.js
// Network and URL utilities for EthnoPharma pipeline.

/**
 * Extract hostname safely from a URL string.
 * Removes 'www.' prefix and returns '' on invalid input.
 */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Fetch a page title for sanity check.
 * Optional step — used mainly for debugging or metadata enrichment.
 * Aborts request if timeout is exceeded.
 */
export async function fetchTitle(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "EthnoPipeline/2 (+node)" },
    });

    if (!res?.ok) return null;

    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match && match[1] ? match[1].trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
