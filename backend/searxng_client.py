# ============================================================
# Cell 1: Settings
# Where SearXNG runs. Set the SEARXNG_URL environment variable
# to override; the default matches searxng/docker-compose.yml.
# ============================================================
import json
import os
import urllib.error
import urllib.parse
import urllib.request

SEARXNG_URL = os.environ.get("SEARXNG_URL", "http://127.0.0.1:8888")
TIMEOUT_SECONDS = 15


# ============================================================
# Cell 2: Error type
# One error for every SearXNG problem (server off, bad reply),
# so main.py only has to catch one thing.
# ============================================================
class SearxngError(Exception):
    pass


# ============================================================
# Cell 3: Search
# Asks SearXNG for results as JSON and keeps only the fields we
# need. Returns a list of {title, url, snippet, engine}.
# ============================================================
def search(query: str, limit: int = 10) -> list[dict]:
    params = urllib.parse.urlencode({"q": query, "format": "json"})
    url = f"{SEARXNG_URL}/search?{params}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as res:
            data = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 403:
            raise SearxngError("SearXNG refused JSON (add 'json' to search.formats in settings.yml)")
        raise SearxngError(f"SearXNG returned HTTP {e.code}")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
        raise SearxngError(f"SearXNG is not reachable at {SEARXNG_URL}: {e}")

    results = []
    for r in data.get("results", [])[:limit]:
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "snippet": r.get("content", ""),
            "engine": r.get("engine", ""),
        })
    return results


# ============================================================
# Cell 4: Is it running?
# Quick yes/no check used by /search/status.
# ============================================================
def is_up() -> bool:
    try:
        with urllib.request.urlopen(SEARXNG_URL + "/", timeout=3):
            return True
    except Exception:
        return False
