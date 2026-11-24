# PriceRadar Rules (updated)

1. Core analytics (matching, real discount, fake-sale check, cheapest store, profit, alerts)
   use classic code and statistics only. An external AI API (e.g. Gemini) may be used only
   to understand free text (reviews, Reddit) and never to decide prices, discounts or alerts.
   Cache results, keep keys in .env, and fall back to keyword rules if the API fails.
2. Be a polite crawler: obey robots.txt, wait between requests, honest user agent.
3. If a site blocks us (403 or 429), skip it. Never try to get around protections.
4. Collect public product and price information, plus public business contact details of stores.
   Do not collect personal contact details (name, email, phone, profile) of private individuals.
5. Check each site's terms before adding it as a source.
6. Profit numbers are estimates and must be labelled that way.
7. Reddit: use the official API, store post text/subreddit/date/score only, never usernames.
8. Second-hand listings from individual sellers carry a visible warning:
   "Individual seller: unverified, possibly not safe, not an organization."

## Scope
- Phase 1: mobile phones, new products only.
- Phase 2: second-hand market (dork discovery via SearXNG), seller_type flag.
- Phase 3: Reddit/review understanding via API.
