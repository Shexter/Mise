import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const root = path.resolve(__dirname, '..');
const pantry = fs.readFileSync(path.join(root, 'app/(tabs)/pantry.tsx'), 'utf8');
const shop = fs.readFileSync(path.join(root, 'app/(tabs)/shop.tsx'), 'utf8');
const recipes = fs.readFileSync(path.join(root, 'src/components/recipes/SavedRecipesSection.tsx'), 'utf8');
const addSheet = fs.readFileSync(path.join(root, 'src/components/AddSheet.tsx'), 'utf8');

describe('Pantry Stock and Recipes subsections', () => {
  test('defaults to Stock and switches only harmless presentation state', () => {
    expect(pantry).toContain("useState<PantrySubsection>('stock')");
    expect(pantry).toContain('<Segmented options={SUBSECTIONS} value={subsection} onChange={setSubsection}');
    expect(pantry).toContain("type PantrySubsection = 'stock' | 'recipes'");
    expect(pantry).not.toContain("{ value: 'shop', label: 'Shop' }");
    expect(pantry).not.toContain("{ value: 'receipts', label: 'Receipts' }");
    expect(pantry).not.toMatch(/useEffect\([^)]*subsection[^)]*(insert|update|delete)/s);
  });

  test('keeps pantry capture work and stock controls inside Stock only', () => {
    expect(pantry).toContain("subsection === 'stock' && pendingCaptureCount > 0");
    expect(pantry).toMatch(/subsection === 'stock' \? \(\s*<View style=\{styles\.headerActions\}>/);
    expect(pantry).toContain("router.push('/locations')");

    // Photographing and speaking items are reached from the shared add surface
    // now, not from this header. The subsection gate still holds for the
    // controls that remain, which is what this test is actually protecting.
    expect(addSheet).toContain("route: '/pantry-capture'");
    expect(addSheet).toContain("route: '/pantry-voice'");
    expect(pantry).not.toContain("router.push('/pantry-capture')");
    expect(shop).toContain('pendingReceipts()');
    expect(shop).toContain('await retryAllPending()');
  });

  test('reuses recipe intake and detail routes without treating recipes as stock', () => {
    expect(pantry).toContain('<SavedRecipesSection recipes={recipes}');
    expect(recipes).toContain("router.push('/recipe-intake')");
    expect(recipes).toContain("pathname: '/recipe/[id]'");
    expect(recipes).toContain('Opens recipe details and pantry coverage.');
    expect(recipes).not.toMatch(/PantryEntry|usePantryStore|stockStatus|deplet/i);
  });

  test('loads each collection on focus rather than on subsection taps', () => {
    expect(pantry).toContain('void refresh()');
    expect(pantry).toContain('void listRecipes().then(setRecipes)');
    expect(pantry).not.toMatch(/onChange=.*listRecipes/);
  });

  test('keeps receipt and grocery rendering out of Pantry', () => {
    expect(pantry).not.toContain('ShoppingListSection');
    expect(pantry).not.toContain("router.push('/receipt-history')");
    expect(pantry).not.toContain('listReceipts');
    expect(shop).toContain('<ShoppingListSection />');
  });
});
