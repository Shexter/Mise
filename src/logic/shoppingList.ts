import { normalise } from '@/logic/normalise';
import type {
  CanonicalItem,
  FoodClass,
  MeasureUnit,
  PantryItem,
  RecipeIngredient,
  ShoppingListCategory,
  ShoppingListItem,
  ShoppingListReceiptMatch,
  ShoppingListSection,
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

export interface ShoppingListRefreshPlan {
  additions: ShoppingSourceInput[];
  staleAutomaticSourceKeys: string[];
}

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

  return { additions, staleAutomaticSourceKeys: [] };
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

export function groupShoppingItems(items: readonly ShoppingListItem[]): ShoppingListSection[] {
  const labels: Record<ShoppingListCategory, string> = {
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
  const groups = new Map<ShoppingListCategory, ShoppingListItem[]>();
  for (const item of items) {
    if (item.status !== 'open') continue;
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => labels[a].localeCompare(labels[b]))
    .map(([category, grouped]) => ({
      category,
      label: labels[category],
      items: [...grouped].sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName)),
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
