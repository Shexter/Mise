import { describe, expect, test } from 'vitest';

import fs from 'node:fs';

import { groupShoppingItems, sourceExplanations } from '@/logic/shoppingList';
import type { ShoppingListItem } from '@/types';

describe('shopping list UI contract', () => {
  test('Pantry exposes Shop while Today stays free of shopping UI', () => {
    const pantry = fs.readFileSync('app/(tabs)/pantry.tsx', 'utf8');
    const today = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');
    expect(pantry).toContain("{ value: 'shop', label: 'Shop' }");
    expect(pantry).toContain('<ShoppingListSection />');
    expect(today).not.toContain('ShoppingListSection');
  });

  test('recipe detail offers missing-ingredient capture', () => {
    const recipe = fs.readFileSync('app/recipe/[id].tsx', 'utf8');
    expect(recipe).toContain('Add missing ingredients');
    expect(recipe).toContain("kind: 'recipe_missing'");
  });

  test('Shop wires the pure refresh/stale/orphan/merge logic rather than reimplementing it inline', () => {
    const section = fs.readFileSync('src/components/pantry/ShoppingListSection.tsx', 'utf8');
    for (const symbol of [
      'buildRefreshPlan',
      'removeShoppingListSource(stale.shoppingItemId, stale)',
      'orphanedOpenItemIds',
      'closedShoppingItems',
      'planCanonicalReassignment',
      'manualEntryDraft',
      'validateShoppingQuantity',
      'sourceExplanations(item.sources ?? [], recipeTitles)',
    ]) {
      expect(section).toContain(symbol);
    }
  });

  test('the history label fits a two-way segmented toggle at large text', () => {
    const section = fs.readFileSync('src/components/pantry/ShoppingListSection.tsx', 'utf8');
    expect(section).toContain("{ value: 'history', label: 'History' }");
  });

  test('the row action group wraps instead of overflowing at large text', () => {
    const section = fs.readFileSync('src/components/pantry/ShoppingListSection.tsx', 'utf8');
    expect(section).toContain("actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.base }");
  });

  test('manual entry supports a canonical picker and a category picker, not free text only', () => {
    const section = fs.readFileSync('src/components/pantry/ShoppingListSection.tsx', 'utf8');
    expect(section).toContain('CanonicalPickerSheet');
    expect(section).toContain('SHOPPING_LIST_CATEGORIES');
    expect(section).toContain('ChoiceList');
  });

  test('quantity errors are shown on the field, not swallowed', () => {
    const section = fs.readFileSync('src/components/pantry/ShoppingListSection.tsx', 'utf8');
    expect(section).toContain('error={quantityError ?? undefined}');
  });

  test('corrupt categories and missing recipe titles render with safe fallbacks', () => {
    const corruptItem = {
      id: 'legacy-item',
      displayName: 'Mystery item',
      status: 'open',
      category: '__proto__',
      sortOrder: 0,
    } as unknown as ShoppingListItem;

    expect(groupShoppingItems([null, corruptItem])).toMatchObject([
      { category: 'other', label: 'Other', items: [corruptItem] },
    ]);
    expect(sourceExplanations([{ kind: 'recipe_missing', recipeId: 'missing-recipe' }], new Map())).toEqual([
      'Missing for a saved recipe',
    ]);
  });

  test('the asynchronous load cycle catches failures and always resolves loading state', () => {
    const section = fs.readFileSync('src/components/pantry/ShoppingListSection.tsx', 'utf8');
    const loadStart = section.indexOf('const load = useCallback(async () => {');
    const loadEnd = section.indexOf('useEffect(() => { void load(); }, [load]);');
    const loadCycle = section.slice(loadStart, loadEnd);

    expect(loadCycle).toContain('try {');
    expect(loadCycle).toContain('} catch {');
    expect(loadCycle).toContain('setItems([]);');
    expect(loadCycle).toContain("kind: 'recoverable-error'");
    expect(loadCycle).toContain('} finally {');
    expect(loadCycle).toContain('setLoading(false);');
  });
});
