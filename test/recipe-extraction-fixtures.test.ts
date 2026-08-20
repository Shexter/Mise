import { describe, expect, test } from 'vitest';

import { parseRecipeResponse } from '../src/api/recipe';
import { buildRecipePrompt } from '../src/api/recipePrompt';
import { RECIPE_CAPTION_FIXTURES } from './fixtures/recipeCaptions';

describe('recipe caption fixture corpus', () => {
  test('contains exactly 20 captions covering every required shape', () => {
    expect(RECIPE_CAPTION_FIXTURES).toHaveLength(20);
    const traits = new Set(RECIPE_CAPTION_FIXTURES.flatMap((fixture) => fixture.traits));
    expect(traits).toEqual(new Set([
      'social', 'youtube', 'cjk', 'prose_quantity',
      'mostly_hashtags', 'bare_link', 'non_recipe',
    ]));
    expect(new Set(RECIPE_CAPTION_FIXTURES.map((fixture) => fixture.language))).toEqual(
      new Set(['en', 'ja', 'zh-Hans', 'ko']),
    );
  });

  test('buildRecipePrompt includes every supplied caption verbatim', () => {
    for (const fixture of RECIPE_CAPTION_FIXTURES) {
      const prompt = buildRecipePrompt(fixture.caption);
      expect(prompt, fixture.name).toContain(fixture.caption);
      expect(prompt, fixture.name).toContain('user-supplied text');
    }
  });
});

describe('parseRecipeResponse against recipe caption fixtures', () => {
  test('parses every recorded recipe response without changing title, ingredients, or steps', () => {
    for (const fixture of RECIPE_CAPTION_FIXTURES) {
      if (fixture.expected === null) continue;
      expect(parseRecipeResponse(fixture.recordedResponse), fixture.name).toEqual({
        title: fixture.expected.title,
        ingredients: fixture.expected.ingredients,
        steps: fixture.expected.steps,
      });
    }
  });

  test('never invents a quantity where the caption states none — decision 15', () => {
    for (const fixture of RECIPE_CAPTION_FIXTURES) {
      if (fixture.expected === null) continue;
      const parsed = parseRecipeResponse(fixture.recordedResponse);
      for (const name of fixture.unstatedQuantityIngredients) {
        const ingredient = parsed.ingredients.find((candidate) => candidate.name === name);
        expect(ingredient, `${fixture.name}: ${name}`).toBeDefined();
        expect(ingredient?.quantity, `${fixture.name}: ${name}`).toBeNull();
        expect(ingredient?.unit, `${fixture.name}: ${name}`).toBeNull();
      }
    }
  });

  test('flags bare links and non-recipe captions instead of hallucinating ingredients', () => {
    const nonRecipes = RECIPE_CAPTION_FIXTURES.filter((fixture) =>
      fixture.traits.includes('non_recipe'),
    );
    expect(nonRecipes).toHaveLength(4);

    for (const fixture of nonRecipes) {
      expect(JSON.parse(fixture.recordedResponse), fixture.name).toEqual({ is_recipe: false });
      expect(() => parseRecipeResponse(fixture.recordedResponse), fixture.name).toThrow(
        'No recipe was found in that text.',
      );
    }
  });

  test('keeps a mostly-hashtag recipe distinct from mostly-hashtag food commentary', () => {
    const hashtagFixtures = RECIPE_CAPTION_FIXTURES.filter((fixture) =>
      fixture.traits.includes('mostly_hashtags'),
    );
    expect(hashtagFixtures).toHaveLength(2);

    const recipe = hashtagFixtures.find((fixture) => fixture.expected !== null);
    const commentary = hashtagFixtures.find((fixture) => fixture.expected === null);
    expect(parseRecipeResponse(recipe!.recordedResponse).ingredients).toEqual([
      { name: 'eggs', quantity: 2, unit: 'piece' },
      { name: 'spinach', quantity: null, unit: null },
    ]);
    expect(() => parseRecipeResponse(commentary!.recordedResponse)).toThrow(
      'No recipe was found in that text.',
    );
  });

  test('preserves CJK titles and ingredient names in their original scripts', () => {
    const cjkFixtures = RECIPE_CAPTION_FIXTURES.filter((fixture) => fixture.traits.includes('cjk'));
    expect(cjkFixtures).toHaveLength(5);

    for (const fixture of cjkFixtures) {
      if (fixture.expected === null) throw new Error(`${fixture.name} must be a recipe fixture`);
      const parsed = parseRecipeResponse(fixture.recordedResponse);
      expect(parsed.title, fixture.name).toBe(fixture.expected.title);
      expect(parsed.ingredients.map((ingredient) => ingredient.name), fixture.name).toEqual(
        fixture.expected.ingredients.map((ingredient) => ingredient.name),
      );
      expect(parsed.title, fixture.name).toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Hangul}]/u);
    }
  });
});
