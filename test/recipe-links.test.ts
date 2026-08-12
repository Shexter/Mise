import { beforeEach, describe, expect, test } from 'vitest';

import { parseRecipeResponse } from '@/api/recipe';
import { getRecipe, insertRecipe, listRecipes, updateRecipe } from '@/db/queries';
import { openTestDatabase } from './stubs/db';

beforeEach(() => { openTestDatabase(); });

describe('saved recipe persistence', () => {
  test('keeps a source link and an intentionally missing quantity', async () => {
    const saved = await insertRecipe({
      title: 'Sesame noodles', sourceLink: 'https://example.com/recipe', steps: ['Mix.'],
      ingredients: [{ name: 'Sesame oil', quantity: null, unit: null, canonicalId: null }],
    });
    expect(saved.sourceLink).toBe('https://example.com/recipe');
    expect((await getRecipe(saved.id))?.ingredients[0]).toMatchObject({ name: 'Sesame oil', quantity: null });
    expect((await listRecipes()).map((recipe) => recipe.id)).toEqual([saved.id]);
  });

  test('editing ingredients retains the original source link', async () => {
    const saved = await insertRecipe({ title: 'Noodles', sourceLink: 'https://example.com/post' });
    const updated = await updateRecipe({ ...saved, title: 'Better noodles', ingredients: [] });
    expect(updated.sourceLink).toBe('https://example.com/post');
    expect((await getRecipe(saved.id))?.sourceLink).toBe('https://example.com/post');
  });
});

describe('recipe extraction parser', () => {
  test('keeps no quantity where the supplied recipe states none', () => {
    const parsed = parseRecipeResponse(JSON.stringify({
      is_recipe: true, title: 'Noodles',
      ingredients: [{ name: 'Sesame oil', quantity: null, unit: null }, { name: 'Noodles', quantity: 200, unit: 'g' }],
      steps: ['Mix.'],
    }));
    expect(parsed.ingredients).toEqual([
      { name: 'Sesame oil', quantity: null, unit: null },
      { name: 'Noodles', quantity: 200, unit: 'g' },
    ]);
  });

  test('reports non-recipe content instead of inventing a recipe', () => {
    expect(() => parseRecipeResponse('{"is_recipe":false}')).toThrow('No recipe was found');
  });
});
