import { normalise } from '@/logic/normalise';
import { FOOD_CLASSES } from '@/types';
import type {
  CanonicalItem,
  MeasureUnit,
  PantryItem,
  RecipeIngredient,
  ShoppingListCategory,
  ShoppingListItem,
  ShoppingListReceiptMatch,
  ShoppingListSection,
  ShoppingListSource,
  ShoppingListSourceKind,
  ShoppingListStatus,
  SuggestionMissing,
} from '@/types';

export interface ShoppingSourceInput {
  kind: ShoppingListSourceKind;
  sourceId?: string | null;
  recipeId?: string | null;
  suggestionId?: string | null;
  canonicalId: string | null;
  displayName: string;
  requestedQty?: number | null;
  requestedUnit?: MeasureUnit | null;
  category?: ShoppingListCategory;
}

export interface ShoppingListRefreshInput {
  /** Current persisted items, used to detect sources that no longer apply. */
  existingItems: readonly ShoppingListItem[];
  pantry: readonly PantryItem[];
  recipes: readonly {
    id: string;
    ingredients: readonly RecipeIngredient[];
  }[];
  suggestions: readonly {
    id: string;
    missing: readonly SuggestionMissing[];
}[];
  canonicals: ReadonlyMap<string, CanonicalItem>;
}

export interface StaleSourceRef {
  shoppingItemId: string;
  kind: ShoppingListSourceKind;
  sourceId: string | null;
  recipeId: string | null;
  suggestionId: string | null;
}

export interface ShoppingListRefreshPlan {
  additions: ShoppingSourceInput[];
  /**
   * Sources to remove because this refresh recomputed the full authoritative
   * set for their kind and they were not in it. Restricted to
   * `pantry_low`/`pantry_out`/`recipe_missing` — `input.recipes` and
   * `input.pantry` are complete snapshots, so anything of those kinds not
   * reproduced this pass is genuinely stale. `manual` sources are never
   * touched. `suggestion_missing` is deliberately excluded even when
   * `input.suggestions` is empty: an empty array here means "suggestions
   * were not queried this refresh," not "no suggestion is active," so it is
   * not an authoritative set and must never be used to remove entries.
   */
  staleAutomaticSources: StaleSourceRef[];
}

const RECOMPUTABLE_SOURCE_KINDS: readonly ShoppingListSourceKind[] = ['pantry_low', 'pantry_out', 'recipe_missing'];

export interface ShoppingListRowInput {
  id: string;
  canonicalId: string | null;
  displayName: string;
  normalizedName: string;
  status: ShoppingListStatus;
  requestedQty: number | null;
  requestedUnit: MeasureUnit | null;
  note: string | null;
  category: ShoppingListCategory;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ShoppingSourceRowInput {
  id: string;
  shoppingItemId: string;
  kind: ShoppingListSourceKind;
  sourceId: string | null;
  recipeId: string | null;
  suggestionId: string | null;
  createdAt: string;
}

export function sourceKey(source: Pick<ShoppingSourceInput, 'kind' | 'sourceId' | 'recipeId' | 'suggestionId'>): string {
  return [source.kind, source.sourceId ?? '', source.recipeId ?? '', source.suggestionId ?? ''].join('|');
}

export function itemKey(input: Pick<ShoppingSourceInput, 'canonicalId' | 'displayName'>): string {
  return input.canonicalId ? `canonical:${input.canonicalId}` : `text:${normalise(input.displayName)}`;
}

export function sourceCategory(
  canonicalId: string | null,
  canonicals: ReadonlyMap<string, CanonicalItem>,
): ShoppingListCategory {
  return canonicalId ? (canonicals.get(canonicalId)?.foodClass ?? 'other') : 'other';
}

export function buildRefreshPlan(input: ShoppingListRefreshInput): ShoppingListRefreshPlan {
  const additions: ShoppingSourceInput[] = [];
  for (const item of input.pantry) {
    if (item.status !== 'out' && item.status !== 'running_low') continue;
    const canonical = input.canonicals.get(item.canonicalId);
    if (!canonical) continue;
    additions.push({
      kind: item.status === 'out' ? 'pantry_out' : 'pantry_low',
      sourceId: item.id,
      canonicalId: item.canonicalId,
      displayName: canonical.displayName,
      category: canonical.foodClass,
    });
  }

  for (const recipe of input.recipes) {
    for (const ingredient of recipe.ingredients) {
      if (!ingredient.canonicalId) {
        additions.push({
          kind: 'recipe_missing',
          sourceId: ingredient.id,
          recipeId: recipe.id,
          canonicalId: null,
          displayName: ingredient.name,
          requestedQty: ingredient.quantity,
          requestedUnit: ingredient.unit,
        });
        continue;
      }
      const covered = input.pantry.some(
        (item) => item.canonicalId === ingredient.canonicalId &&
          (item.status === 'in_stock' || item.status === 'running_low'),
      );
      if (covered) continue;
      additions.push({
        kind: 'recipe_missing',
        sourceId: ingredient.id,
        recipeId: recipe.id,
        canonicalId: ingredient.canonicalId,
        displayName: input.canonicals.get(ingredient.canonicalId)?.displayName ?? ingredient.name,
        requestedQty: ingredient.quantity,
        requestedUnit: ingredient.unit,
        category: sourceCategory(ingredient.canonicalId, input.canonicals),
      });
    }
  }

  for (const suggestion of input.suggestions) {
    for (const missing of suggestion.missing) {
      additions.push({
        kind: 'suggestion_missing',
        sourceId: null,
        suggestionId: suggestion.id,
        canonicalId: missing.canonicalId,
        displayName: missing.name,
        category: sourceCategory(missing.canonicalId, input.canonicals),
        requestedQty: null,
        requestedUnit: null,
      });
    }
  }

  const authoritativeRecomputableKeys = new Set(
    additions
      .filter((addition) => RECOMPUTABLE_SOURCE_KINDS.includes(addition.kind))
      .map((addition) => sourceKey(addition)),
  );

  const staleAutomaticSources: StaleSourceRef[] = [];
  for (const item of input.existingItems) {
    for (const source of item.sources) {
      if (!RECOMPUTABLE_SOURCE_KINDS.includes(source.kind)) continue;
      if (authoritativeRecomputableKeys.has(sourceKey(source))) continue;
      staleAutomaticSources.push({
        shoppingItemId: item.id,
        kind: source.kind,
        sourceId: source.sourceId,
        recipeId: source.recipeId,
        suggestionId: source.suggestionId,
      });
    }
  }

  return { additions, staleAutomaticSources };
}

/**
 * Open items left with no active source after stale-source removal — safe to
 * delete outright. Closed items (purchased/snoozed/dismissed) are never
 * included even if sourceless: their history is worth preserving regardless
 * of whether the source that originally created them is still active.
 */
export function orphanedOpenItemIds(items: readonly ShoppingListItem[]): string[] {
  return items
    .filter((item) => item.status === 'open' && item.sources.length === 0)
    .map((item) => item.id);
}

export function mergeShoppingSources(
  existing: readonly ShoppingListItem[],
  additions: readonly ShoppingSourceInput[],
): ShoppingListItem[] {
  const byKey = new Map<string, ShoppingListItem>();
  for (const item of existing) byKey.set(itemKey(item), { ...item, sources: [...item.sources] });
  for (const addition of additions) {
    const key = itemKey(addition);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        id: `planned:${key}`,
        canonicalId: addition.canonicalId,
        displayName: addition.displayName,
        normalizedName: normalise(addition.displayName),
        status: 'open',
        requestedQty: addition.requestedQty ?? null,
        requestedUnit: addition.requestedUnit ?? null,
        note: null,
        category: addition.category ?? 'other',
        sortOrder: byKey.size,
        createdAt: '',
        updatedAt: '',
        completedAt: null,
        sources: [{
          id: `planned-source:${sourceKey(addition)}`,
          shoppingItemId: `planned:${key}`,
          kind: addition.kind,
          sourceId: addition.sourceId ?? null,
          recipeId: addition.recipeId ?? null,
          suggestionId: addition.suggestionId ?? null,
          createdAt: '',
        }],
      });
      continue;
    }
    const keyAlreadyPresent = current.sources.some((source) => sourceKey(source) === sourceKey(addition));
    if (!keyAlreadyPresent) {
      current.sources.push({
        id: `planned-source:${sourceKey(addition)}`,
        shoppingItemId: current.id,
        kind: addition.kind,
        sourceId: addition.sourceId ?? null,
        recipeId: addition.recipeId ?? null,
        suggestionId: addition.suggestionId ?? null,
        createdAt: '',
      });
    }
    if (current.requestedQty === null && addition.requestedQty != null) {
      current.requestedQty = addition.requestedQty;
      current.requestedUnit = addition.requestedUnit ?? null;
    }
  }
  return [...byKey.values()];
}

export function quantityLabel(item: Pick<ShoppingListItem, 'status' | 'requestedQty' | 'requestedUnit'>): string {
  if (item.requestedQty !== null) return `${item.requestedQty}${item.requestedUnit ? ` ${item.requestedUnit}` : ''}`;
  if (item.status === 'purchased') return 'Purchased';
  if (item.status === 'snoozed') return 'Snoozed';
  return item.status === 'dismissed' ? 'Dismissed' : 'Needed';
}

const SOURCE_LABELS: Record<ShoppingListSourceKind, string> = {
  pantry_low: 'Running low in your pantry',
  pantry_out: 'Out in your pantry',
  recipe_missing: 'Missing for a saved recipe',
  suggestion_missing: "Missing for tonight's suggestion",
  meal_plan: 'Needed for your meal plan',
  manual: 'Added manually',
};

export function sourceLabel(kind: ShoppingListSourceKind): string {
  return SOURCE_LABELS[kind] ?? 'Added to your grocery list';
}

/**
 * Deduplicated, human-readable explanations for why an item is on the list.
 * A `recipe_missing` source names its specific recipe when a title is
 * available, so two different recipes needing the same ingredient produce
 * two distinct explanations rather than collapsing into one generic label.
 */
export function sourceExplanations(
  sources: readonly ((Pick<ShoppingListSource, 'kind'> & { recipeId?: string | null }) | null | undefined)[],
  recipeTitles?: ReadonlyMap<string, string>,
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    const recipeTitle = source.recipeId ? recipeTitles?.get(source.recipeId)?.trim() : undefined;
    const label = source.kind === 'recipe_missing'
      ? `Missing for ${recipeTitle || 'a saved recipe'}`
      : sourceLabel(source.kind);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

export const SHOPPING_LIST_CATEGORIES: readonly ShoppingListCategory[] = [...FOOD_CLASSES, 'other'];

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingListCategory, string> = {
  produce: 'Produce',
  protein: 'Protein',
  dairy: 'Dairy',
  staple: 'Pantry staples',
  seasoning: 'Seasonings',
  condiment: 'Condiments',
  frozen: 'Frozen',
  beverage: 'Beverages',
  other: 'Other',
};

export function normalizeShoppingListCategory(category: unknown): ShoppingListCategory {
  return SHOPPING_LIST_CATEGORIES.includes(category as ShoppingListCategory)
    ? category as ShoppingListCategory
    : 'other';
}

export interface QuantityValidation {
  quantity: number | null;
  error: string | null;
}

/** Blank means "unspecified" and is valid; anything present must be a non-negative finite number. */
export function validateShoppingQuantity(raw: string): QuantityValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { quantity: null, error: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return { quantity: null, error: 'Enter a positive number, or leave the amount blank.' };
  }
  return { quantity: value, error: null };
}

export interface ManualEntryDraft {
  canonicalId: string | null;
  displayName: string;
  normalizedName: string;
  category: ShoppingListCategory;
}

/**
 * A canonical selection always wins on display name and category — those
 * are the app's own identity, not the user's typed text. Without a
 * canonical, the typed name and chosen category stand as entered.
 */
export function manualEntryDraft(
  name: string,
  canonical: Pick<CanonicalItem, 'id' | 'displayName' | 'foodClass'> | null,
  manualCategory: ShoppingListCategory,
): ManualEntryDraft {
  if (canonical) {
    return {
      canonicalId: canonical.id,
      displayName: canonical.displayName,
      normalizedName: normalise(canonical.displayName),
      category: canonical.foodClass,
    };
  }
  const trimmed = name.trim();
  return {
    canonicalId: null,
    displayName: trimmed,
    normalizedName: normalise(trimmed),
    category: manualCategory,
  };
}

export interface CanonicalReassignmentPlan {
  /** 'merge' means the edited item should be folded into targetItemId and removed. */
  kind: 'update' | 'merge';
  targetItemId: string;
}

/**
 * Deciding whether picking a canonical for an item under edit collides with
 * another open item already carrying that canonical. Only open items count
 * as a collision — closed items are history, not the active list, and
 * sharing a canonical with one is not a duplicate.
 */
export function planCanonicalReassignment(
  items: readonly Pick<ShoppingListItem, 'id' | 'canonicalId' | 'status'>[],
  itemId: string,
  canonicalId: string | null,
): CanonicalReassignmentPlan {
  if (canonicalId !== null) {
    const duplicate = items.find(
      (item) => item.id !== itemId && item.status === 'open' && item.canonicalId === canonicalId,
    );
    if (duplicate) return { kind: 'merge', targetItemId: duplicate.id };
  }
  return { kind: 'update', targetItemId: itemId };
}

/** Purchased, snoozed, and dismissed items, most recently updated first — the restore surface. */
export function closedShoppingItems(items: readonly ShoppingListItem[]): ShoppingListItem[] {
  return items
    .filter((item) => item.status !== 'open')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function groupShoppingItems(items: readonly (ShoppingListItem | null | undefined)[]): ShoppingListSection[] {
  const groups = new Map<ShoppingListCategory, ShoppingListItem[]>();
  for (const item of items) {
    if (!item || item.status !== 'open') continue;
    // Older development/demo data could persist categories outside the
    // supported FoodClass union. Treat those rows as Other so opening Shop is
    // recoverable instead of looking up an undefined label and crashing.
    const category = normalizeShoppingListCategory(item.category);
    const list = groups.get(category) ?? [];
    list.push(item);
    groups.set(category, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => SHOPPING_CATEGORY_LABELS[a].localeCompare(SHOPPING_CATEGORY_LABELS[b]))
    .map(([category, grouped]) => ({
      category,
      label: SHOPPING_CATEGORY_LABELS[category],
      items: [...grouped].sort((a, b) => a.sortOrder - b.sortOrder || (a.displayName ?? '').localeCompare(b.displayName ?? '')),
    }));
}

export function canAutoMatchReceipt(
  item: Pick<ShoppingListItem, 'canonicalId' | 'status'>,
  receiptCanonicalId: string | null,
): boolean {
  return item.status === 'open' && item.canonicalId !== null && receiptCanonicalId !== null && item.canonicalId === receiptCanonicalId;
}

export function receiptMatchTransition(
  item: Pick<ShoppingListItem, 'status'>,
  now: string,
): Pick<ShoppingListItem, 'status' | 'completedAt'> {
  return { status: 'purchased', completedAt: now };
}

export function undoReceiptMatch(
  match: Pick<ShoppingListReceiptMatch, 'previousStatus' | 'undoneAt'>,
  now: string,
): { status: ShoppingListStatus; undoneAt: string } | null {
  if (match.undoneAt !== null) return null;
  return { status: match.previousStatus, undoneAt: now };
}
