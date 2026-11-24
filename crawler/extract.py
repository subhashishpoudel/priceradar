# ============================================================
# Cell 1: Imports
# json reads structured data, re finds numbers, selectolax
# is a fast HTML parser.
# ============================================================
import json
import re
from selectolax.parser import HTMLParser


# ============================================================
# Cell 2: Turn price text into a number
# "Rs. 90,000" -> 90000.0   |   "NPR 1,29,999.50" -> 129999.5
# Returns None if no number is found.
# ============================================================
def parse_price(text):
    if not text:
        return None
    cleaned = re.sub(r"[^\d.]", "", str(text).replace(",", ""))
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


# ============================================================
# Cell 3: Read structured data (JSON-LD), the easiest method
# Many stores hide a clean block describing the product.
# We look for the one whose type is "Product" and pull out
# name, price, stock and image.
# ============================================================
def extract_jsonld(tree):
    for script in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.text())
        except Exception:
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data])
        for item in items:
            if not isinstance(item, dict) or item.get("@type") != "Product":
                continue
            offers = item.get("offers", {})
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            availability = str(offers.get("availability", ""))
            image = item.get("image")
            if isinstance(image, list):
                image = image[0] if image else None
            return {
                "title": item.get("name"),
                "price": parse_price(offers.get("price")),
                "original_price": None,  # JSON-LD rarely has it
                "in_stock": "InStock" in availability if availability else None,
                "image": image,
            }
    return None


# ============================================================
# Cell 4: Read with per-store selectors (the fallback)
# selectors is a small dict telling us where each field sits,
# e.g. {"title": "h1.product-title", "price": "span.price"}.
# Each store gets its own dict once we pick the stores.
# ============================================================
def extract_with_selectors(tree, selectors):
    def text_of(key):
        css = selectors.get(key)
        node = tree.css_first(css) if css else None
        return node.text(strip=True) if node else None

    stock_text = (text_of("stock") or "").lower()
    return {
        "title": text_of("title"),
        "price": parse_price(text_of("price")),
        "original_price": parse_price(text_of("original_price")),
        "in_stock": None if not stock_text else
                    ("out of stock" not in stock_text and "sold out" not in stock_text),
        "image": None,
    }


# ============================================================
# Cell 5: Find public BUSINESS contacts
# Only mailto: and tel: links on a store's own page.
# Run this on a store's contact/about page, never on personal
# profiles or listings from private individuals.
# ============================================================
def extract_contacts(html):
    tree = HTMLParser(html)
    contacts = []
    for a in tree.css("a[href]"):
        href = a.attributes.get("href", "")
        if href.startswith("mailto:"):
            contacts.append(("email", href[7:].split("?")[0]))
        elif href.startswith("tel:"):
            contacts.append(("phone", href[4:]))
    return list(dict.fromkeys(contacts))  # remove duplicates


# ============================================================
# Cell 6: Main function
# Try JSON-LD first. If it finds nothing and we have selectors,
# use those. Returns a dict, or None if nothing worked.
# ============================================================
def extract_product(html, selectors=None):
    tree = HTMLParser(html)
    result = extract_jsonld(tree)
    if (not result or result["price"] is None) and selectors:
        result = extract_with_selectors(tree, selectors)
    if result and result["price"] is not None:
        return result
    return None


# ============================================================
# Cell 7: Quick test on a made-up page
# Run: python extract.py
# ============================================================
if __name__ == "__main__":
    sample = """
    <html><body>
      <h1 class="t">Samsung Galaxy S24 256GB</h1>
      <span class="p">Rs. 90,000</span>
      <del class="o">Rs. 1,20,000</del>
      <span class="s">In stock</span>
      <p>Long description we ignore...</p>
      <a href="mailto:support@shop.example">Email us</a>
      <a href="tel:+9779800000000">Call us</a>
    </body></html>
    """
    rules = {"title": "h1.t", "price": "span.p", "original_price": "del.o", "stock": "span.s"}
    print(extract_product(sample, rules))
    print(extract_contacts(sample))
