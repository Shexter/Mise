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

export const MIGRATIONS: readonly string[] = [INITIAL_SCHEMA];

export const LATEST_VERSION = MIGRATIONS.length;

/** Drops every table. Used by "Delete all data" and by the debug reset helper. */
export const DROP_ALL = `
DROP TABLE IF EXISTS meal_items;
DROP TABLE IF EXISTS meals;
DROP TABLE IF EXISTS daily_targets;
DROP TABLE IF EXISTS profile;
`;
