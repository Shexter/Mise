import { readFile, writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

import aliasSeed from '../assets/item-aliases.json';
import cofidSelections from '../assets/catalogue-cofid-selections.json';
import fdcSelections from '../assets/catalogue-fdc-selections.json';
import { resolve, type MatchOutcome, type MatchStore } from '../src/logic/match';
import { normalise } from '../src/logic/normalise';
import { similarity } from '../src/logic/similarity';
import type {
  FoodClass,
  MeasureUnit,
  SourceId,
  StorageLocation,
} from '../src/types';

export const FOODKEEPER_URL =
  'https://web.archive.org/web/20250702182320id_/https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json';
export const FDC_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
export const FDC_FOODS_URL = 'https://api.nal.usda.gov/fdc/v1/foods';

export const CATALOGUE_SOURCES = {
  'hand-authored': {
    name: 'Mise catalogue',
    licence: 'MIT project data',
    url: 'https://github.com/',
  },
  foodkeeper: {
    name: 'USDA FoodKeeper',
    licence: 'US federal government work — public domain',
    url: 'https://www.foodsafety.gov/keep-food-safe/foodkeeper-app',
    snapshot: '2025-07-02 (FMA-Data-v128.xlsx)',
  },
  'food-data-central': {
    name: 'USDA FoodData Central',
    licence: 'CC0 1.0',
    url: 'https://fdc.nal.usda.gov/data-documentation.html',
  },
  cofid: {
    name: "McCance and Widdowson's Composition of Foods Integrated Dataset 2021",
    licence: 'Open Government Licence v3.0',
    url: 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid',
    attribution: 'Contains public sector information licensed under the Open Government Licence v3.0.',
  },
} as const;

export interface CatalogueEntry {
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

export interface CataloguePatch {
  shelfLifeDays?: Partial<Record<StorageLocation, number>>;
  earlyWarningDays?: number | null;
  openLifeDays?: number | null;
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
}

export interface BuildIssue {
  source: SourceId;
  row: string;
  canonicalId?: string;
  field?: string;
  existing?: unknown;
  proposed?: unknown;
  reason?: string;
}

export interface BuildReport {
  sources: typeof CATALOGUE_SOURCES;
  foodkeeper: {
    rows: number;
    matched: number;
    uncertain: BuildIssue[];
    unmatched: string[];
    guarded: BuildIssue[];
  };
  foodDataCentral: {
    queried: number;
    matched: number;
    unmatched: string[];
    review: Record<string, FdcReviewCandidate[]>;
    skipped: boolean;
  };
  cofid: { reviewed: number; matched: number };
  filled: BuildIssue[];
  conflicts: BuildIssue[];
  skipped: BuildIssue[];
}

type FlatRow = Record<string, unknown>;

interface FdcFoodNutrient {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
  nutrient?: { id?: number; name?: string; unitName?: string };
  amount?: number;
}

export interface FdcFood {
  fdcId?: number;
  description?: string;
  dataType?: string;
  foodCategory?: string | { description?: string };
  foodNutrients?: FdcFoodNutrient[];
}

export interface FdcReviewCandidate {
  fdcId: number | null;
  description: string;
  dataType: string | null;
  foodCategory: string | null;
  outcome: MatchOutcome['status'] | 'not_evaluated';
  matchedCanonicalId: string | null;
  confidence: number | null;
}

interface FdcSearchResponse {
  foods?: FdcFood[];
}

interface CofidSelection {
  rowId: string;
  description: string;
  sample: string;
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
}

interface RunOptions {
  inputPath: string;
  outputPath: string;
  reportPath: string;
  sourcesPath: string;
  foodKeeperPath?: string;
  skipNutrition: boolean;
  apiKey?: string;
}

const LOCATION_PREFIXES: Record<Exclude<StorageLocation, 'counter'>, readonly string[]> = {
  pantry: ['DOP_Pantry', 'Pantry'],
  fridge: ['DOP_Refrigerate', 'Refrigerate'],
  freezer: ['DOP_Freeze', 'Freeze'],
};

const SPECIES = [
  'beef',
  'chicken',
  'duck',
  'lamb',
  'pork',
  'salmon',
  'shrimp',
  'turkey',
  'tuna',
] as const;

export function flattenFoodKeeperRow(cells: unknown): FlatRow {
  if (!Array.isArray(cells)) return {};
  return Object.assign(
    {},
    ...cells.filter(
      (cell): cell is Record<string, unknown> =>
        typeof cell === 'object' && cell !== null && !Array.isArray(cell),
    ),
  ) as FlatRow;
}

export function foodKeeperRows(workbook: unknown): FlatRow[] {
  if (typeof workbook !== 'object' || workbook === null) return [];
  const sheets = (workbook as { sheets?: unknown }).sheets;
  if (!Array.isArray(sheets)) return [];
  const product = sheets.find(
    (sheet) =>
      typeof sheet === 'object' &&
      sheet !== null &&
      (sheet as { name?: unknown }).name === 'Product',
  ) as { data?: unknown } | undefined;
  if (!Array.isArray(product?.data)) return [];
  return product.data.map(flattenFoodKeeperRow);
}

export function durationToDays(value: unknown, metric: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  if (typeof metric !== 'string') return null;
  switch (metric.trim().toLowerCase()) {
    case 'hour':
    case 'hours':
      return Math.max(1, Math.ceil(value / 24));
    case 'day':
    case 'days':
      return Math.round(value);
    case 'week':
    case 'weeks':
      return Math.round(value * 7);
    case 'month':
    case 'months':
      return Math.round(value * 30);
    case 'year':
    case 'years':
      return Math.round(value * 365);
    case 'indefinitely':
    case 'when ripe':
    case 'not recommended':
    case 'package use-by date':
      return null;
    default:
      return null;
  }
}

function rangeFor(row: FlatRow, prefixes: readonly string[]): { min: number; max: number } | null {
  for (const prefix of prefixes) {
    const metric = row[`${prefix}_Metric`];
    const min = durationToDays(row[`${prefix}_Min`], metric);
    const max = durationToDays(row[`${prefix}_Max`], metric);
    if (min !== null || max !== null) {
      const low = min ?? max;
      const high = max ?? min;
      if (low !== null && high !== null) {
        return { min: Math.min(low, high), max: Math.max(low, high) };
      }
    }
  }
  return null;
}

function storageKey(location: StorageLocation): Exclude<StorageLocation, 'counter'> {
  return location === 'counter' ? 'pantry' : location;
}

export function mapFoodKeeperRow(
  row: FlatRow,
  defaultLocation: StorageLocation,
): CataloguePatch {
  const ranges: Partial<Record<Exclude<StorageLocation, 'counter'>, { min: number; max: number }>> = {};
  for (const [location, prefixes] of Object.entries(LOCATION_PREFIXES) as [
    Exclude<StorageLocation, 'counter'>,
    readonly string[],
  ][]) {
    const range = rangeFor(row, prefixes);
    if (range) ranges[location] = range;
  }

  const shelfLifeDays: Partial<Record<StorageLocation, number>> = {};
  for (const [location, range] of Object.entries(ranges) as [
    Exclude<StorageLocation, 'counter'>,
    { min: number; max: number },
  ][]) {
    shelfLifeDays[location] = range.max;
  }

  const preferredLocation = storageKey(defaultLocation);
  const preferred = ranges[preferredLocation];
  const openPrefixes = [
    `${preferredLocation === 'fridge' ? 'Refrigerate' : preferredLocation === 'freezer' ? 'Freeze' : 'Pantry'}_After_Opening`,
    'Refrigerate_After_Opening',
    'Pantry_After_Opening',
  ];
  const opened = rangeFor(row, openPrefixes);

  return {
    shelfLifeDays,
    earlyWarningDays:
      preferred && preferred.min < preferred.max ? preferred.min : null,
    openLifeDays: opened?.max ?? null,
  };
}

function initialSources(entry: CatalogueEntry): Partial<Record<string, SourceId>> {
  const sources = { ...(entry.sources ?? {}) };
  for (const location of Object.keys(entry.shelfLifeDays) as StorageLocation[]) {
    sources[`shelfLifeDays.${location}`] ??= 'hand-authored';
  }
  for (const key of [
    'earlyWarningDays',
    'openLifeDays',
    'kcalPer100',
    'proteinPer100',
    'carbsPer100',
    'fatPer100',
    'fibrePer100',
    'vitaminCMgPer100',
    'ironMgPer100',
    'vitaminB12McgPer100',
    'calciumMgPer100',
    'folateMcgPer100',
    'vitaminAMcgPer100',
    'potassiumMgPer100',
    'vitaminDMcgPer100',
    'magnesiumMgPer100',
    'zincMgPer100',
    'sodiumMgPer100',
    'vitaminEMgPer100',
    'vitaminKMcgPer100',
    'thiaminMgPer100',
    'riboflavinMgPer100',
    'typicalUseQty',
    'typicalUseUnit',
    'typicalPkgQty',
    'typicalPkgUnit',
    'densityGPerMl',
  ] as const) {
    if (entry[key] != null) sources[key] ??= 'hand-authored';
  }
  return sources;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeCataloguePatch(
  original: CatalogueEntry,
  patch: CataloguePatch,
  source: SourceId,
  row: string,
  report: Pick<BuildReport, 'filled' | 'conflicts' | 'skipped'>,
): CatalogueEntry {
  const entry: CatalogueEntry = {
    ...original,
    shelfLifeDays: { ...original.shelfLifeDays },
    sources: initialSources(original),
  };

  const apply = (field: keyof CataloguePatch, value: number | null | undefined) => {
    if (value == null) {
      report.skipped.push({ source, row, canonicalId: entry.id, field, reason: 'unknown' });
      return;
    }
    const existing = entry[field];
    if (existing == null) {
      (entry as unknown as Record<string, unknown>)[field] = value;
      entry.sources![field] = source;
      report.filled.push({ source, row, canonicalId: entry.id, field, proposed: value });
    } else if (entry.sources![field] === source) {
      if (!sameValue(existing, value)) {
        (entry as unknown as Record<string, unknown>)[field] = value;
        report.filled.push({ source, row, canonicalId: entry.id, field, existing, proposed: value });
      }
    } else if (!sameValue(existing, value)) {
      report.conflicts.push({ source, row, canonicalId: entry.id, field, existing, proposed: value });
    }
  };

  for (const [location, value] of Object.entries(patch.shelfLifeDays ?? {}) as [
    StorageLocation,
    number,
  ][]) {
    const field = `shelfLifeDays.${location}`;
    const existing = entry.shelfLifeDays[location];
    if (existing == null) {
      entry.shelfLifeDays[location] = value;
      entry.sources![field] = source;
      report.filled.push({ source, row, canonicalId: entry.id, field, proposed: value });
    } else if (entry.sources![field] === source) {
      if (existing !== value) {
        entry.shelfLifeDays[location] = value;
        report.filled.push({ source, row, canonicalId: entry.id, field, existing, proposed: value });
      }
    } else if (existing !== value) {
      report.conflicts.push({ source, row, canonicalId: entry.id, field, existing, proposed: value });
    }
  }

  apply('earlyWarningDays', patch.earlyWarningDays);
  apply('openLifeDays', patch.openLifeDays);
  apply('kcalPer100', patch.kcalPer100);
  apply('proteinPer100', patch.proteinPer100);
  apply('carbsPer100', patch.carbsPer100);
  apply('fatPer100', patch.fatPer100);
  apply('fibrePer100', patch.fibrePer100);
  apply('vitaminCMgPer100', patch.vitaminCMgPer100);
  apply('ironMgPer100', patch.ironMgPer100);
  apply('vitaminB12McgPer100', patch.vitaminB12McgPer100);
  apply('calciumMgPer100', patch.calciumMgPer100);
  apply('folateMcgPer100', patch.folateMcgPer100);
  apply('vitaminAMcgPer100', patch.vitaminAMcgPer100);
  apply('potassiumMgPer100', patch.potassiumMgPer100);
  apply('vitaminDMcgPer100', patch.vitaminDMcgPer100);
  apply('magnesiumMgPer100', patch.magnesiumMgPer100);
  apply('zincMgPer100', patch.zincMgPer100);
  apply('sodiumMgPer100', patch.sodiumMgPer100);
  apply('vitaminEMgPer100', patch.vitaminEMgPer100);
  apply('vitaminKMcgPer100', patch.vitaminKMcgPer100);
  apply('thiaminMgPer100', patch.thiaminMgPer100);
  apply('riboflavinMgPer100', patch.riboflavinMgPer100);
  return entry;
}

function inMemoryMatchStore(entries: readonly CatalogueEntry[]): MatchStore {
  const aliases = [
    ...entries.map((entry) => ({ alias: entry.displayName, canonicalId: entry.id })),
    ...(aliasSeed as { alias: string; canonicalId: string }[]),
  ].map((entry) => ({
    canonicalId: entry.canonicalId,
    aliasNorm: normalise(entry.alias),
  }));
  const exact = new Map(aliases.map((entry) => [entry.aliasNorm, entry.canonicalId]));
  return {
    productCanonicalByBarcode: async () => null,
    exactAliasCanonical: async (norm) => {
      const canonicalId = exact.get(norm);
      return canonicalId ? { canonicalId, confidence: 1 } : null;
    },
    candidateAliases: async () => aliases,
    rememberAlias: async () => undefined,
    enqueue: async () => undefined,
  };
}

function labelForFoodKeeper(row: FlatRow): string {
  const name = typeof row.Name === 'string' ? row.Name.trim() : '';
  const subtitle = typeof row.Name_subtitle === 'string' ? row.Name_subtitle.trim() : '';
  return subtitle ? `${name}, ${subtitle}` : name;
}

export function hasSpeciesConflict(canonicalName: string, datasetName: string): boolean {
  const canonical = canonicalName.toLowerCase();
  const dataset = datasetName.toLowerCase();
  const expected = SPECIES.find((species) => canonical.includes(species));
  if (!expected) return false;
  const observed = SPECIES.find((species) => dataset.includes(species));
  return observed != null && observed !== expected;
}

async function resolveLabels(
  labels: readonly string[],
  entries: readonly CatalogueEntry[],
): Promise<MatchOutcome[]> {
  return resolve(
    labels.map((raw) => ({ raw })),
    'dataset',
    { store: inMemoryMatchStore(entries) },
  );
}

export async function enrichWithFoodKeeper(
  entries: readonly CatalogueEntry[],
  rows: readonly FlatRow[],
  report: BuildReport,
): Promise<CatalogueEntry[]> {
  const labels = rows.map(labelForFoodKeeper);
  const outcomes = await resolveLabels(labels, entries);
  const best = new Map<string, { row: FlatRow; label: string; outcome: Extract<MatchOutcome, { status: 'resolved' }> }>();
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  outcomes.forEach((outcome, index) => {
    const label = labels[index] ?? '';
    const row = rows[index] ?? {};
    if (outcome?.status === 'needs_confirmation') {
      report.foodkeeper.uncertain.push({
        source: 'foodkeeper',
        row: label,
        canonicalId: outcome.canonicalId,
        proposed: outcome.confidence,
      });
      return;
    }
    if (outcome?.status !== 'resolved') {
      if (label) report.foodkeeper.unmatched.push(label);
      return;
    }
    const canonical = byId.get(outcome.canonicalId);
    if (!canonical) return;
    if (hasSpeciesConflict(canonical.displayName, label)) {
      report.foodkeeper.guarded.push({
        source: 'foodkeeper',
        row: label,
        canonicalId: canonical.id,
        reason: 'species mismatch',
      });
      return;
    }
    const current = best.get(canonical.id);
    if (!current || outcome.confidence > current.outcome.confidence) {
      best.set(canonical.id, { row, label, outcome });
    }
  });

  report.foodkeeper.matched = best.size;
  return entries.map((original) => {
    const match = best.get(original.id);
    if (!match) return { ...original, sources: initialSources(original) };
    const patch = mapFoodKeeperRow(match.row, original.defaultLocation);
    const defaultKey = storageKey(original.defaultLocation);
    const proposedExpiry = patch.shelfLifeDays?.[defaultKey];
    const existingExpiry = original.shelfLifeDays[defaultKey];
    if (existingExpiry != null && proposedExpiry != null && existingExpiry !== proposedExpiry) {
      patch.earlyWarningDays = null;
    }
    return mergeCataloguePatch(original, patch, 'foodkeeper', match.label, report);
  });
}

function nutrientValue(food: FdcFood, id: number, name: RegExp): number | null {
  const nutrients = food.foodNutrients ?? [];
  const nutrient =
    nutrients.find((candidate) => (candidate.nutrientId ?? candidate.nutrient?.id) === id) ??
    nutrients.find((candidate) => {
      const candidateName = candidate.nutrientName ?? candidate.nutrient?.name ?? '';
      const unit = candidate.unitName ?? candidate.nutrient?.unitName ?? '';
      return name.test(candidateName) && (id !== 1008 || unit.toLowerCase() === 'kcal');
    });
  const value = nutrient?.value ?? nutrient?.amount;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function nutritionFromFdc(food: FdcFood): CataloguePatch {
  return {
    kcalPer100: nutrientValue(food, 1008, /^energy(?:\s*\(|$)/i),
    proteinPer100: nutrientValue(food, 1003, /^protein$/i),
    carbsPer100: nutrientValue(food, 1005, /carbohydrate, by difference/i),
    fatPer100: nutrientValue(food, 1004, /total lipid \(fat\)/i),
    fibrePer100: nutrientValue(food, 1079, /fiber, total dietary/i),
    vitaminCMgPer100: nutrientValue(food, 1162, /vitamin c, total ascorbic acid/i),
    ironMgPer100: nutrientValue(food, 1089, /^iron, fe$/i),
    // Anchored (not a bare substring match) because FDC also carries
    // "Vitamin B-12, added" (id 1246, the fortification-only portion) on
    // enriched foods — an unanchored pattern would match that name too and
    // silently report a fortification figure as the ingredient's total B12.
    vitaminB12McgPer100: nutrientValue(food, 1178, /^vitamin b-12$/i),
    calciumMgPer100: nutrientValue(food, 1087, /^calcium, ca$/i),
    // FDC carries several folate-related IDs (1177 "Folate, total", 1186 "Folic
    // acid", 1190 "Folate, DFE"). Verified against live Foundation data
    // (spinach, beets) that "Folate, total" (1177) is the one populated
    // consistently across food types and matches Cronometer's single
    // "Folate" figure — DFE (1190) and folic acid (1186) are fortification-
    // specific breakdowns, not present on unfortified whole foods.
    folateMcgPer100: nutrientValue(food, 1177, /folate, total/i),
    vitaminAMcgPer100: nutrientValue(food, 1106, /vitamin a, rae/i),
    potassiumMgPer100: nutrientValue(food, 1092, /^potassium, k$/i),
    // FDC carries three vitamin D entries: 1114 "Vitamin D (D2 + D3)" in mcg,
    // 1110 the same figure in IU, and 1112/1111 the D2 and D3 components
    // separately. 1114 is the combined total in the unit the app stores.
    //
    // Anchored, like B12 below: the IU row is named "Vitamin D (D2 + D3),
    // International Units", so an unanchored pattern matches it on any food
    // where the ID lookup misses — storing an IU figure as micrograms, a
    // silent 40x error.
    vitaminDMcgPer100: nutrientValue(food, 1114, /^vitamin d \(d2 \+ d3\)$/i),
    magnesiumMgPer100: nutrientValue(food, 1090, /^magnesium, mg$/i),
    zincMgPer100: nutrientValue(food, 1095, /^zinc, zn$/i),
    sodiumMgPer100: nutrientValue(food, 1093, /^sodium, na$/i),
    // Alpha-tocopherol specifically, not the beta/gamma/delta tocopherols FDC
    // also lists (1125–1128): 1109 is the form vitamin E activity is defined
    // by, and the one a per-100g figure is expected to mean.
    // Anchored for the same reason as vitamin D: FDC lists "Vitamin E
    // (alpha-tocopherol), added" (1242) as the fortification-only portion.
    vitaminEMgPer100: nutrientValue(food, 1109, /^vitamin e \(alpha-tocopherol\)$/i),
    // Phylloquinone (K1). FDC keeps menaquinone-4 (1183) and dihydro-
    // phylloquinone (1184) as separate IDs; K1 is the dietary majority and
    // the figure a single "vitamin K" number refers to.
    vitaminKMcgPer100: nutrientValue(food, 1185, /^vitamin k \(phylloquinone\)$/i),
    thiaminMgPer100: nutrientValue(food, 1165, /^thiamin$/i),
    riboflavinMgPer100: nutrientValue(food, 1166, /^riboflavin$/i),
  };
}

/**
 * Whether a food has at least one of the 4 core macros — deliberately
 * narrower than all 20 fields `nutritionFromFdc()` now extracts, since a
 * food with only a micronutrient value (e.g. fibre) and no macro data is
 * too thin a record to accept as a match; it should fall through to
 * `unmatched` for manual review rather than being silently selected.
 */
function hasMacroData(patch: CataloguePatch): boolean {
  return [patch.kcalPer100, patch.proteinPer100, patch.carbsPer100, patch.fatPer100].some(
    (value) => value != null,
  );
}

function categoryCompatible(entry: CatalogueEntry, food: FdcFood): boolean {
  const category = foodCategoryName(food).toLowerCase();
  if (!category) return true;
  const guards: Partial<Record<FoodClass, RegExp>> = {
    produce: /vegetable|fruit|produce/, protein: /meat|poultry|fish|seafood|legume|egg/,
    dairy: /dairy|milk|cheese/, beverage: /beverage/, frozen: /frozen/,
  };
  const guard = guards[entry.class];
  return guard ? guard.test(category) : true;
}

export async function chooseFdcFood(
  entry: CatalogueEntry,
  foods: readonly FdcFood[],
  allEntries: readonly CatalogueEntry[],
  reviewedFdcId?: number,
): Promise<FdcFood | null> {
  if (reviewedFdcId != null) {
    const reviewed = foods.find((food) => food.fdcId === reviewedFdcId);
    return reviewed && hasMacroData(nutritionFromFdc(reviewed)) ? reviewed : null;
  }
  const candidates = foods.filter(
    (food): food is FdcFood & { description: string } =>
      typeof food.description === 'string' && categoryCompatible(entry, food),
  );
  const outcomes = await resolveLabels(
    candidates.map((food) => food.description),
    allEntries,
  );
  return candidates
    .map((food, index) => ({ food, outcome: outcomes[index] }))
    .filter(
      (candidate) =>
        candidate.outcome?.status === 'resolved' &&
        candidate.outcome.canonicalId === entry.id &&
        hasMacroData(nutritionFromFdc(candidate.food)),
    )
    .sort((left, right) => {
      const dataRank = (food: FdcFood) => (food.dataType === 'Foundation' ? 2 : 1);
      return (
        dataRank(right.food) - dataRank(left.food) ||
        similarity(normalise(right.food.description!), normalise(entry.displayName)) -
          similarity(normalise(left.food.description!), normalise(entry.displayName))
      );
    })[0]?.food ?? null;
}

export async function fdcReviewCandidates(
  entry: CatalogueEntry,
  foods: readonly FdcFood[],
  allEntries: readonly CatalogueEntry[],
): Promise<FdcReviewCandidate[]> {
  const candidates = foods.filter(
    (food): food is FdcFood & { description: string } => typeof food.description === 'string',
  );
  const outcomes = await resolveLabels(candidates.map((food) => food.description), allEntries);
  return candidates.slice(0, 5).map((food, index) => {
    const outcome = outcomes[index];
    return {
      fdcId: food.fdcId ?? null,
      description: food.description,
      dataType: food.dataType ?? null,
      foodCategory: foodCategoryName(food) || null,
      outcome: outcome?.status ?? 'not_evaluated',
      matchedCanonicalId:
        outcome && 'canonicalId' in outcome ? outcome.canonicalId : null,
      confidence: outcome && 'confidence' in outcome ? outcome.confidence : null,
    };
  });
}

function foodCategoryName(food: FdcFood): string {
  if (typeof food.foodCategory === 'string') return food.foodCategory;
  return food.foodCategory?.description ?? '';
}

async function searchFdc(entry: CatalogueEntry, apiKey: string): Promise<FdcFood[]> {
  const url = new URL(FDC_SEARCH_URL);
  url.searchParams.set('api_key', apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: entry.displayName,
      dataType: ['Foundation', 'SR Legacy'],
      pageSize: 10,
    }),
  });
  if (!response.ok) throw new Error(`FoodData Central returned HTTP ${response.status}`);
  const body = (await response.json()) as FdcSearchResponse;
  return body.foods ?? [];
}

async function fetchReviewedFdcFoods(apiKey: string): Promise<Map<number, FdcFood>> {
  const ids = [...new Set(Object.values(fdcSelections as Record<string, number>))];
  const foods = new Map<number, FdcFood>();
  for (let index = 0; index < ids.length; index += 20) {
    const chunk = ids.slice(index, index + 20);
    const url = new URL(FDC_FOODS_URL);
    url.searchParams.set('api_key', apiKey);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fdcIds: chunk }),
    });
    if (!response.ok) throw new Error(`FoodData Central batch returned HTTP ${response.status}`);
    const batch = (await response.json()) as FdcFood[];
    for (const food of batch) {
      if (food.fdcId != null) foods.set(food.fdcId, food);
    }
  }
  return foods;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  work: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (index < values.length) {
      const current = index;
      index += 1;
      const value = values[current];
      if (value !== undefined) results[current] = await work(value);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function enrichWithFdc(
  entries: readonly CatalogueEntry[],
  apiKey: string,
  report: BuildReport,
): Promise<CatalogueEntry[]> {
  const reviewedFoods = await fetchReviewedFdcFoods(apiKey);
  const matches = await mapWithConcurrency(entries, 4, async (entry) => {
    const reviewedId = (fdcSelections as Record<string, number>)[entry.id];
    const reviewed = reviewedId == null ? undefined : reviewedFoods.get(reviewedId);
    const foods = reviewed ? [reviewed] : reviewedId == null ? await searchFdc(entry, apiKey) : [];
    return {
      selected: await chooseFdcFood(entry, foods, entries, reviewedId),
      review: await fdcReviewCandidates(entry, foods, entries),
    };
  });
  report.foodDataCentral.queried = entries.length;
  return entries.map((entry, index) => {
    const result = matches[index];
    const food = result?.selected;
    report.foodDataCentral.review[entry.id] = result?.review ?? [];
    if (!food) {
      report.foodDataCentral.unmatched.push(entry.id);
      return entry;
    }
    report.foodDataCentral.matched += 1;
    return mergeCataloguePatch(
      entry,
      nutritionFromFdc(food),
      'food-data-central',
      food.description ?? String(food.fdcId ?? 'unknown'),
      report,
    );
  });
}

/** Applies only human-reviewed CoFID rows committed beside the catalogue. */
export function enrichWithCofid(
  entries: readonly CatalogueEntry[],
  report: BuildReport,
): CatalogueEntry[] {
  const selections = cofidSelections as Record<string, CofidSelection>;
  report.cofid.reviewed = Object.keys(selections).length;
  return entries.map((entry) => {
    const selection = selections[entry.id];
    if (!selection) return entry;
    report.cofid.matched += 1;
    return mergeCataloguePatch(
      entry,
      {
        kcalPer100: selection.kcalPer100,
        proteinPer100: selection.proteinPer100,
        carbsPer100: selection.carbsPer100,
        fatPer100: selection.fatPer100,
      },
      'cofid',
      `${selection.rowId}: ${selection.description}`,
      report,
    );
  });
}

export function stableCatalogueJson(entries: readonly CatalogueEntry[]): string {
  return `${JSON.stringify(entries, null, 2)}\n`;
}

function createReport(foodKeeperRowsCount: number, skipNutrition: boolean): BuildReport {
  return {
    sources: CATALOGUE_SOURCES,
    foodkeeper: { rows: foodKeeperRowsCount, matched: 0, uncertain: [], unmatched: [], guarded: [] },
    foodDataCentral: { queried: 0, matched: 0, unmatched: [], review: {}, skipped: skipNutrition },
    cofid: { reviewed: 0, matched: 0 },
    filled: [],
    conflicts: [],
    skipped: [],
  };
}

async function readFoodKeeper(path?: string): Promise<unknown> {
  if (path) {
    const bytes = await readFile(path);
    const json = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
    return JSON.parse(json) as unknown;
  }
  const response = await fetch(FOODKEEPER_URL);
  if (!response.ok) throw new Error(`FoodKeeper returned HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function runBuild(options: RunOptions): Promise<BuildReport> {
  const entries = JSON.parse(await readFile(options.inputPath, 'utf8')) as CatalogueEntry[];
  const workbook = await readFoodKeeper(options.foodKeeperPath);
  const rows = foodKeeperRows(workbook);
  const report = createReport(rows.length, options.skipNutrition);
  let enriched = await enrichWithFoodKeeper(entries, rows, report);
  enriched = enrichWithCofid(enriched, report);
  if (!options.skipNutrition) {
    if (!options.apiKey) throw new Error('USDA_API_KEY is required unless --skip-nutrition is used');
    enriched = await enrichWithFdc(enriched, options.apiKey, report);
  }
  await writeFile(options.outputPath, stableCatalogueJson(enriched));
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(options.sourcesPath, `${JSON.stringify(CATALOGUE_SOURCES, null, 2)}\n`);
  return report;
}

function argumentValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const root = resolvePath(import.meta.dirname, '..');
  const report = await runBuild({
    inputPath: argumentValue(args, '--input') ?? resolvePath(root, 'assets/canonical-items.json'),
    outputPath: argumentValue(args, '--output') ?? resolvePath(root, 'assets/canonical-items.json'),
    reportPath: argumentValue(args, '--report') ?? resolvePath(root, 'assets/catalogue-build-report.json'),
    sourcesPath: argumentValue(args, '--sources') ?? resolvePath(root, 'assets/catalogue-sources.json'),
    foodKeeperPath: argumentValue(args, '--foodkeeper'),
    skipNutrition: args.includes('--skip-nutrition'),
    apiKey: process.env.USDA_API_KEY,
  });
  process.stdout.write(
    `${JSON.stringify({
      foodkeeper: {
        rows: report.foodkeeper.rows,
        matched: report.foodkeeper.matched,
        uncertain: report.foodkeeper.uncertain.length,
        unmatched: report.foodkeeper.unmatched.length,
        guarded: report.foodkeeper.guarded.length,
      },
      foodDataCentral: {
        queried: report.foodDataCentral.queried,
        matched: report.foodDataCentral.matched,
        unmatched: report.foodDataCentral.unmatched.length,
        awaitingReview: Object.values(report.foodDataCentral.review).filter(
          (candidates) => candidates.length > 0,
        ).length,
        skipped: report.foodDataCentral.skipped,
      },
      cofid: report.cofid,
      filled: report.filled.length,
      conflicts: report.conflicts.length,
      skipped: report.skipped.length,
    }, null, 2)}\n`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolvePath(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
