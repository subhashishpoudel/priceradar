// ============================================================
// Cell 1: Settings
// Where Firecrawl runs. Set FIRECRAWL_URL to override; the default
// matches firecrawl/firecrawl/docker-compose.yaml (port 3002).
// A local install with USE_DB_AUTHENTICATION=false needs no API key;
// set FIRECRAWL_API_KEY only if you turn authentication on.
// ============================================================
const FIRECRAWL_URL = process.env.FIRECRAWL_URL || "http://127.0.0.1:3002";
const API_KEY = process.env.FIRECRAWL_API_KEY || "";
const TIMEOUT_MS = 60000; // JavaScript-heavy pages can take a while


// ============================================================
// Cell 2: Error type
// One error for every Firecrawl problem, so server.js catches
// one thing and answers 503.
// ============================================================
class FirecrawlError extends Error {}


// ============================================================
// Cell 3: Scrape one page
// POST /v2/scrape renders the page in a real browser and returns
// clean content. Returns { url, title, statusCode, markdown, html }.
// "html" is only included when asked for (needed for price
// extraction later); markdown is the default.
// ============================================================
async function scrape(pageUrl, formats = ["markdown"]) {
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = "Bearer " + API_KEY;

  let res;
  try {
    res = await fetch(FIRECRAWL_URL + "/v2/scrape", {
      method: "POST",
      headers,
      body: JSON.stringify({ url: pageUrl, formats, onlyMainContent: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new FirecrawlError(`Firecrawl is not reachable at ${FIRECRAWL_URL}: ${e.message}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new FirecrawlError(`Firecrawl sent a reply that is not JSON (HTTP ${res.status})`);
  }
  if (!res.ok || data.success === false) {
    throw new FirecrawlError(data.error || `Firecrawl returned HTTP ${res.status}`);
  }

  const d = data.data || {};
  const meta = d.metadata || {};
  return {
    url: meta.sourceURL || meta.url || pageUrl,
    title: meta.title || "",
    statusCode: meta.statusCode ?? null,
    markdown: d.markdown || "",
    html: d.html || "",
  };
}


// ============================================================
// Cell 4: Is it running?
// Quick yes/no check used by /scrape/status. The Firecrawl API
// answers a short greeting at its root address.
// ============================================================
async function isUp() {
  try {
    const res = await fetch(FIRECRAWL_URL + "/", { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

module.exports = { scrape, isUp, FirecrawlError, FIRECRAWL_URL };
