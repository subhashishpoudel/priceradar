// ============================================================
// Cell 1: Imports
// node:sqlite is built into Node 22.13+, so nothing to install.
// ============================================================
const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");


// ============================================================
// Cell 2: Connect to SQLite
// Uses the SAME file as the Python backend (backend/priceradar.db)
// so your existing data is kept. Set DB_PATH to use another file.
// ============================================================
const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, "..", "backend", "priceradar.db");

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");


// ============================================================
// Cell 3: Create the tables
// Same columns as the Python version (Store, Product, Listing,
// PriceSnapshot, StoreContact). "IF NOT EXISTS" leaves existing
// tables and data untouched.
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY,
    name VARCHAR UNIQUE,
    base_url VARCHAR,
    source_type VARCHAR DEFAULT 'store'      -- store or classified
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    brand VARCHAR,
    model VARCHAR,
    storage VARCHAR,                          -- e.g. 128GB
    ram VARCHAR,                              -- e.g. 8GB
    color VARCHAR
  );

  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    store_id INTEGER REFERENCES stores(id),
    url VARCHAR UNIQUE,
    title VARCHAR,
    condition VARCHAR DEFAULT 'new'           -- new, used, refurbished
  );

  CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id),
    price FLOAT,
    original_price FLOAT,                     -- the crossed-out price
    in_stock BOOLEAN,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS store_contacts (
    id INTEGER PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id),
    kind VARCHAR,                             -- email / phone / address / social
    value VARCHAR,
    source_url VARCHAR,                       -- public page it was found on
    collected_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);


// ============================================================
// Cell 4: Helpers
// count(table) is used by /stats. The table name comes from our
// own fixed list below, never from a request, so it is safe.
// ============================================================
const TABLES = ["stores", "products", "listings", "price_snapshots", "store_contacts"];

function count(table) {
  if (!TABLES.includes(table)) throw new Error("Unknown table: " + table);
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

module.exports = { db, count, DB_PATH };

if (require.main === module) {
  console.log("Database ready:", DB_PATH);
}
