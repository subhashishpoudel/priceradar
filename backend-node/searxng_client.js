// ============================================================
// Cell 1: Settings
// Where SearXNG runs. Set SEARXNG_URL to override; the default
// matches searxng/docker-compose.yml.
// ============================================================
const SEARXNG_URL = process.env.SEARXNG_URL || "http://127.0.0.1:8888";
const TIMEOUT_MS = 15000;


// ============================================================
// Cell 2: Error type
// One error for every SearXNG problem, so server.js catches one
// thing and answers 503.
// ============================================================
class SearxngError extends Error {}


// ============================================================
// Cell 3: Search
// Asks SearXNG for JSON and keeps only the fields we need:
// [{ title, url, snippet, engine }].
// ============================================================
async function search(query, limit = 10) {
  const url = `${SEARXNG_URL}/search?` + new URLSearchParams({ q: query, format: "json" });
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new SearxngError(`SearXNG is not reachable at ${SEARXNG_URL}: ${e.message}`);
  }
  if (res.status === 403) {
    throw new SearxngError("SearXNG refused JSON (add 'json' to search.formats in settings.yml)");
  }
  if (!res.ok) throw new SearxngError(`SearXNG returned HTTP ${res.status}`);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new SearxngError("SearXNG sent a reply that is not JSON");
  }
  return (data.results || []).slice(0, limit).map(r => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.content || "",
    engine: r.engine || "",
  }));
}


// ============================================================
// Cell 4: Is it running?
// Quick yes/no check used by /search/status.
// ============================================================
async function isUp() {
  try {
    const res = await fetch(SEARXNG_URL + "/", { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

module.exports = { search, isUp, SearxngError, SEARXNG_URL };
