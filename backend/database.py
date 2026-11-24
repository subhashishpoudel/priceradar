# ============================================================
# Cell 1: Imports
# Brings in the SQLAlchemy tools: column types and the current time.
# ============================================================
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime


# ============================================================
# Cell 2: Connect to SQLite
# engine = connection to the file priceradar.db (created if missing).
# SessionLocal = opens a conversation with the database.
# Base = parent class for all our tables.
# For PostgreSQL later, change only the URL below.
# ============================================================
engine = create_engine("sqlite:///priceradar.db")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


# ============================================================
# Cell 3: Store table
# One row per marketplace.
# source_type is ready for second-hand sources later.
# ============================================================
class Store(Base):
    __tablename__ = "stores"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    base_url = Column(String)
    source_type = Column(String, default="store")  # store or classified


# ============================================================
# Cell 4: Product table
# One row per real phone variant.
# Matching will link many store listings to one row here.
# ============================================================
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    brand = Column(String)
    model = Column(String)
    storage = Column(String)  # e.g. 128GB
    ram = Column(String)      # e.g. 8GB
    color = Column(String)


# ============================================================
# Cell 5: Listing table
# One row per product page in one store.
# ForeignKey links each listing to its product and store.
# condition is ready for the second-hand phase.
# ============================================================
class Listing(Base):
    __tablename__ = "listings"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    store_id = Column(Integer, ForeignKey("stores.id"))
    url = Column(String, unique=True)
    title = Column(String)
    condition = Column(String, default="new")  # new, used, refurbished


# ============================================================
# Cell 6: Price snapshot table
# Each crawl adds one row: price, crossed-out price, stock, time.
# This history powers the real-discount and fake-sale checks.
# ============================================================
class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"
    id = Column(Integer, primary_key=True)
    listing_id = Column(Integer, ForeignKey("listings.id"))
    price = Column(Float)
    original_price = Column(Float)  # the crossed-out price
    in_stock = Column(Boolean)
    scraped_at = Column(DateTime, default=datetime.utcnow)


# ============================================================
# Cell 7: Store contact table
# Public BUSINESS contact details of a store (support email,
# phone, address). Never personal details of private people.
# kind = email / phone / address / social
# ============================================================
class StoreContact(Base):
    __tablename__ = "store_contacts"
    id = Column(Integer, primary_key=True)
    store_id = Column(Integer, ForeignKey("stores.id"))
    kind = Column(String)
    value = Column(String)
    source_url = Column(String)  # the public page it was found on
    collected_at = Column(DateTime, default=datetime.utcnow)


# ============================================================
# Cell 8: Create the tables
# Reads all classes above and creates any missing tables
# in priceradar.db (existing tables are left untouched).
# ============================================================
Base.metadata.create_all(engine)

if __name__ == "__main__":
    print("Database ready: priceradar.db")
