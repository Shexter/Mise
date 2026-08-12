import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { getRecipe, insertRecipe, loadSeedData, updateRecipe } from '@/db/queries';
import { openTestDatabase } from './stubs/db';

const root = join(import.meta.dirname, '..');

describe('saved recipe match confirmation', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  it('persists the canonical selected for an unresolved ingredient', async () => {
    const recipe = await insertRecipe({
      title: 'Noodle bowl',
      sourceLink: 'https://example.test/noodles',
      ingredients: [{
        name: 'spring onions',
        quantity: 2,
        unit: 'piece',
        canonicalId: null,
      }],
    });

    await updateRecipe({
      ...recipe,
      ingredients: recipe.ingredients.map((ingredient) => ({
        ...ingredient,
        canonicalId: 'green-onion',
      })),
    });

    const stored = await getRecipe(recipe.id);
    expect(stored?.ingredients[0]).toMatchObject({
      name: 'spring onions',
      canonicalId: 'green-onion',
    });
    expect(stored?.sourceLink).toBe('https://example.test/noodles');
  });

  it('connects recipe uncertainty to the shared learning surface', () => {
    const detail = readFileSync(join(root, 'app/recipe/[id].tsx'), 'utf8');
    const sheet = readFileSync(
      join(root, 'src/components/match/ConfirmMatchSheet.tsx'),
      'utf8',
    );

    expect(detail).toContain('resolveIngredientReferencesLocally');
    expect(detail).toContain("outcome.status !== 'needs_confirmation'");
    expect(detail).toContain('onResolved={persistConfirmedMatch}');
    expect(sheet).toContain('onResolved?: (raw: string, canonicalId: string | null)');
    expect(sheet).toContain('confirmMatch(current.raw, item.id)');
  });
});
