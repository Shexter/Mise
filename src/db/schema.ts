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

/**
 * Migration 7: money-shaped receipts. A line's quantity is a count of
 * containers or a divisible measure, and the two must not be conflated
 * (design.md, "Quantity is two different things") — `quantity_kind` says
 * which. `applies_to_line_id` lets a line-attributed discount reduce a
 * specific food line's recorded price rather than being swept into
 * `non_food`. `subtotal_cents` and `tax_cents` are the receipt's own printed
 * figures, read rather than computed, so the arithmetic check compares
 * extraction against what the till actually said.
 */
const RECEIPT_MONEY_AND_QUANTITY = `
ALTER TABLE receipts ADD COLUMN subtotal_cents INTEGER;
ALTER TABLE receipts ADD COLUMN tax_cents INTEGER;

ALTER TABLE receipt_lines ADD COLUMN quantity_kind TEXT;
ALTER TABLE receipt_lines ADD COLUMN applies_to_line_id TEXT REFERENCES receipt_lines(id);

-- A count line can create several containers from one line (decision: "a count
-- creates one pantry item per container"), so the authoritative link is this
-- reverse reference, not receipt_lines.pantry_item_id, which only ever names
-- one. Internal to queries.ts — not surfaced on the PantryItem type, because
-- nothing outside receipt import needs "which line bought this."
ALTER TABLE pantry_items ADD COLUMN receipt_line_id TEXT REFERENCES receipt_lines(id) ON DELETE SET NULL;

CREATE INDEX idx_pantry_items_receipt_line ON pantry_items(receipt_line_id);
`;

/**
 * Migration 8: the dietary profile. `dietary_rules` holds what the user
 * cannot or will not eat — kind is stored, never inferred (decision: only
 * the user knows whether "no pork" is a restriction or a dislike).
 * `canonical_derivatives` is the general parent/child fact ("butter is
 * derived from milk") that exclusion walks transitively at read time; the
 * graph is small enough that a stored closure would be maintenance for no
 * measurable gain. Both tables are additive — no existing table changes,
 * and a user who records no rules sees no behaviour anywhere (design.md).
 */
const DIETARY_PROFILE = `
CREATE TABLE dietary_rules (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,
  canonical_id    TEXT REFERENCES canonical_items(id),
  text            TEXT NOT NULL,
  normalised_text TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

CREATE INDEX idx_dietary_rules_kind ON dietary_rules(kind);

CREATE TABLE canonical_derivatives (
  parent_id TEXT NOT NULL REFERENCES canonical_items(id) ON DELETE CASCADE,
  child_id  TEXT NOT NULL REFERENCES canonical_items(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX idx_canonical_derivatives_parent ON canonical_derivatives(parent_id);
CREATE INDEX idx_canonical_derivatives_child ON canonical_derivatives(child_id);
`;

/**
 * Migration 9: CJK candidate retrieval (decision 67, `add-cjk-matching`).
 * `getCandidateAliases`'s existing prefilter matches on a shared first
 * trigram or whole token — a CJK reference often has neither, so the
 * correct alias could be scored-worthy and still never reach the scorer.
 * `alias_bigrams` is a bigram key per alias, queried instead of the
 * trigram/token prefilter whenever the reference is not Latin.
 *
 * A row here is only ever a scoring aid, never identity — dropping the
 * table and rebuilding it from `item_aliases` loses nothing. Backfilled in
 * this same migration via a recursive CTE (bigrams over `alias_norm`,
 * pg_trgm-style one-space padding, matching `bigrams()` in
 * `similarity.ts`), restricted to aliases containing a non-ASCII
 * character — the only ones a CJK reference's bigrams could ever overlap
 * with, so a pure-Latin alias is never given a row it will never use.
 */
const CJK_CANDIDATE_RETRIEVAL = `
CREATE TABLE alias_bigrams (
  alias_id TEXT NOT NULL REFERENCES item_aliases(id) ON DELETE CASCADE,
  bigram   TEXT NOT NULL
);

CREATE INDEX idx_alias_bigrams_bigram ON alias_bigrams(bigram);
CREATE INDEX idx_alias_bigrams_alias  ON alias_bigrams(alias_id);

WITH RECURSIVE split(alias_id, padded, pos) AS (
  SELECT id, ' ' || alias_norm || ' ', 1
  FROM item_aliases
  WHERE alias_norm GLOB '*[^ -~]*'
  UNION ALL
  SELECT alias_id, padded, pos + 1
  FROM split
  WHERE pos + 1 <= length(padded) - 1
)
INSERT INTO alias_bigrams (alias_id, bigram)
SELECT alias_id, substr(padded, pos, 2) FROM split;
`;

/**
 * Migration 10: defensible open-data catalogue values. The shipped asset is
 * still the source of the data; these columns make its early-warning range,
 * field-level provenance, and nullable generic nutrition available offline.
 * Existing values predate the pipeline and are therefore hand-authored.
 */
const OPEN_DATA_CATALOGUE = `
ALTER TABLE canonical_items ADD COLUMN early_warning_days INTEGER;
ALTER TABLE canonical_items ADD COLUMN sources TEXT NOT NULL DEFAULT '{"shelfLifeDays":"hand-authored","openLifeDays":"hand-authored","typicalUseQty":"hand-authored","typicalUseUnit":"hand-authored","typicalPkgQty":"hand-authored","typicalPkgUnit":"hand-authored","densityGPerMl":"hand-authored"}';
ALTER TABLE canonical_items ADD COLUMN kcal_per_100 REAL;
ALTER TABLE canonical_items ADD COLUMN protein_per_100 REAL;
ALTER TABLE canonical_items ADD COLUMN carbs_per_100 REAL;
ALTER TABLE canonical_items ADD COLUMN fat_per_100 REAL;
`;

/** Migration 11: venue defaults learned only from a user's correction on an
 * unknown-origin meal. The normalised dish name is the identity; a later
 * correction replaces the earlier value through an upsert. */
const VENUE_INFERENCE = `
CREATE TABLE dish_venue_defaults (
  dish_norm  TEXT PRIMARY KEY,
  venue      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

/** Migration 12: scan and stated target sources. Profile is rebuilt because
 * SQLite cannot remove the Mifflin-only NOT NULL constraints in place. */
const ENERGY_SOURCES = `
ALTER TABLE profile RENAME TO profile_old;
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1), sex TEXT, age INTEGER, height_cm REAL,
  weight_kg REAL NOT NULL, activity_level TEXT NOT NULL, goal TEXT NOT NULL,
  target_calories INTEGER NOT NULL, protein_pct REAL NOT NULL DEFAULT 0.30,
  carbs_pct REAL NOT NULL DEFAULT 0.40, fat_pct REAL NOT NULL DEFAULT 0.30,
  units TEXT NOT NULL DEFAULT 'metric', onboarded_at TEXT NOT NULL,
  target_source TEXT NOT NULL DEFAULT 'estimated', stated_calories INTEGER,
  stated_figure_kind TEXT
);
INSERT INTO profile (id, sex, age, height_cm, weight_kg, activity_level, goal, target_calories, protein_pct, carbs_pct, fat_pct, units, onboarded_at)
SELECT id, sex, age, height_cm, weight_kg, activity_level, goal, target_calories, protein_pct, carbs_pct, fat_pct, units, onboarded_at FROM profile_old;
DROP TABLE profile_old;
CREATE TABLE body_measurements (
  provider TEXT PRIMARY KEY, weight_kg REAL NOT NULL, measured_at TEXT NOT NULL,
  body_fat_pct REAL, lean_tissue_kg REAL, bone_mineral_content_kg REAL,
  fat_free_mass_kg REAL NOT NULL
);
`;

/** Migration 13: unknown but valid GTINs are cached separately from products. */
const BARCODE_MISS_CACHE = `
CREATE TABLE barcode_misses (
  gtin       TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL
);
`;

/** Migration 14: durable offline capture queue. Images stay in the document
 * directory; this table only tracks their retry and deletion lifecycle. */
const PENDING_CAPTURES = `
CREATE TABLE pending_captures (
  id              TEXT PRIMARY KEY,
  image_uri       TEXT NOT NULL,
  detected_kind   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error_kind TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX idx_pending_captures_status ON pending_captures(status, created_at);
`;

/** Migration 15: nullable fibre preserves the honest unknown for old meals. */
const FIBRE_TRACKING = `
ALTER TABLE meal_items ADD COLUMN fibre_g REAL;
ALTER TABLE profile ADD COLUMN fibre_target_g REAL NOT NULL DEFAULT 30;
ALTER TABLE daily_targets ADD COLUMN fibre_g REAL NOT NULL DEFAULT 30;
`;

/** Migration 16: a long receipt is one draft with several durable frames. */
const RECEIPT_FRAMES = `
CREATE TABLE receipt_frames (
  id              TEXT PRIMARY KEY,
  receipt_id      TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  image_uri       TEXT NOT NULL,
  sort_order      INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  last_error_kind TEXT,
  store           TEXT,
  purchased_at    TEXT,
  receipt_type    TEXT,
  subtotal_cents  INTEGER,
  tax_cents       INTEGER,
  total_cents     INTEGER,
  created_at      TEXT NOT NULL,
  extracted_at    TEXT
);
CREATE INDEX idx_receipt_frames_receipt ON receipt_frames(receipt_id, sort_order);

CREATE TABLE receipt_frame_lines (
  id                TEXT PRIMARY KEY,
  frame_id          TEXT NOT NULL REFERENCES receipt_frames(id) ON DELETE CASCADE,
  frame_position    INTEGER NOT NULL,
  raw_text          TEXT NOT NULL,
  kind              TEXT NOT NULL,
  qty               REAL,
  unit              TEXT,
  quantity_kind     TEXT,
  line_total_cents  INTEGER,
  unit_price_cents  INTEGER,
  applies_to_text   TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX idx_receipt_frame_lines_frame ON receipt_frame_lines(frame_id, frame_position);
`;

/** Migration 17: macro-gap cache rows are distinct per requested macro. */
const MACRO_GAP_SUGGESTION_CACHE = `
ALTER TABLE suggestion_cache ADD COLUMN target_macro TEXT;
DROP INDEX IF EXISTS idx_suggestion_cache_date;
CREATE INDEX idx_suggestion_cache_date ON suggestion_cache(local_date, mode, target_macro);
`;

/**
 * Migration 18: a cooked recipe can have a genuinely unknown nutrient when
 * neither the catalogue nor its initial provider response can defend it.
 * Rebuild the table because SQLite cannot remove the original NOT NULL
 * constraints in place; all existing values and carried identities survive.
 */
const NULLABLE_MEAL_NUTRITION = `
ALTER TABLE meal_items RENAME TO meal_items_old;
CREATE TABLE meal_items (
  id TEXT PRIMARY KEY,
  meal_id TEXT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  calories REAL,
  protein_g REAL,
  carbs_g REAL,
  fat_g REAL,
  is_manual_addition INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  canonical_id TEXT REFERENCES canonical_items(id),
  fibre_g REAL
);
INSERT INTO meal_items
  (id, meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g,
   is_manual_addition, sort_order, canonical_id, fibre_g)
SELECT id, meal_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g,
       is_manual_addition, sort_order, canonical_id, fibre_g
FROM meal_items_old;
DROP TABLE meal_items_old;
CREATE INDEX idx_meal_items_meal ON meal_items(meal_id);
`;

/** Migration 19: durable tonight preferences and cache isolation by policy. */
const SUGGESTION_TEMPLATE_PREFERENCES = `
CREATE TABLE suggestion_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_intent TEXT NOT NULL,
  prep_speed TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
ALTER TABLE suggestion_cache ADD COLUMN template_id TEXT;
ALTER TABLE suggestion_cache ADD COLUMN prep_speed TEXT;
DELETE FROM suggestion_cache;
DROP INDEX IF EXISTS idx_suggestion_cache_date;
CREATE INDEX idx_suggestion_cache_date
  ON suggestion_cache(local_date, mode, target_macro, template_id, prep_speed);
`;

/**
 * Migration 20: frame rebuilds must never overwrite a correction the user
 * made while reviewing a receipt. This is deliberately a receipt-level lock:
 * a frame change rebuilds the entire merged line set, not one line.
 */
const RECEIPT_FRAME_EDIT_LOCK = `
ALTER TABLE receipts ADD COLUMN frame_edits_locked INTEGER NOT NULL DEFAULT 0;
`;

/** Migration 21: an explicit multipack count is durable SKU metadata. */
const PRODUCT_CONTAINER_COUNT = `
ALTER TABLE products ADD COLUMN container_count INTEGER CHECK (container_count IS NULL OR container_count > 0);
`;

/** Migration 22: user-saved recipes. A recipe is local data brought in by the
 * user; source links are retained for attribution but are never fetched. */
const SAVED_RECIPES = `
CREATE TABLE recipes (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  source_link TEXT,
  steps_json  TEXT NOT NULL DEFAULT '[]',
  image_uri   TEXT,
  status      TEXT NOT NULL DEFAULT 'ready',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE recipe_ingredients (
  id           TEXT PRIMARY KEY,
  recipe_id    TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  quantity     REAL,
  unit         TEXT,
  canonical_id TEXT REFERENCES canonical_items(id),
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id, sort_order);
CREATE INDEX idx_recipe_ingredients_canonical ON recipe_ingredients(canonical_id);
`;

/** Migration 23: a local, clearable barcode recents list. Product facts and
 * pantry stock remain untouched when this timestamp is cleared. */
const PRODUCT_SCAN_HISTORY = `
ALTER TABLE products ADD COLUMN last_scanned_at TEXT;
CREATE INDEX idx_products_last_scanned ON products(last_scanned_at DESC);
`;

/** Migration 24: local shopping list with explainable source provenance. */
const SHOPPING_LIST = `
CREATE TABLE shopping_list_items (
  id TEXT PRIMARY KEY,
  canonical_id TEXT REFERENCES canonical_items(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  requested_qty REAL,
  requested_unit TEXT,
  note TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX idx_shopping_items_status ON shopping_list_items(status, sort_order, created_at);
CREATE INDEX idx_shopping_items_canonical ON shopping_list_items(canonical_id);

CREATE TABLE shopping_list_sources (
  id TEXT PRIMARY KEY,
  shopping_item_id TEXT NOT NULL REFERENCES shopping_list_items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  source_id TEXT,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  suggestion_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(shopping_item_id, kind, source_id, recipe_id, suggestion_id)
);

CREATE INDEX idx_shopping_sources_item ON shopping_list_sources(shopping_item_id);

CREATE TABLE shopping_list_receipt_matches (
  id TEXT PRIMARY KEY,
  shopping_item_id TEXT NOT NULL REFERENCES shopping_list_items(id) ON DELETE CASCADE,
  receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  receipt_line_id TEXT NOT NULL REFERENCES receipt_lines(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  matched_at TEXT NOT NULL,
  undone_at TEXT
);

CREATE UNIQUE INDEX idx_shopping_receipt_match_once
  ON shopping_list_receipt_matches(shopping_item_id, receipt_line_id);
`;

export const MIGRATIONS: readonly string[] = [
  INITIAL_SCHEMA,
  IDENTITY_LAYER,
  PANTRY_STOCK,
  STOCK_DEPLETION,
  DINNER_DECISION,
  RECEIPT_IMPORT,
  RECEIPT_MONEY_AND_QUANTITY,
  DIETARY_PROFILE,
  CJK_CANDIDATE_RETRIEVAL,
  OPEN_DATA_CATALOGUE,
  VENUE_INFERENCE,
  ENERGY_SOURCES,
  BARCODE_MISS_CACHE,
  PENDING_CAPTURES,
  FIBRE_TRACKING,
  RECEIPT_FRAMES,
  MACRO_GAP_SUGGESTION_CACHE,
  NULLABLE_MEAL_NUTRITION,
  SUGGESTION_TEMPLATE_PREFERENCES,
  RECEIPT_FRAME_EDIT_LOCK,
  PRODUCT_CONTAINER_COUNT,
  SAVED_RECIPES,
  PRODUCT_SCAN_HISTORY,
  SHOPPING_LIST,
];

export const LATEST_VERSION = MIGRATIONS.length;

/** Drops every table. Used by "Delete all data" and by the debug reset helper. */
export const DROP_ALL = `
DROP TABLE IF EXISTS shopping_list_receipt_matches;
DROP TABLE IF EXISTS shopping_list_sources;
DROP TABLE IF EXISTS shopping_list_items;
DROP TABLE IF EXISTS suggestion_preferences;
DROP TABLE IF EXISTS recipe_ingredients;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS dish_venue_defaults;
DROP TABLE IF EXISTS body_measurements;
DROP TABLE IF EXISTS pending_captures;
DROP TABLE IF EXISTS receipt_frame_lines;
DROP TABLE IF EXISTS receipt_frames;
DROP TABLE IF EXISTS barcode_misses;
DROP TABLE IF EXISTS alias_bigrams;
DROP TABLE IF EXISTS dietary_rules;
DROP TABLE IF EXISTS canonical_derivatives;
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
