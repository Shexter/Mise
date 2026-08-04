/**
 * Schema and forward-only migrations.
 *
 * `MIGRATIONS[n]` upgrades the database from `user_version = n` to `n + 1`.
 * Never edit a migration that has shipped — append a new one instead.
 */

const INITIAL_SCHEMA = `
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sex TEXT NOT NULL,
  age INTEGER NOT NULL,
  height_cm REAL NOT NULL,
  weight_kg REAL NOT NULL,
  activity_level TEXT NOT NULL,
  goal TEXT NOT NULL,
  target_calories INTEGER NOT NULL,
  protein_pct REAL NOT NULL DEFAULT 0.30,
  carbs_pct REAL NOT NULL DEFAULT 0.40,
  fat_pct REAL NOT NULL DEFAULT 0.30,
  units TEXT NOT NULL DEFAULT 'metric',
  onboarded_at TEXT NOT NULL
);

CREATE TABLE meals (
  id TEXT PRIMARY KEY,
  logged_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  name TEXT NOT NULL,
  photo_uri TEXT,
  source TEXT NOT NULL,
  confidence TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_meals_date ON meals(local_date);

CREATE TABLE meal_items (
  id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  calories REAL NOT NULL,
  protein_g REAL NOT NULL DEFAULT 0,
  carbs_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  is_manual_addition INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_meal_items_meal ON meal_items(meal_id);

CREATE TABLE daily_targets (
  local_date TEXT PRIMARY KEY,
  target_calories INTEGER NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL
);
`;

/**
 * Migration 2: the identity layer. Canonical ingredients, their aliases and
 * products, and the queue of references the match cascade could not resolve.
 * Schema per `docs/identity-layer.md`; `pantry_items` and `consumption_events`
 * arrive with the pantry-stock change, not here.
 */
const IDENTITY_LAYER = `
CREATE TABLE canonical_items (
  id                  TEXT PRIMARY KEY,
  display_name        TEXT NOT NULL,
  class               TEXT NOT NULL,
  default_location    TEXT NOT NULL,
  shelf_life_days     TEXT NOT NULL,
  open_life_days      INTEGER,
  typical_use_qty     REAL,
  typical_use_unit    TEXT,
  typical_pkg_qty     REAL,
  typical_pkg_unit    TEXT,
  density_g_per_ml    REAL,
  is_seed             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL
);

CREATE TABLE item_aliases (
  id               TEXT PRIMARY KEY,
  alias_norm       TEXT NOT NULL,
  alias_raw        TEXT NOT NULL,
  canonical_id     TEXT NOT NULL REFERENCES canonical_items(id) ON DELETE CASCADE,
  source           TEXT NOT NULL,
  locale           TEXT,
  confidence       REAL NOT NULL DEFAULT 1,
  times_confirmed  INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_aliases_norm ON item_aliases(alias_norm);
CREATE UNIQUE INDEX idx_aliases_pair ON item_aliases(alias_norm, canonical_id);

CREATE TABLE products (
  id              TEXT PRIMARY KEY,
  gtin            TEXT UNIQUE,
  brand           TEXT,
  name            TEXT NOT NULL,
  pkg_qty         REAL,
  pkg_unit        TEXT,
  canonical_id    TEXT NOT NULL REFERENCES canonical_items(id),
  kcal_per_100    REAL,
  protein_per_100 REAL,
  carbs_per_100   REAL,
  fat_per_100     REAL,
  source          TEXT NOT NULL,
  fetched_at      TEXT
);

CREATE INDEX idx_products_gtin ON products(gtin);

CREATE TABLE match_queue (
  id            TEXT PRIMARY KEY,
  raw_text      TEXT NOT NULL,
  source        TEXT NOT NULL,
  context       TEXT,
  suggested_id  TEXT REFERENCES canonical_items(id),
  confidence    REAL,
  created_at    TEXT NOT NULL
);
`;

/**
 * Migration 3: the pantry catalogue. Physical items in the kitchen and the
 * user-editable storage locations they live in. Locations are a table, not
 * an enum (decision 57): `kind` is the closed set the shelf-life lookup
 * keys off, `name` is free text the user owns. The four defaults are seeded
 * here so a fresh install has them before any screen loads.
 */
const PANTRY_STOCK = `
CREATE TABLE locations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO locations (id, name, kind, sort_order) VALUES
  ('fridge',  'Fridge',  'fridge',  0),
  ('freezer', 'Freezer', 'freezer', 1),
  ('pantry',  'Pantry',  'ambient', 2),
  ('counter', 'Counter', 'counter', 3);

CREATE TABLE pantry_items (
  id            TEXT PRIMARY KEY,
  canonical_id  TEXT NOT NULL REFERENCES canonical_items(id),
  product_id    TEXT REFERENCES products(id),
  location_id   TEXT NOT NULL REFERENCES locations(id),
  qty_remaining REAL,
  qty_unit      TEXT,
  qty_source    TEXT,
  fullness      TEXT,
  uses_count    INTEGER NOT NULL DEFAULT 0,
  purchased_at  TEXT NOT NULL,
  opened_at     TEXT,
  expires_at    TEXT,
  expiry_source TEXT,
  price_cents   INTEGER,
  photo_uri     TEXT,
  status        TEXT NOT NULL DEFAULT 'in_stock',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX idx_pantry_status    ON pantry_items(status);
CREATE INDEX idx_pantry_expires   ON pantry_items(expires_at);
CREATE INDEX idx_pantry_canonical ON pantry_items(canonical_id);
`;

/**
 * Migration 4: depletion. The consumption ledger that makes every automatic
 * stock change explainable and reversible (decision 9), the drift counters
 * that let the app say less when it knows less (decision 53), and the meal
 * venue that decides whether a meal debits the pantry at all.
 *
 * `venue` defaults existing meals to `home`, which is the assumption they
 * were logged under. Harmless because depletion is never retroactive — no
 * past meal will be replayed against the catalogue.
 */
const STOCK_DEPLETION = `
CREATE TABLE consumption_events (
  id             TEXT PRIMARY KEY,
  pantry_item_id TEXT REFERENCES pantry_items(id) ON DELETE SET NULL,
  canonical_id   TEXT NOT NULL,
  meal_id        TEXT REFERENCES meals(id) ON DELETE CASCADE,
  qty            REAL,
  unit           TEXT,
  uses           INTEGER NOT NULL DEFAULT 0,
  servings_mult  REAL NOT NULL DEFAULT 1,
  kind           TEXT NOT NULL,
  created_at     TEXT NOT NULL
);

CREATE INDEX idx_consumption_meal      ON consumption_events(meal_id);
CREATE INDEX idx_consumption_item      ON consumption_events(pantry_item_id);
CREATE INDEX idx_consumption_canonical ON consumption_events(canonical_id);

ALTER TABLE pantry_items ADD COLUMN estimated_decrements_since_anchor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE pantry_items ADD COLUMN last_anchor_at TEXT;

ALTER TABLE meals ADD COLUMN venue TEXT NOT NULL DEFAULT 'home';
ALTER TABLE meals ADD COLUMN servings_mult REAL NOT NULL DEFAULT 1;
`;

/**
 * Migration 5: the dinner decision. `meal_items.canonical_id` lets a recipe
 * carry the exact ingredient identity it means, rather than having it
 * re-derived by name matching (decision 61) — nullable and defaulting to
 * null, which is exactly today's resolve-by-name behaviour, so no backfill.
 * `suggestion_cache` holds a generated set keyed by a fingerprint of the
 * inputs that would change the answer, so opening the tab does not spend a
 * model call when nothing material has changed (decision 40).
 */
const DINNER_DECISION = `
ALTER TABLE meal_items ADD COLUMN canonical_id TEXT REFERENCES canonical_items(id);

CREATE TABLE suggestion_cache (
  id           TEXT PRIMARY KEY,
  local_date   TEXT NOT NULL,
  mode         TEXT NOT NULL,
  fingerprint  TEXT NOT NULL,
  payload      TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_suggestion_cache_date ON suggestion_cache(local_date, mode);
`;

/**
 * Migration 6: receipt import. `receipts` and `receipt_lines` hold a draft
 * until review is accepted — extraction never writes, review commits (design
 * doc). A line keeps both what was extracted and what the user made of it,
 * which is why this is a table rather than a JSON blob on the receipt: it is
 * the audit trail decision 21's re-anchoring depends on.
 *
 * `pantry_items` gains `replacement_asked`, the asked-once flag for decision
 * 68's "is the old one finished?" prompt. Defaults to 0, which is correct
 * for every item that already exists — none of them has been asked yet.
 */
const RECEIPT_IMPORT = `
CREATE TABLE receipts (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL DEFAULT 'grocery',
  store        TEXT,
  purchased_at TEXT NOT NULL,
  total_cents  INTEGER,
  image_uri    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_receipts_purchased ON receipts(purchased_at);

CREATE TABLE receipt_lines (
  id                TEXT PRIMARY KEY,
  receipt_id        TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  raw_text          TEXT NOT NULL,
  kind              TEXT NOT NULL,
  qty               REAL,
  unit              TEXT,
  line_total_cents  INTEGER,
  unit_price_cents  INTEGER,
  canonical_id      TEXT REFERENCES canonical_items(id),
  pantry_item_id    TEXT REFERENCES pantry_items(id) ON DELETE SET NULL,
  excluded          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL
);

CREATE INDEX idx_receipt_lines_receipt ON receipt_lines(receipt_id);

ALTER TABLE pantry_items ADD COLUMN replacement_asked INTEGER NOT NULL DEFAULT 0;
`;

export const MIGRATIONS: readonly string[] = [
  INITIAL_SCHEMA,
  IDENTITY_LAYER,
  PANTRY_STOCK,
  STOCK_DEPLETION,
  DINNER_DECISION,
  RECEIPT_IMPORT,
];

export const LATEST_VERSION = MIGRATIONS.length;

/** Drops every table. Used by "Delete all data" and by the debug reset helper. */
export const DROP_ALL = `
DROP TABLE IF EXISTS receipt_lines;
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS suggestion_cache;
DROP TABLE IF EXISTS consumption_events;
DROP TABLE IF EXISTS pantry_items;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS match_queue;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS item_aliases;
DROP TABLE IF EXISTS canonical_items;
DROP TABLE IF EXISTS meal_items;
DROP TABLE IF EXISTS meals;
DROP TABLE IF EXISTS daily_targets;
DROP TABLE IF EXISTS profile;
`;
