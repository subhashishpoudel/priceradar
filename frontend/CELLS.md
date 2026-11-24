# PriceRadar: how the cells connect

Each file is split into numbered "cells" (banner comments). This file shows
which cell talks to which, across `index.html`, `app.js` and `backend/main.py`.
`styles.css` has no cells; it styles the class names used in `index.html`.

## The big picture

```
 index.html (structure)  <--- fills / shows / hides --- app.js (behaviour)
        |                                                    |
        | <link>                                             | fetch()
        v                                                    v
   styles.css (look)                              backend/main.py (API)
                                                             |
                                                             v
                                                   backend/database.py
                                                      (priceradar.db)
```

## index.html cells

| Cell | What it holds | Connected to |
|------|---------------|--------------|
| 1 Head | title, `styles.css` link, `app.js` script (`defer`) | loads **styles.css** and **app.js**; `defer` means app.js runs only after cells 2-6 exist |
| 2 Sidebar | 5 buttons, each with `data-page="..."` | **app.js Cell 6** attaches a click to each; **app.js Cell 5** reads `data-page` and toggles the `on` class |
| 3 Top bar | `#crumb`, `#dot`, `#status-text`, `#theme-btn` | `#crumb` set by **app.js Cell 5**; `#dot` and `#status-text` set by **app.js Cell 4** (`showStatus`); `#theme-btn` wired in **app.js Cell 6** to **Cell 2** (`toggleTheme`) |
| 4 Stat cards | 4 boxes with `data-stat="stores/products/listings/snapshots"` | filled by **app.js Cell 4** (`showStats`); the keys match the JSON from **main.py Cell 5** (`/stats`) |
| 5 Sample price table | static placeholder rows, labelled "Sample data" | not connected yet; later a function in app.js will fill it from a price endpoint |
| 6 Other pages | `page-products`, `page-stores`, `page-history`, `page-alerts` (all `hidden`) | shown/hidden by **app.js Cell 5**; each id must be `page-<name>` and match a sidebar `data-page` |

Note: the Overview page (`page-overview`) wraps Cells 4 and 5 and follows the same `page-<name>` rule.

## app.js cells

| Cell | What it does | Called by / calls |
|------|--------------|-------------------|
| 1 Settings | `API_BASE` (where the API lives) | used by **Cell 3** |
| 2 Theme | `loadTheme()`, `toggleTheme()` | `loadTheme` called in **Cell 6** at startup; `toggleTheme` called by the `#theme-btn` click set in **Cell 6** |
| 3 Talk to the API | `getJSON(path)` returns data, or `null` if the server is off | uses **Cell 1**; called by **Cell 5**; hits **main.py** `/health` and `/stats` |
| 4 Fill the live parts | `showStatus(online)`, `showStats(stats)` | called by **Cell 5** with what **Cell 3** returned; writes into **index.html Cells 3 and 4** |
| 5 Switch pages | `go(id)` | called by **Cell 6** (first load) and by every sidebar click; calls **Cell 3**, then **Cell 4** |
| 6 Start the app | loads theme, wires buttons, calls `go("overview")` | calls **Cells 2 and 5**; the only cell that runs by itself |

## backend/main.py cells

| Cell | What it does | Connected to |
|------|--------------|--------------|
| 1 Imports | FastAPI + tables from `database.py` | **database.py** |
| 2 Create the app | the `app` object | all endpoints attach to it |
| 2b CORS | lists the frontend origins allowed to call the API (`null`, ports 5500 and 8080) | without it the browser blocks **app.js Cell 3** fetches |
| 3 Database session | `get_db()` opens and closes a session per request | used by **Cell 5** |
| 4 Health | `GET /health` returns `{"status": "ok"}` | **app.js Cell 5** uses it for the API online/offline light |
| 5 Stats | `GET /stats` returns row counts | **app.js Cell 4** `showStats` shows them in **index.html Cell 4** |

## What happens when the page loads

1. Browser reads **index.html**: Cell 1 loads `styles.css`; Cells 2-6 build the screen (empty numbers, API offline).
2. `app.js` runs (it was deferred): **Cell 6** runs `loadTheme()`, wires the sidebar and theme buttons, then calls `go("overview")`.
3. `go()` (**Cell 5**) shows `page-overview`, highlights the Overview button, sets the breadcrumb, then calls `getJSON` (**Cell 3**) for `/health` and `/stats` at the same time.
4. Those requests reach **main.py** (Cells 4 and 5, via CORS Cell 2b and `get_db` Cell 3).
5. Results come back and **Cell 4** updates the status light (index.html Cell 3) and the stat cards (index.html Cell 4). If the server is off, `getJSON` returns `null`, so the light is red and the cards show a dash.

## What happens when you click a sidebar button

Click -> **app.js Cell 6** listener -> `go(id)` (**Cell 5**) -> hide all `page-*`, show `page-<id>` -> update the crumb -> fetch `/health` and `/stats` again -> **Cell 4** refreshes the light and cards.

## What happens when you click "Dark / light"

Click -> **app.js Cell 6** listener -> `toggleTheme()` (**Cell 2**) -> sets `data-theme` on `<html>` (the CSS reads it) and saves it in localStorage. The next page load restores it through `loadTheme()`.

## Adding a new page (checklist)

1. **index.html Cell 2:** add a button with `data-page="newname"`.
2. **index.html Cell 6:** add `<div id="page-newname" data-label="New name" hidden>...</div>`.
3. **app.js:** nothing to change; Cells 5 and 6 pick up the new button and page automatically.
4. If the page needs data: add an endpoint in **main.py** (after Cell 5), then a fetch and a fill function in **app.js** (next to Cell 4), called from `go()`.
