import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const root = path.resolve(__dirname, '..');
const pantry = fs.readFileSync(path.join(root, 'app/(tabs)/pantry.tsx'), 'utf8');
const recipes = fs.readFileSync(path.join(root, 'src/components/recipes/SavedRecipesSection.tsx'), 'utf8');

describe('Pantry Stock and Recipes subsections', () => {
  test('defaults to Stock and switches only harmless presentation state', () => {
    expect(pantry).toContain("useState<PantrySubsection>('stock')");
    expect(pantry).toContain('<Segmented options={SUBSECTIONS} value={subsection} onChange={setSubsection}');
    expect(pantry).not.toMatch(/useEffect\([^)]*subsection[^)]*(insert|update|delete)/s);
  });

  test('keeps pending work and stock controls inside Stock only', () => {
    expect(pantry).toContain("subsection === 'stock' && pendingCount > 0");
    expect(pantry).toContain("subsection === 'stock' && pendingCaptureCount > 0");
    expect(pantry).toContain("subsection === 'stock' ? <View style={styles.headerActions}");
    expect(pantry).toContain("router.push('/locations')");
    expect(pantry).toContain("router.push('/pantry-capture')");
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
});
