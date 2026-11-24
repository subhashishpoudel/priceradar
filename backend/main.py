# ============================================================
# Cell 1: Imports
# Brings in FastAPI, our tables from database.py, and the
# SearXNG helper from searxng_client.py.
# ============================================================
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import SessionLocal, Store, Product, Listing, PriceSnapshot
import searxng_client


# ============================================================
# Cell 2: Create the app
# The web server object. Every endpoint attaches to it.
# ============================================================
app = FastAPI(title="PriceRadar")


# ============================================================
# Cell 2b: Allow the frontend to call this API
# Browsers block a page from calling a server on another address
# unless the server says it is allowed (CORS). Here we allow the
# local frontend only (opened as a file or from localhost).
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["null", "http://localhost:5500", "http://127.0.0.1:5500",
                   "http://localhost:8080", "http://127.0.0.1:8080"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ============================================================
# Cell 3: Database session helper
# Opens a database connection for each request and always
# closes it afterwards, even on errors.
# ============================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# Cell 4: Health endpoint
# Visiting /health returns {"status": "ok"}.
# The simplest check that the server is alive.
# ============================================================
@app.get("/health")
def health():
    return {"status": "ok"}


# ============================================================
# Cell 5: Stats endpoint
# Counts rows in each table to prove the database is connected.
# Depends(get_db) hands the function a database session.
# ============================================================
@app.get("/stats")
def stats(db: Session = Depends(get_db)):
    return {
        "stores": db.query(Store).count(),
        "products": db.query(Product).count(),
        "listings": db.query(Listing).count(),
        "snapshots": db.query(PriceSnapshot).count(),
    }


# ============================================================
# Cell 6: Search endpoints (SearXNG)
# /search?q=iphone+13+price+nepal  returns web results as JSON.
# /search/status says whether SearXNG is running.
# If SearXNG is off we answer 503 with a clear message instead
# of crashing. Plain "def" (not async) because the helper
# waits on the network; FastAPI runs it in a worker thread.
# ============================================================
@app.get("/search")
def search(q: str = Query(..., min_length=2), limit: int = Query(10, ge=1, le=30)):
    try:
        return {"query": q, "results": searxng_client.search(q, limit)}
    except searxng_client.SearxngError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/search/status")
def search_status():
    return {"searxng": "up" if searxng_client.is_up() else "down",
            "url": searxng_client.SEARXNG_URL}
