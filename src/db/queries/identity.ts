import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import canonicalSeed from '../../../assets/canonical-items.json';
import derivativeSeed from '../../../assets/canonical-derivatives.json';
import aliasSeed from '../../../assets/item-aliases.json';
import { db } from '@/db';

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
import { normalise } from '@/logic/normalise';
import { bigrams, dominantScript } from '@/logic/similarity';
import type { CanonicalItem, BarcodeMiss, FoodClass, ItemAlias, MeasureUnit, Product, QueuedMatch, ReferenceSource, SourceId, StorageLocation } from '@/types';
import {
  TransactionHandle,
  CanonicalItemRow,
  ItemAliasRow,
  ProductRow,
  QueuedMatchRow,
  toCanonicalItem,
  toItemAlias,
  toProduct,
  toQueuedMatch,
} from './types';



/* -------------------------------------------------------------------------- */
/* Seed data                                                                   */
/* -------------------------------------------------------------------------- */

interface CanonicalSeedEntry {
  id: string;
  displayName: string;
  class: FoodClass;
  defaultLocation: StorageLocation;
  shelfLifeDays: Partial<Record<StorageLocation, number>>;
  earlyWarningDays?: number | null;
  openLifeDays?: number | null;
  sources?: Partial<Record<string, SourceId>>;
  kcalPer100?: number | null;
  proteinPer100?: number | null;
  carbsPer100?: number | null;
  fatPer100?: number | null;
  fibrePer100?: number | null;
  vitaminCMgPer100?: number | null;
  ironMgPer100?: number | null;
  vitaminB12McgPer100?: number | null;
  calciumMgPer100?: number | null;
  folateMcgPer100?: number | null;
  vitaminAMcgPer100?: number | null;
  potassiumMgPer100?: number | null;
  vitaminDMcgPer100?: number | null;
  magnesiumMgPer100?: number | null;
  zincMgPer100?: number | null;
  sodiumMgPer100?: number | null;
  vitaminEMgPer100?: number | null;
  vitaminKMcgPer100?: number | null;
  thiaminMgPer100?: number | null;
  riboflavinMgPer100?: number | null;
  typicalUseQty?: number;
  typicalUseUnit?: MeasureUnit;
  typicalPkgQty?: number;
  typicalPkgUnit?: MeasureUnit;
  densityGPerMl?: number;
}


interface AliasSeedEntry {
  alias: string;
  canonicalId: string;
  locale?: string;
}


interface DerivativeSeedEntry {
  parent: string;
  child: string;
}


/**
 * Loads the shipped canonical ingredients, aliases, and derivative edges.
 * Idempotent: canonicals are keyed on their slug, aliases on the unique
 * `(alias_norm, canonical_id)` pair, and derivative edges on the
 * `(parent_id, child_id)` primary key — so re-running after a catalogue
 * update inserts only what is new and never duplicates what is there. There
 * is no separate "catalogue version" to bump (confirmed by reading this
 * function before touching it, per task 3.4): this already runs on every
 * app launch (`src/db/index.ts`), so a JSON edit alone is what an existing
 * install needs to pick up new edges. Each canonical's display name is also
 * registered as an alias so the display name itself always resolves.
 */
export async function loadSeedData(handle: SQLiteDatabase = db()): Promise<void> {
  const now = new Date().toISOString();
  const canonicals = canonicalSeed as CanonicalSeedEntry[];
  const aliases = aliasSeed as AliasSeedEntry[];
  const derivatives = derivativeSeed as DerivativeSeedEntry[];

  const runSeed = async (txn: SQLiteDatabase | TransactionHandle) => {
    for (const entry of canonicals) {
      await txn.runAsync(
        `INSERT INTO canonical_items
           (id, display_name, class, default_location, shelf_life_days,
            early_warning_days, open_life_days, sources, kcal_per_100,
            protein_per_100, carbs_per_100, fat_per_100, fibre_per_100,
            vitamin_c_mg_per_100, iron_mg_per_100, vitamin_b12_mcg_per_100,
            calcium_mg_per_100, folate_mcg_per_100, vitamin_a_mcg_per_100,
            potassium_mg_per_100,
            vitamin_d_mcg_per_100, magnesium_mg_per_100, zinc_mg_per_100, sodium_mg_per_100, vitamin_e_mg_per_100, vitamin_k_mcg_per_100, thiamin_mg_per_100, riboflavin_mg_per_100,
            typical_use_qty,
            typical_use_unit, typical_pkg_qty, typical_pkg_unit,
            density_g_per_ml, is_seed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(id) DO UPDATE SET
           display_name = excluded.display_name,
           class = excluded.class,
           default_location = excluded.default_location,
           shelf_life_days = excluded.shelf_life_days,
           early_warning_days = excluded.early_warning_days,
           open_life_days = excluded.open_life_days,
           sources = excluded.sources,
           kcal_per_100 = excluded.kcal_per_100,
           protein_per_100 = excluded.protein_per_100,
           carbs_per_100 = excluded.carbs_per_100,
           fat_per_100 = excluded.fat_per_100,
           fibre_per_100 = excluded.fibre_per_100,
           vitamin_c_mg_per_100 = excluded.vitamin_c_mg_per_100,
           iron_mg_per_100 = excluded.iron_mg_per_100,
           vitamin_b12_mcg_per_100 = excluded.vitamin_b12_mcg_per_100,
           calcium_mg_per_100 = excluded.calcium_mg_per_100,
           folate_mcg_per_100 = excluded.folate_mcg_per_100,
           vitamin_a_mcg_per_100 = excluded.vitamin_a_mcg_per_100,
           potassium_mg_per_100 = excluded.potassium_mg_per_100,
           vitamin_d_mcg_per_100 = excluded.vitamin_d_mcg_per_100,
           magnesium_mg_per_100 = excluded.magnesium_mg_per_100,
           zinc_mg_per_100 = excluded.zinc_mg_per_100,
           sodium_mg_per_100 = excluded.sodium_mg_per_100,
           vitamin_e_mg_per_100 = excluded.vitamin_e_mg_per_100,
           vitamin_k_mcg_per_100 = excluded.vitamin_k_mcg_per_100,
           thiamin_mg_per_100 = excluded.thiamin_mg_per_100,
           riboflavin_mg_per_100 = excluded.riboflavin_mg_per_100,
           typical_use_qty = excluded.typical_use_qty,
           typical_use_unit = excluded.typical_use_unit,
           typical_pkg_qty = excluded.typical_pkg_qty,
           typical_pkg_unit = excluded.typical_pkg_unit,
           density_g_per_ml = excluded.density_g_per_ml
         WHERE canonical_items.is_seed = 1`,
        [
          entry.id,
          entry.displayName,
          entry.class,
          entry.defaultLocation,
          JSON.stringify(entry.shelfLifeDays),
          entry.earlyWarningDays ?? null,
          entry.openLifeDays ?? null,
          JSON.stringify(entry.sources ?? defaultHandAuthoredSources(entry)),
          entry.kcalPer100 ?? null,
          entry.proteinPer100 ?? null,
          entry.carbsPer100 ?? null,
          entry.fatPer100 ?? null,
          entry.fibrePer100 ?? null,
          entry.vitaminCMgPer100 ?? null,
          entry.ironMgPer100 ?? null,
          entry.vitaminB12McgPer100 ?? null,
          entry.calciumMgPer100 ?? null,
          entry.folateMcgPer100 ?? null,
          entry.vitaminAMcgPer100 ?? null,
          entry.potassiumMgPer100 ?? null,
          entry.vitaminDMcgPer100 ?? null,
          entry.magnesiumMgPer100 ?? null,
          entry.zincMgPer100 ?? null,
          entry.sodiumMgPer100 ?? null,
          entry.vitaminEMgPer100 ?? null,
          entry.vitaminKMcgPer100 ?? null,
          entry.thiaminMgPer100 ?? null,
          entry.riboflavinMgPer100 ?? null,
          entry.typicalUseQty ?? null,
          entry.typicalUseUnit ?? null,
          entry.typicalPkgQty ?? null,
          entry.typicalPkgUnit ?? null,
          entry.densityGPerMl ?? null,
          now,
        ],
      );
    }

    const seedAliases: AliasSeedEntry[] = [
      ...canonicals.map((entry) => ({
        alias: entry.displayName,
        canonicalId: entry.id,
      })),
      ...aliases,
    ];
    for (const entry of seedAliases) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO item_aliases
           (id, alias_norm, alias_raw, canonical_id, source, locale,
            confidence, times_confirmed, created_at)
         VALUES (?, ?, ?, ?, 'seed', ?, 1, 0, ?)`,
        [
          randomUUID(),
          normalise(entry.alias),
          entry.alias,
          entry.canonicalId,
          entry.locale ?? null,
          now,
        ],
      );
    }

    for (const entry of derivatives) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO canonical_derivatives (parent_id, child_id) VALUES (?, ?)`,
        [entry.parent, entry.child],
      );
    }

    // `INSERT OR IGNORE` above means a conflicting alias keeps its original
    // row and id — the freshly generated id in the VALUES clause was never
    // written. A backfill pass over every non-Latin alias, rather than
    // trying to track insert-vs-ignore per row, is what actually gets this
    // right: idempotent (each call checks for existing rows first), and it
    // self-heals any alias — seeded or user-added — that predates this
    // migration.
    const nonLatinAliases = await txn.getAllAsync<{
      id: string;
      alias_norm: string;
    }>(`SELECT id, alias_norm FROM item_aliases WHERE alias_norm GLOB '*[^ -~]*'`, []);
    for (const row of nonLatinAliases) {
      await ensureAliasBigrams(txn, row.id, row.alias_norm);
    }
  };

  if (!isWeb && typeof handle.withExclusiveTransactionAsync === 'function') {
    await handle.withExclusiveTransactionAsync(runSeed);
  } else {
    await runSeed(handle);
  }
}


function defaultHandAuthoredSources(
  entry: CanonicalSeedEntry,
): Partial<Record<string, SourceId>> {
  const sources: Partial<Record<string, SourceId>> = {
    shelfLifeDays: 'hand-authored',
  };
  for (const key of [
    'openLifeDays',
    'typicalUseQty',
    'typicalUseUnit',
    'typicalPkgQty',
    'typicalPkgUnit',
    'densityGPerMl',
  ] as const) {
    if (entry[key] != null) sources[key] = 'hand-authored';
  }
  return sources;
}


/* -------------------------------------------------------------------------- */
/* Ingredient identity: reads                                                  */
/* -------------------------------------------------------------------------- */

export async function getCanonicalById(
  id: string,
): Promise<CanonicalItem | null> {
  const row = await db().getFirstAsync<CanonicalItemRow>(
    'SELECT * FROM canonical_items WHERE id = ?',
    [id],
  );
  return row ? toCanonicalItem(row) : null;
}


export async function getAllCanonicals(): Promise<CanonicalItem[]> {
  const rows = await db().getAllAsync<CanonicalItemRow>(
    'SELECT * FROM canonical_items ORDER BY display_name COLLATE NOCASE ASC',
  );
  return rows.map(toCanonicalItem);
}


export async function getProductByBarcode(
  gtin: string,
): Promise<Product | null> {
  const row = await db().getFirstAsync<ProductRow>(
    'SELECT * FROM products WHERE gtin = ?',
    [gtin],
  );
  return row ? toProduct(row) : null;
}


/** Records a successful recognition without changing product facts. */
export async function markProductScanned(id: string, scannedAt: string = new Date().toISOString()): Promise<Product> {
  await db().runAsync('UPDATE products SET last_scanned_at = ? WHERE id = ?', [scannedAt, id]);
  const row = await db().getFirstAsync<ProductRow>('SELECT * FROM products WHERE id = ?', [id]);
  if (!row) throw new Error('Scanned product no longer exists.');
  return toProduct(row);
}


export async function listRecentScannedProducts(): Promise<Product[]> {
  const rows = await db().getAllAsync<ProductRow>(
    'SELECT * FROM products WHERE last_scanned_at IS NOT NULL ORDER BY last_scanned_at DESC',
  );
  return rows.map(toProduct);
}


/** Clears only recency metadata; cached products and pantry stock remain. */
export async function clearRecentBarcodeHistory(): Promise<void> {
  await db().runAsync('UPDATE products SET last_scanned_at = NULL WHERE last_scanned_at IS NOT NULL');
}


export async function getBarcodeMiss(gtin: string): Promise<BarcodeMiss | null> {
  return db().getFirstAsync<BarcodeMiss>(
    'SELECT gtin, fetched_at AS fetchedAt FROM barcode_misses WHERE gtin = ?',
    [gtin],
  );
}


export async function recordBarcodeMiss(gtin: string): Promise<BarcodeMiss> {
  const fetchedAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO barcode_misses (gtin, fetched_at) VALUES (?, ?)
     ON CONFLICT(gtin) DO UPDATE SET fetched_at = excluded.fetched_at`,
    [gtin, fetchedAt],
  );
  return { gtin, fetchedAt };
}


/**
 * The best alias for an exact normalised form. Where the same form points at
 * more than one canonical, a user-made alias wins, then the most-confirmed,
 * then the most confident, then the newest — so a correction beats the
 * mistake it corrected.
 */
export async function getBestAliasByNorm(
  norm: string,
): Promise<ItemAlias | null> {
  const row = await db().getFirstAsync<ItemAliasRow>(
    `SELECT * FROM item_aliases WHERE alias_norm = ?
     ORDER BY (source = 'user') DESC, times_confirmed DESC,
              confidence DESC, created_at DESC
     LIMIT 1`,
    [norm],
  );
  return row ? toItemAlias(row) : null;
}


/**
 * The candidate prefilter for approximate matching. Branches on script
 * (decision 67, task 5.4): a CJK reference often shares no whole token and
 * its first three characters are frequently the entire string, so the
 * Latin prefilter below can withhold the correct candidate from the scorer
 * even when the scorer itself would rank it well — the risk `design.md`
 * calls out as worse than a slow scorer. For CJK, aliases sharing any
 * bigram with the reference are retrieved instead, via `alias_bigrams`.
 */
export async function getCandidateAliases(norm: string): Promise<ItemAlias[]> {
  if (dominantScript(norm) !== 'latin') {
    return getCjkCandidateAliases(norm);
  }

  const clauses: string[] = [];
  const params: string[] = [];

  if (norm.length >= 3) {
    clauses.push('alias_norm LIKE ?');
    params.push(`${norm.slice(0, 3)}%`);
  }
  const tokens = norm
    .split(' ')
    .filter((token) => token.length >= 2 || /[^\x20-\x7e]/.test(token))
    .slice(0, 6);
  for (const token of tokens) {
    clauses.push("(' ' || alias_norm || ' ') LIKE ?");
    params.push(`% ${token} %`);
  }
  if (clauses.length === 0) return [];

  const rows = await db().getAllAsync<ItemAliasRow>(
    `SELECT * FROM item_aliases WHERE ${clauses.join(' OR ')} LIMIT 200`,
    params,
  );
  return rows.map(toItemAlias);
}


/**
 * The bigram-based prefilter for non-Latin references. Whole-string
 * padded bigrams, not the mixed-script token segmentation `similarity.ts`
 * uses for scoring — retrieval only needs one shared bigram to surface a
 * candidate, so the coarser computation is sufficient and keeps this
 * function independent of the scorer's internals.
 */
async function getCjkCandidateAliases(norm: string): Promise<ItemAlias[]> {
  const grams = [...bigrams(norm)];
  if (grams.length === 0) return [];

  const placeholders = grams.map(() => '?').join(', ');
  const rows = await db().getAllAsync<ItemAliasRow>(
    `SELECT DISTINCT ia.* FROM item_aliases ia
     JOIN alias_bigrams ab ON ab.alias_id = ia.id
     WHERE ab.bigram IN (${placeholders})
     LIMIT 200`,
    grams,
  );
  return rows.map(toItemAlias);
}


/**
 * Backfills `alias_bigrams` for one alias, if it does not have rows yet.
 * Called after every write to `item_aliases` that could be non-Latin —
 * seed load, write-back, and user confirmation — so a reference resolved
 * only once still becomes locally retrievable next time (task 5.3). Skips
 * pure-Latin aliases, which the Latin prefilter already covers.
 */
async function ensureAliasBigrams(
  runner: TransactionHandle,
  aliasId: string,
  aliasNorm: string,
): Promise<void> {
  if (dominantScript(aliasNorm) === 'latin') return;
  const existing = await runner.getFirstAsync<{ hit: number }>(
    'SELECT 1 as hit FROM alias_bigrams WHERE alias_id = ? LIMIT 1',
    [aliasId],
  );
  if (existing) return;
  for (const gram of bigrams(aliasNorm)) {
    await runner.runAsync(
      'INSERT INTO alias_bigrams (alias_id, bigram) VALUES (?, ?)',
      [aliasId, gram],
    );
  }
}


/* -------------------------------------------------------------------------- */
/* Ingredient identity: writes                                                 */
/* -------------------------------------------------------------------------- */

export interface NewCanonicalItem {
  id: string;
  displayName: string;
  foodClass: FoodClass;
  defaultLocation: StorageLocation;
  shelfLifeDays: Partial<Record<StorageLocation, number>>;
  earlyWarningDays?: number | null;
  openLifeDays?: number | null;
  sources?: Partial<Record<string, SourceId>>;
  kcalPer100?: number | null;
  proteinPer100?: number | null;
  carbsPer100?: number | null;
  fatPer100?: number | null;
  fibrePer100?: number | null;
  vitaminCMgPer100?: number | null;
  ironMgPer100?: number | null;
  vitaminB12McgPer100?: number | null;
  calciumMgPer100?: number | null;
  folateMcgPer100?: number | null;
  vitaminAMcgPer100?: number | null;
  potassiumMgPer100?: number | null;
  vitaminDMcgPer100?: number | null;
  magnesiumMgPer100?: number | null;
  zincMgPer100?: number | null;
  sodiumMgPer100?: number | null;
  vitaminEMgPer100?: number | null;
  vitaminKMcgPer100?: number | null;
  thiaminMgPer100?: number | null;
  riboflavinMgPer100?: number | null;
  typicalUseQty?: number | null;
  typicalUseUnit?: MeasureUnit | null;
  typicalPkgQty?: number | null;
  typicalPkgUnit?: MeasureUnit | null;
  densityGPerMl?: number | null;
}


export async function insertCanonicalItem(
  item: NewCanonicalItem,
): Promise<CanonicalItem> {
  const createdAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO canonical_items
       (id, display_name, class, default_location, shelf_life_days,
        early_warning_days, open_life_days, sources, kcal_per_100,
        protein_per_100, carbs_per_100, fat_per_100, fibre_per_100,
        vitamin_c_mg_per_100, iron_mg_per_100, vitamin_b12_mcg_per_100,
        calcium_mg_per_100, folate_mcg_per_100, vitamin_a_mcg_per_100,
        potassium_mg_per_100,
        vitamin_d_mcg_per_100, magnesium_mg_per_100, zinc_mg_per_100, sodium_mg_per_100, vitamin_e_mg_per_100, vitamin_k_mcg_per_100, thiamin_mg_per_100, riboflavin_mg_per_100,
        typical_use_qty,
        typical_use_unit, typical_pkg_qty, typical_pkg_unit,
        density_g_per_ml, is_seed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      item.id,
      item.displayName,
      item.foodClass,
      item.defaultLocation,
      JSON.stringify(item.shelfLifeDays),
      item.earlyWarningDays ?? null,
      item.openLifeDays ?? null,
      JSON.stringify(item.sources ?? {
        shelfLifeDays: 'hand-authored',
        openLifeDays: 'hand-authored',
      }),
      item.kcalPer100 ?? null,
      item.proteinPer100 ?? null,
      item.carbsPer100 ?? null,
      item.fatPer100 ?? null,
      item.fibrePer100 ?? null,
      item.vitaminCMgPer100 ?? null,
      item.ironMgPer100 ?? null,
      item.vitaminB12McgPer100 ?? null,
      item.calciumMgPer100 ?? null,
      item.folateMcgPer100 ?? null,
      item.vitaminAMcgPer100 ?? null,
      item.potassiumMgPer100 ?? null,
      item.vitaminDMcgPer100 ?? null,
      item.magnesiumMgPer100 ?? null,
      item.zincMgPer100 ?? null,
      item.sodiumMgPer100 ?? null,
      item.vitaminEMgPer100 ?? null,
      item.vitaminKMcgPer100 ?? null,
      item.thiaminMgPer100 ?? null,
      item.riboflavinMgPer100 ?? null,
      item.typicalUseQty ?? null,
      item.typicalUseUnit ?? null,
      item.typicalPkgQty ?? null,
      item.typicalPkgUnit ?? null,
      item.densityGPerMl ?? null,
      createdAt,
    ],
  );
  return {
    id: item.id,
    displayName: item.displayName,
    foodClass: item.foodClass,
    defaultLocation: item.defaultLocation,
    shelfLifeDays: item.shelfLifeDays,
    earlyWarningDays: item.earlyWarningDays ?? null,
    openLifeDays: item.openLifeDays ?? null,
    sources: item.sources ?? {
      shelfLifeDays: 'hand-authored',
      openLifeDays: 'hand-authored',
    },
    kcalPer100: item.kcalPer100 ?? null,
    proteinPer100: item.proteinPer100 ?? null,
    carbsPer100: item.carbsPer100 ?? null,
    fatPer100: item.fatPer100 ?? null,
    fibrePer100: item.fibrePer100 ?? null,
    vitaminCMgPer100: item.vitaminCMgPer100 ?? null,
    ironMgPer100: item.ironMgPer100 ?? null,
    vitaminB12McgPer100: item.vitaminB12McgPer100 ?? null,
    calciumMgPer100: item.calciumMgPer100 ?? null,
    folateMcgPer100: item.folateMcgPer100 ?? null,
    vitaminAMcgPer100: item.vitaminAMcgPer100 ?? null,
    potassiumMgPer100: item.potassiumMgPer100 ?? null,
    vitaminDMcgPer100: item.vitaminDMcgPer100 ?? null,
    magnesiumMgPer100: item.magnesiumMgPer100 ?? null,
    zincMgPer100: item.zincMgPer100 ?? null,
    sodiumMgPer100: item.sodiumMgPer100 ?? null,
    vitaminEMgPer100: item.vitaminEMgPer100 ?? null,
    vitaminKMcgPer100: item.vitaminKMcgPer100 ?? null,
    thiaminMgPer100: item.thiaminMgPer100 ?? null,
    riboflavinMgPer100: item.riboflavinMgPer100 ?? null,
    typicalUseQty: item.typicalUseQty ?? null,
    typicalUseUnit: item.typicalUseUnit ?? null,
    typicalPkgQty: item.typicalPkgQty ?? null,
    typicalPkgUnit: item.typicalPkgUnit ?? null,
    densityGPerMl: item.densityGPerMl ?? null,
    isSeed: false,
    createdAt,
  };
}


export interface NewItemAlias {
  aliasRaw: string;
  canonicalId: string;
  source: ReferenceSource;
  locale?: string | null;
  confidence?: number;
}


/**
 * Records a resolution as an alias (decision 27). Upserts on the
 * `(alias_norm, canonical_id)` pair: seeing the same mapping again counts as
 * a confirmation rather than creating a duplicate.
 */
export async function recordAlias(alias: NewItemAlias): Promise<void> {
  const norm = normalise(alias.aliasRaw);
  await db().runAsync(
    `INSERT INTO item_aliases
       (id, alias_norm, alias_raw, canonical_id, source, locale,
        confidence, times_confirmed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(alias_norm, canonical_id) DO UPDATE SET
       times_confirmed = times_confirmed + 1,
       confidence = MAX(confidence, excluded.confidence),
       source = CASE WHEN excluded.source = 'user' THEN 'user' ELSE source END`,
    [
      randomUUID(),
      norm,
      alias.aliasRaw,
      alias.canonicalId,
      alias.source,
      alias.locale ?? null,
      alias.confidence ?? 1,
      new Date().toISOString(),
    ],
  );

  // The upsert above may have kept an existing row's original id rather
  // than the one just generated (`ON CONFLICT` never touches `id`) — look
  // it up rather than assume, so a non-Latin write-back is retrievable by
  // the next unseeded sighting of the same reference (task 5.3).
  const row = await db().getFirstAsync<{ id: string }>(
    'SELECT id FROM item_aliases WHERE alias_norm = ? AND canonical_id = ?',
    [norm, alias.canonicalId],
  );
  if (row) await ensureAliasBigrams(db(), row.id, norm);
}


/**
 * Records a user confirmation or correction. The corrected mapping is
 * written with source `user`, and any alias with the same normalised form
 * pointing elsewhere is removed, so the correction wins every later lookup.
 */
export async function recordUserResolution(
  aliasRaw: string,
  canonicalId: string,
): Promise<void> {
  const norm = normalise(aliasRaw);
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'DELETE FROM item_aliases WHERE alias_norm = ? AND canonical_id != ?',
      [norm, canonicalId],
    );
    await txn.runAsync(
      `INSERT INTO item_aliases
         (id, alias_norm, alias_raw, canonical_id, source, locale,
          confidence, times_confirmed, created_at)
       VALUES (?, ?, ?, ?, 'user', NULL, 1, 1, ?)
       ON CONFLICT(alias_norm, canonical_id) DO UPDATE SET
         times_confirmed = times_confirmed + 1,
         confidence = 1,
         source = 'user'`,
      [randomUUID(), norm, aliasRaw, canonicalId, new Date().toISOString()],
    );

    const row = await txn.getFirstAsync<{ id: string }>(
      'SELECT id FROM item_aliases WHERE alias_norm = ? AND canonical_id = ?',
      [norm, canonicalId],
    );
    if (row) await ensureAliasBigrams(txn, row.id, norm);
  });
}


/**
 * Removes a learned alias — used when the user rejects a proposed match so
 * the same wrong mapping is not offered again. Seed aliases stay.
 */
export async function deleteLearnedAlias(
  aliasRaw: string,
  canonicalId: string,
): Promise<void> {
  await db().runAsync(
    `DELETE FROM item_aliases
     WHERE alias_norm = ? AND canonical_id = ? AND source != 'seed'`,
    [normalise(aliasRaw), canonicalId],
  );
}


export interface NewProduct {
  gtin?: string | null;
  brand?: string | null;
  name: string;
  pkgQty?: number | null;
  pkgUnit?: MeasureUnit | null;
  /** Explicit pack count only; omit when an update must preserve the current count. */
  containerCount?: number | null;
  canonicalId: string;
  kcalPer100?: number | null;
  proteinPer100?: number | null;
  carbsPer100?: number | null;
  fatPer100?: number | null;
  fibrePer100?: number | null;
  source: ReferenceSource;
}


export async function insertProduct(product: NewProduct): Promise<Product> {
  const id = randomUUID();
  const fetchedAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO products
       (id, gtin, brand, name, pkg_qty, pkg_unit, container_count, canonical_id,
        kcal_per_100, protein_per_100, carbs_per_100, fat_per_100, fibre_per_100, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      product.gtin ?? null,
      product.brand ?? null,
      product.name,
      product.pkgQty ?? null,
      product.pkgUnit ?? null,
      product.containerCount ?? null,
      product.canonicalId,
      product.kcalPer100 ?? null,
      product.proteinPer100 ?? null,
      product.carbsPer100 ?? null,
      product.fatPer100 ?? null,
      product.fibrePer100 ?? null,
      product.source,
      fetchedAt,
    ],
  );
  return {
    id,
    gtin: product.gtin ?? null,
    brand: product.brand ?? null,
    name: product.name,
    pkgQty: product.pkgQty ?? null,
    pkgUnit: product.pkgUnit ?? null,
    containerCount: product.containerCount ?? null,
    canonicalId: product.canonicalId,
    kcalPer100: product.kcalPer100 ?? null,
    proteinPer100: product.proteinPer100 ?? null,
    carbsPer100: product.carbsPer100 ?? null,
    fatPer100: product.fatPer100 ?? null,
    fibrePer100: product.fibrePer100 ?? null,
    source: product.source,
    fetchedAt,
    lastScannedAt: null,
  };
}


/** Stores refreshed Open Food Facts fields without creating a second GTIN row. */
export async function upsertProduct(product: NewProduct): Promise<Product> {
  const existing = product.gtin ? await getProductByBarcode(product.gtin) : null;
  if (!existing) return insertProduct(product);
  const fetchedAt = new Date().toISOString();
  const containerCount = product.containerCount === undefined ? existing.containerCount : product.containerCount;
  await db().runAsync(
    `UPDATE products SET brand = ?, name = ?, pkg_qty = ?, pkg_unit = ?, container_count = ?, canonical_id = ?,
      kcal_per_100 = ?, protein_per_100 = ?, carbs_per_100 = ?, fat_per_100 = ?, fibre_per_100 = ?, source = ?, fetched_at = ?
     WHERE id = ?`,
    [product.brand ?? null, product.name, product.pkgQty ?? null, product.pkgUnit ?? null, containerCount,
      product.canonicalId, product.kcalPer100 ?? null, product.proteinPer100 ?? null,
      product.carbsPer100 ?? null, product.fatPer100 ?? null, product.fibrePer100 ?? null, product.source, fetchedAt, existing.id],
  );
  return { ...existing, ...product, containerCount, gtin: product.gtin ?? null, fetchedAt };
}


/* -------------------------------------------------------------------------- */
/* Match queue                                                                 */
/* -------------------------------------------------------------------------- */

export interface NewQueuedMatch {
  rawText: string;
  source: ReferenceSource;
  context?: string | null;
  suggestedId?: string | null;
  confidence?: number | null;
}


export async function enqueueMatch(entry: NewQueuedMatch): Promise<void> {
  await db().runAsync(
    `INSERT INTO match_queue
       (id, raw_text, source, context, suggested_id, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      entry.rawText,
      entry.source,
      entry.context ?? null,
      entry.suggestedId ?? null,
      entry.confidence ?? null,
      new Date().toISOString(),
    ],
  );
}


export async function getMatchQueue(): Promise<QueuedMatch[]> {
  const rows = await db().getAllAsync<QueuedMatchRow>(
    'SELECT * FROM match_queue ORDER BY created_at DESC',
  );
  return rows.map(toQueuedMatch);
}


export async function deleteQueuedMatch(id: string): Promise<void> {
  await db().runAsync('DELETE FROM match_queue WHERE id = ?', [id]);
}


/**
 * Resolves a queued reference to a canonical ingredient: writes the alias so
 * the same reference resolves automatically next time, then removes the
 * queue entry.
 */
export async function resolveQueuedMatch(
  id: string,
  canonicalId: string,
): Promise<void> {
  const row = await db().getFirstAsync<QueuedMatchRow>(
    'SELECT * FROM match_queue WHERE id = ?',
    [id],
  );
  if (!row) return;
  await recordUserResolution(row.raw_text, canonicalId);
  await deleteQueuedMatch(id);
}


/* -------------------------------------------------------------------------- */
/* Merge                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Merges two canonical ingredients (decision 29). One transaction: aliases
 * and products repoint at the survivor, queue suggestions follow, and the
 * absorbed canonical is deleted so it can never be offered as a match again.
 * Where both sides carry the same alias form, the survivor's row is kept and
 * the absorbed duplicate is dropped by the cascade delete. Not undoable.
 */
export async function mergeCanonicals(
  survivorId: string,
  absorbedId: string,
): Promise<void> {
  if (survivorId === absorbedId) {
    throw new Error('Cannot merge a canonical ingredient into itself.');
  }
  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'UPDATE OR IGNORE item_aliases SET canonical_id = ? WHERE canonical_id = ?',
      [survivorId, absorbedId],
    );
    await txn.runAsync(
      'UPDATE products SET canonical_id = ? WHERE canonical_id = ?',
      [survivorId, absorbedId],
    );
    await txn.runAsync(
      'UPDATE match_queue SET suggested_id = ? WHERE suggested_id = ?',
      [survivorId, absorbedId],
    );
    await txn.runAsync('DELETE FROM canonical_items WHERE id = ?', [
      absorbedId,
    ]);
  });
}
