export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS operators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('operator', 'supervisor'))
);

CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_hour INTEGER NOT NULL,
  end_hour INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  aisle TEXT NOT NULL,
  rack INTEGER NOT NULL,
  shelf INTEGER NOT NULL,
  zone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  min_stock INTEGER NOT NULL,
  reorder_level INTEGER NOT NULL,
  default_location_id TEXT NOT NULL REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS product_synonyms (
  sku TEXT NOT NULL REFERENCES products(sku),
  synonym TEXT NOT NULL,
  PRIMARY KEY (sku, synonym)
);

CREATE TABLE IF NOT EXISTS stock (
  sku TEXT NOT NULL REFERENCES products(sku),
  location_id TEXT NOT NULL REFERENCES locations(id),
  qty INTEGER NOT NULL CHECK (qty >= 0),
  last_moved_at TEXT NOT NULL,
  PRIMARY KEY (sku, location_id)
);

CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL REFERENCES products(sku),
  location_id TEXT NOT NULL REFERENCES locations(id),
  delta INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('receipt', 'dispatch', 'adjustment', 'seed')),
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_movements_sku_at ON movements(sku, at);

CREATE TABLE IF NOT EXISTS purchase_orders (
  po_number TEXT PRIMARY KEY,
  supplier TEXT NOT NULL,
  expected_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'received'))
);

CREATE TABLE IF NOT EXISTS po_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT NOT NULL REFERENCES purchase_orders(po_number),
  sku TEXT NOT NULL REFERENCES products(sku),
  description TEXT NOT NULL,
  qty_ordered INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT NOT NULL REFERENCES purchase_orders(po_number),
  operator_id TEXT NOT NULL REFERENCES operators(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  received_at TEXT NOT NULL,
  has_discrepancy INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS receipt_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id INTEGER NOT NULL REFERENCES receipts(id),
  sku TEXT NOT NULL,
  expected_qty INTEGER NOT NULL,
  received_qty INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('exact', 'short', 'over', 'missing', 'unexpected'))
);

CREATE TABLE IF NOT EXISTS sales_orders (
  order_number TEXT PRIMARY KEY,
  customer TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'dispatched'))
);

CREATE TABLE IF NOT EXISTS order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL REFERENCES sales_orders(order_number),
  sku TEXT NOT NULL REFERENCES products(sku),
  qty_ordered INTEGER NOT NULL,
  qty_loaded INTEGER
);

CREATE TABLE IF NOT EXISTS dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL REFERENCES sales_orders(order_number),
  operator_id TEXT NOT NULL REFERENCES operators(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  dispatched_at TEXT NOT NULL,
  has_shortfall INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL REFERENCES products(sku),
  location_id TEXT NOT NULL REFERENCES locations(id),
  expected_qty INTEGER NOT NULL,
  proposed_qty INTEGER,
  confirmed_qty INTEGER NOT NULL,
  variance INTEGER NOT NULL,
  photo_path TEXT,
  operator_id TEXT NOT NULL REFERENCES operators(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  counted_at TEXT NOT NULL,
  adjusted_at TEXT
);

CREATE TABLE IF NOT EXISTS equipment_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment TEXT NOT NULL,
  description TEXT NOT NULL,
  reported_at TEXT NOT NULL,
  operator_id TEXT NOT NULL REFERENCES operators(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  status TEXT NOT NULL CHECK (status IN ('open', 'resolved'))
);

CREATE TABLE IF NOT EXISTS exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('receiving', 'count', 'dispatch', 'equipment')),
  ref_id INTEGER NOT NULL,
  summary TEXT NOT NULL,
  operator_id TEXT NOT NULL REFERENCES operators(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  operator_id TEXT NOT NULL REFERENCES operators(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  at TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
`;

export const DROP_ALL_SQL = `
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS exceptions;
DROP TABLE IF EXISTS equipment_issues;
DROP TABLE IF EXISTS counts;
DROP TABLE IF EXISTS dispatches;
DROP TABLE IF EXISTS order_lines;
DROP TABLE IF EXISTS sales_orders;
DROP TABLE IF EXISTS receipt_lines;
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS po_lines;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS movements;
DROP TABLE IF EXISTS stock;
DROP TABLE IF EXISTS product_synonyms;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS operators;
`;
