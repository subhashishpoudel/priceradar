// ============================================================
// Cell 1: Price pattern
// Finds amounts like "NPR 80,399", "Rs. 45,000", "रू 1,00,000".
// Accepts Western (80,399) and Nepali/Indian (1,00,000) comma
// grouping, or plain digits with 4 or more digits (45000).
// ============================================================
const PRICE_RE = /(?:NPR|NRs\.?|Rs\.?|रू|रु)\s?(?:\d{1,3}(?:,\d{2,3})+|\d{4,})/gi;


// ============================================================
// Cell 2: Clean the page text
// Firecrawl gives markdown. We drop images and link addresses
// and collapse spaces, so the words around a price read cleanly.
// ============================================================
function cleanMarkdown(markdown) {
  return (markdown || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`|]/g, " ")
    .replace(/\s+/g, " ");
}


// ============================================================
// Cell 3: Extract prices
// Returns up to "max" different amounts as
// { text: "NPR 80,399", amount: 80399, context: "words before" }.
// "context" is the few words just before the price, so you can
// tell what the number is for. Amounts under 1,000 are skipped
// (they are usually not phone prices). No guessing: if the page
// has no price, the list is empty.
// ============================================================
function extractPrices(markdown, max = 8) {
  const clean = cleanMarkdown(markdown);
  const seen = new Set();
  const found = [];
  for (const m of clean.matchAll(PRICE_RE)) {
    const amount = Number(m[0].replace(/\D/g, ""));
    if (amount < 1000 || seen.has(amount)) continue;
    seen.add(amount);

    let context = clean.slice(Math.max(0, m.index - 70), m.index).trim();
    context = context.replace(/^\S*\s/, ""); // drop a cut-off first word
    found.push({ text: m[0], amount, context });
    if (found.length >= max) break;
  }
  return found;
}

module.exports = { extractPrices };
