// ============================================================
// Cell 1: Settings
// Where the API lives. The layout itself is in index.html and
// the look is in styles.css; this file only adds behaviour.
// ============================================================
const API_BASE = "http://127.0.0.1:8000";


// ============================================================
// Cell 2: Theme (light / dark)
// Remembers your choice in the browser. The try/catch keeps the
// page working even if the browser blocks storage.
// ============================================================
function loadTheme() {
  let theme = "light";
  try { theme = localStorage.getItem("pr-theme") || "light"; } catch (e) {}
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const now = document.documentElement.getAttribute("data-theme");
  const next = now === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("pr-theme", next); } catch (e) {}
}


// ============================================================
// Cell 3: Talk to the API
// getJSON() calls one endpoint and returns the data, or null if
// the server is off. The page then shows "API offline" instead
// of breaking.
// ============================================================
async function getJSON(path) {
  try {
    const res = await fetch(API_BASE + path);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}


// ============================================================
// Cell 4: Fill in the live parts
// The HTML already has the cards and the status light. These
// two functions only change their text and colour.
// If the API is off the cards show a dash. No made-up numbers.
// ============================================================
function showStatus(online) {
  document.getElementById("dot").className = "dot " + (online ? "ok" : "bad");
  document.getElementById("status-text").textContent = online ? "API online" : "API offline";
}

function showStats(stats) {
  document.querySelectorAll("[data-stat]").forEach(box => {
    box.textContent = stats ? stats[box.dataset.stat] : "\u2014";
    const badge = box.parentElement.querySelector(".badge");
    badge.className = "badge " + (stats ? "b-good" : "b-mute");
    badge.textContent = stats ? "live" : "no data";
  });
}


// ============================================================
// Cell 5: Switch pages
// Shows the page whose id is "page-<name>", hides the rest,
// highlights the sidebar button, updates the breadcrumb, and
// refreshes /health and /stats.
// ============================================================
async function go(id) {
  document.querySelectorAll("[id^='page-']").forEach(page => {
    page.hidden = page.id !== "page-" + id;
  });
  document.querySelectorAll(".nav").forEach(btn => {
    btn.classList.toggle("on", btn.dataset.page === id);
  });
  document.getElementById("crumb").textContent =
    document.getElementById("page-" + id).dataset.label;

  const [health, stats] = await Promise.all([getJSON("/health"), getJSON("/stats")]);
  showStatus(!!health);
  showStats(stats);
}


// ============================================================
// Cell 5b: Search page
// Calls GET /search on the backend and draws one card per result.
// Text is added with textContent (never innerHTML), so a result
// can't inject code. Only http/https links are made clickable.
// ============================================================
function searchMessage(text) {
  const out = document.getElementById("search-out");
  out.textContent = "";
  const box = document.createElement("div");
  box.className = "card empty";
  box.textContent = text;
  out.appendChild(box);
}

function resultCard(r) {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("b");
  const safe = /^https?:\/\//i.test(r.url);
  if (safe) {
    const a = document.createElement("a");
    a.href = r.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = r.title || r.url;
    title.appendChild(a);
  } else {
    title.textContent = r.title || "(no title)";
  }

  const url = document.createElement("div");
  url.className = "note";
  url.textContent = r.url;

  card.append(title, url);

  // Only scraped data is shown: the prices found on the page,
  // or a clear note when the page failed or had no price.
  if (r.error) {
    const bad = document.createElement("span");
    bad.className = "badge b-bad";
    bad.textContent = "Could not scrape";
    const why = document.createElement("div");
    why.className = "note";
    why.textContent = r.error;
    card.append(bad, why);
  } else if (!r.prices.length) {
    const none = document.createElement("span");
    none.className = "badge b-warn";
    none.textContent = "No price found on this page";
    card.appendChild(none);
  } else {
    r.prices.forEach(p => {
      const line = document.createElement("div");
      const amount = document.createElement("b");
      amount.textContent = p.text;
      const ctx = document.createElement("span");
      ctx.className = "note";
      ctx.textContent = p.context ? "  \u2014 " + p.context : "";
      line.append(amount, ctx);
      card.appendChild(line);
    });
  }
  return card;
}

async function runSearch(q) {
  searchMessage("Searching and scraping pages... this can take up to a minute.");
  let res;
  try {
    res = await fetch(API_BASE + "/search/prices?" + new URLSearchParams({ q: q, limit: 4 }));
  } catch (e) {
    searchMessage("API offline. Start the backend and try again.");
    return;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    searchMessage((data && data.detail) || "Search failed (HTTP " + res.status + ")");
    return;
  }
  if (!data.results.length) {
    searchMessage("No results for \"" + q + "\".");
    return;
  }
  const out = document.getElementById("search-out");
  out.textContent = "";
  data.results.forEach(r => out.appendChild(resultCard(r)));
}


// ============================================================
// Cell 6: Start the app
// Wires the buttons, then loads the Overview page.
// ============================================================
loadTheme();
document.querySelectorAll(".nav").forEach(btn => {
  btn.addEventListener("click", () => go(btn.dataset.page));
});
document.getElementById("theme-btn").addEventListener("click", toggleTheme);
document.getElementById("search-form").addEventListener("submit", e => {
  e.preventDefault();
  runSearch(document.getElementById("search-q").value.trim());
});
go("overview");
