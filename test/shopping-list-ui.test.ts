import { describe, expect, test } from 'vitest';

import fs from 'node:fs';

import { groupShoppingItems, sourceExplanations } from '@/logic/shoppingList';
import type { ShoppingListItem } from '@/types';

describe('shopping list UI contract', () => {
  test('Shop is a dedicated tab while Pantry and Today stay free of shopping UI', () => {
    const tabs = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    const pantry = fs.readFileSync('app/(tabs)/pantry.tsx', 'utf8');
    const shop = fs.readFileSync('app/(tabs)/shop.tsx', 'utf8');
    const today = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');

    expect(tabs).toContain('name="shop"');
    expect(tabs).toContain('<Feather name="shopping-bag"');
    expect(shop).toContain('<ShoppingListSection />');
    expect(pantry).not.toContain('ShoppingListSection');
    expect(today).not.toContain('ShoppingListSection');
  });

  test('Shop exposes nearby stores, receipt capture, and receipt history directly', () => {
    const shop = fs.readFileSync('app/(tabs)/shop.tsx', 'utf8');

    expect(shop).toContain("router.push('/shops')");
    expect(shop).toContain('accessibilityLabel="Check nearby shops"');
    expect(shop).toContain('label="Scan a receipt"');
    expect(shop).toContain("router.push('/receipt-capture')");
    expect(shop).toContain("router.push('/receipt-history')");
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

  test('canonical purchases offer restock and successful restocks offer full undo', () => {
    const section = fs.readFileSync('src/components/pantry/ShoppingListSection.tsx', 'utf8');

    expect(section).toContain("status === 'purchased' && item.canonicalId ? 'Restock in Pantry'");
    expect(section).toContain('restockFromShoppingItem(');
    expect(section).toContain('const undo = await restock(plan);');
    expect(section).toContain("actionLabel: 'Undo'");
    expect(section).toContain('undoRestock(undo, item.id, previousStatus)');
  });

  test('unresolved purchases retain purchase undo instead of creating pantry stock', () => {
    const section = fs.readFileSync('src/components/pantry/ShoppingListSection.tsx', 'utf8');

    expect(section).toContain("status === 'purchased' && item.canonicalId");
    expect(section).toContain("status !== 'open' ? 'Undo' : undefined");
  });
});
