# ============================================================
# Cell 1: Imports
# httpx downloads pages. robotparser reads robots.txt rules.
# ============================================================
import time
import httpx
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser


# ============================================================
# Cell 2: Settings
# An honest user agent that says who we are (rule 2).
# DELAY_SECONDS = polite wait between requests to the same site.
# ============================================================
USER_AGENT = "PriceRadarBot/0.1 (price comparison project)"
DELAY_SECONDS = 3
_robots_cache = {}   # remembers robots.txt per website
_last_request = {}   # remembers when we last visited each website


# ============================================================
# Cell 3: Check robots.txt
# Downloads the site's robots.txt once, then answers:
# "are we allowed to visit this URL?"
# If robots.txt can't be read, we play safe and say no.
# ============================================================
def allowed_by_robots(url):
    parts = urlparse(url)
    site = f"{parts.scheme}://{parts.netloc}"
    if site not in _robots_cache:
        rp = RobotFileParser()
        rp.set_url(site + "/robots.txt")
        try:
            rp.read()
        except Exception:
            return False
        _robots_cache[site] = rp
    return _robots_cache[site].can_fetch(USER_AGENT, url)


# ============================================================
# Cell 4: Polite wait
# Makes sure at least DELAY_SECONDS passed since our last
# request to the same website.
# ============================================================
def _wait_politely(url):
    site = urlparse(url).netloc
    last = _last_request.get(site, 0)
    gap = time.time() - last
    if gap < DELAY_SECONDS:
        time.sleep(DELAY_SECONDS - gap)
    _last_request[site] = time.time()


# ============================================================
# Cell 5: Polite download
# Returns (html, reason). html is None when we skip the page.
# 403 or 429 means the site blocks us, so we skip it and never
# try to get around it (rule 3).
# ============================================================
def polite_get(url):
    if not allowed_by_robots(url):
        return None, "blocked by robots.txt"
    _wait_politely(url)
    try:
        r = httpx.get(url, headers={"User-Agent": USER_AGENT},
                      timeout=20, follow_redirects=True)
    except Exception as e:
        return None, f"network error: {e}"
    if r.status_code in (403, 429):
        return None, f"site blocked us ({r.status_code}), skipped"
    if r.status_code != 200:
        return None, f"status {r.status_code}"
    return r.text, "ok"


# ============================================================
# Cell 6: Quick test
# Run: python fetch.py
# example.com allows crawling, so this should print "ok".
# ============================================================
if __name__ == "__main__":
    html, reason = polite_get("https://example.com")
    print("Result:", reason)
    print("Page size:", len(html) if html else 0, "characters")
