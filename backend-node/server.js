// ============================================================
// Cell 1: Imports
// Node's built-in web server, our database helper, and the
// SearXNG client. No packages to install.
// ============================================================
const http = require("node:http");
const { count } = require("./database");
const searxng = require("./searxng_client");
const firecrawl = require("./firecrawl_client");
const { extractPrices } = require("./prices");


// ============================================================
// Cell 2: Settings
// Port 8000 matches the old Python server, so the frontend
// (API_BASE in app.js) works without changes.
// ============================================================
const PORT = Number(process.env.PORT) || 8000;
const HOST = "127.0.0.1";


// ============================================================
// Cell 2b: Allow the frontend to call this API (CORS)
// Browsers block a page from calling a server on another address
// unless the server says it is allowed. Only the local frontend
// is allowed (opened as a file, or from localhost).
// ============================================================
const ALLOWED_ORIGINS = [
  "null",
  "http://localhost:5500", "http://127.0.0.1:5500",
  "http://localhost:8080", "http://127.0.0.1:8080",
];

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "*",
    "Vary": "Origin",
  };
}


// ============================================================
// Cell 3: Reply helper
// Sends JSON with the right status code and CORS headers.
// ============================================================
function send(res, status, body, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
  });
  res.end(JSON.stringify(body));
}


// ============================================================
// Cell 4: Health endpoint
// GET /health returns {"status":"ok"}: the simplest check that
// the server is alive. The frontend status light uses it.
// ============================================================
function health() {
  return [200, { status: "ok" }];
}


// ============================================================
// Cell 5: Stats endpoint
// GET /stats counts rows in each table to prove the database is
// connected. Same four keys the frontend cards read.
// ============================================================
function stats() {
  return [200, {
    stores: count("stores"),
    products: count("products"),
    listings: count("listings"),
    snapshots: count("price_snapshots"),
  }];
}


// ============================================================
// Cell 6: Search endpoints (SearXNG)
// GET /search?q=iphone+13+price+nepal&limit=10 returns results.
// GET /search/status says whether SearXNG is running.
// If SearXNG is off we answer 503 with a clear message.
// Bad input answers 422, like the Python version.
// ============================================================
async function search(url) {
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Number(url.searchParams.get("limit") || 10);
  if (q.length < 2) return [422, { detail: "q must be at least 2 characters" }];
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) {
    return [422, { detail: "limit must be a whole number from 1 to 30" }];
  }
  try {
    return [200, { query: q, results: await searxng.search(q, limit) }];
  } catch (e) {
    if (e instanceof searxng.SearxngError) return [503, { detail: e.message }];
    throw e;
  }
}

async function searchStatus() {
  return [200, {
    searxng: (await searxng.isUp()) ? "up" : "down",
    url: searxng.SEARXNG_URL,
  }];
}


// ============================================================
// Cell 6b: Scrape endpoints (Firecrawl)
// GET /scrape?url=https://...  returns the page as markdown.
//   Add &html=1 to also get the raw HTML (for price extraction).
// GET /scrape/status says whether Firecrawl is running.
// Only http/https addresses are accepted. If Firecrawl is off
// we answer 503 with a clear message.
// ============================================================
async function scrape(url) {
  const target = (url.searchParams.get("url") || "").trim();
  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    return [422, { detail: "url must be a full address like https://example.com" }];
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return [422, { detail: "url must start with http:// or https://" }];
  }
  const formats = url.searchParams.get("html") === "1" ? ["markdown", "html"] : ["markdown"];
  try {
    return [200, await firecrawl.scrape(parsed.href, formats)];
  } catch (e) {
    if (e instanceof firecrawl.FirecrawlError) return [503, { detail: e.message }];
    throw e;
  }
}

async function scrapeStatus() {
  return [200, {
    firecrawl: (await firecrawl.isUp()) ? "up" : "down",
    url: firecrawl.FIRECRAWL_URL,
  }];
}


// ============================================================
// Cell 6c: Search + scrape + prices
// GET /search/prices?q=iphone+13+price+nepal&limit=4
// 1. asks SearXNG for pages, 2. scrapes the top ones with
// Firecrawl, 3. pulls the prices out of each page.
// Returns only scraped data: { query, results: [{ url, title,
// prices: [{text, amount, context}], error? }] }.
// A page that fails keeps its row with an "error" note instead
// of breaking the whole search. Social sites are skipped: they
// need a login and would waste a slow scrape. Limit is 1 to 5
// because each scrape takes about 20 seconds on this laptop.
// ============================================================
const SKIP_HOSTS = ["facebook.com", "instagram.com", "youtube.com", "tiktok.com", "x.com", "twitter.com"];

function scrapeable(address) {
  let u;
  try { u = new URL(address); } catch (e) { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.replace(/^www\./, "");
  return !SKIP_HOSTS.some(h => host === h || host.endsWith("." + h));
}

async function searchPrices(url) {
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Number(url.searchParams.get("limit") || 4);
  if (q.length < 2) return [422, { detail: "q must be at least 2 characters" }];
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
    return [422, { detail: "limit must be a whole number from 1 to 5" }];
  }

  let found;
  try {
    found = await searxng.search(q, 15);
  } catch (e) {
    if (e instanceof searxng.SearxngError) return [503, { detail: e.message }];
    throw e;
  }

  const seen = new Set();
  const pages = [];
  for (const r of found) {
    if (!scrapeable(r.url) || seen.has(r.url)) continue;
    seen.add(r.url);
    pages.push(r);
    if (pages.length >= limit) break;
  }

  const results = await Promise.all(pages.map(async r => {
    try {
      const page = await firecrawl.scrape(r.url, ["markdown"]);
      return { url: page.url, title: page.title || r.title, prices: extractPrices(page.markdown) };
    } catch (e) {
      if (e instanceof firecrawl.FirecrawlError) {
        return { url: r.url, title: r.title, prices: [], error: e.message.slice(0, 140) };
      }
      throw e;
    }
  }));
  return [200, { query: q, results }];
}


// ============================================================
// Cell 7: Route table
// Maps a path to its function. To add an endpoint, write a
// function above and add one line here.
// ============================================================
const ROUTES = {
  "/health": health,
  "/stats": stats,
  "/search": search,
  "/search/status": searchStatus,
  "/scrape": scrape,
  "/scrape/status": scrapeStatus,
  "/search/prices": searchPrices,
};


// ============================================================
// Cell 8: The server
// For each request: answer the CORS preflight, allow GET only,
// find the route, and turn any crash into a clean 500 instead
// of stopping the server.
// ============================================================
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders(origin));
      return res.end();
    }
    if (req.method !== "GET") return send(res, 405, { detail: "Method not allowed" }, origin);

    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    const handler = ROUTES[url.pathname];
    if (!handler) return send(res, 404, { detail: "Not found" }, origin);

    const [status, body] = await handler(url);
    send(res, status, body, origin);
  } catch (e) {
    console.error(e);
    send(res, 500, { detail: "Server error" }, origin);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PriceRadar API running at http://${HOST}:${PORT}`);
});
