import { beforeAll, describe, expect, test } from 'vitest';

import { getAllCanonicals, loadSeedData } from '@/db/queries';
import { STARTER_MEAL_PREP_TEMPLATES } from '@/logic/mealPrepTemplates';
import {
  auditCatalogueRecipe,
  auditMealPrepTemplate,
  catalogueCuisines,
  catalogueForMealType,
  foodTermsInSteps,
  isNoCook,
  PLANNER_CATALOGUE,
  snapshotCatalogueRecipe,
} from '@/logic/plannerCatalogue';
import { plannerRecipeEligible } from '@/logic/plannerRecipe';
import type { CanonicalItem, PlannedMealType } from '@/types';
import { db, openTestDatabase } from './stubs/db';

/**
 * These run against the real shipped catalogue, not a fixture. The point of the
 * collection is that its nutrition comes from reviewed source data, so a test
 * with invented canonicals would prove nothing.
 */
let canonicals: ReadonlyMap<string, CanonicalItem>;

beforeAll(async () => {
  openTestDatabase();
  await loadSeedData();
  const all = await getAllCanonicals();
  canonicals = new Map(all.map((item) => [item.id, item]));
});

const snapshotOf = (recipe: (typeof PLANNER_CATALOGUE)[number]) => {
  let next = 0;
  return snapshotCatalogueRecipe({
    recipe,
    canonicals,
    snapshotId: `snap-${recipe.id}`,
    ingredientId: () => `ing-${++next}`,
    createdAt: '2026-09-07T00:00:00.000Z',
  });
};

describe('planner catalogue coverage', () => {
  test('every meal type has at least three choices', () => {
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as PlannedMealType[]) {
      expect(catalogueForMealType(mealType).length).toBeGreaterThanOrEqual(3);
    }
    // Pinned so docs/planner-catalogue-provenance.md cannot drift from the code.
    // Twelve recipes serve more than one meal type, which is why these exceed
    // nineteen. Three of them — the rolled omelette, miyeokguk and tteokguk —
    // serve all three, which is where breakfast's sixth and lunch's extras come
    // from rather than from six separate breakfasts being authored.
    expect({
      breakfast: catalogueForMealType('breakfast').length,
      lunch: catalogueForMealType('lunch').length,
      dinner: catalogueForMealType('dinner').length,
      total: PLANNER_CATALOGUE.length,
    }).toEqual({ breakfast: 6, lunch: 13, dinner: 15, total: 19 });
  });

  test('at least one breakfast needs no appliance and cooks nothing', () => {
    const noCook = catalogueForMealType('breakfast').filter(isNoCook);
    expect(noCook.length).toBeGreaterThanOrEqual(1);
    expect(noCook[0]?.requiredAppliances).toEqual([]);
  });

  test('Asian cuisines carry real coverage rather than one token entry', () => {
    const asian = PLANNER_CATALOGUE.filter((recipe) =>
      recipe.cuisines.some((cuisine) => ['Chinese', 'Japanese', 'Korean'].includes(cuisine)));
    expect(asian.length).toBeGreaterThanOrEqual(5);
    // Spread across the day, not clustered into dinner.
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as PlannedMealType[]) {
      expect(asian.some((recipe) => recipe.mealTypes.includes(mealType))).toBe(true);
    }
    // Korean is nine entries, not one tile's worth: three that also serve
    // breakfast, two stews, a grill, a rice bowl and two New Year soups.
    const korean = PLANNER_CATALOGUE.filter((recipe) => recipe.cuisines.includes('Korean'));
    expect(korean).toHaveLength(9);
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as PlannedMealType[]) {
      expect(korean.some((recipe) => recipe.mealTypes.includes(mealType))).toBe(true);
    }
    expect(catalogueCuisines()).toEqual(['Chinese', 'International', 'Italian', 'Japanese', 'Korean', 'Mediterranean']);
  });

  test('the Asian entries lean on ingredients that keep their original script', async () => {
    // Decision 4 is that deep Asian coverage is the differentiator and that
    // aliases are stored in script. A collection that reached that coverage
    // through romanised generics would not be exercising it.
    const asianIngredients = new Set(PLANNER_CATALOGUE
      .filter((recipe) => recipe.cuisines.some((cuisine) => ['Chinese', 'Japanese', 'Korean'].includes(cuisine)))
      .flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.canonicalId)));
    const rows = await db().getAllAsync<{ canonical_id: string; alias_raw: string }>(
      'SELECT canonical_id, alias_raw FROM item_aliases',
    );
    const inScript = new Set(rows
      .filter((row) => /[^\u0000-\u007F]/u.test(row.alias_raw))
      .map((row) => row.canonical_id));
    // Guard the guard: a class that also matched ASCII would make this vacuous.
    expect(inScript.has('oats')).toBe(false);
    const covered = [...asianIngredients].filter((id) => inScript.has(id));
    expect(covered.length).toBeGreaterThanOrEqual(6);
    for (const id of ['miso', 'bok-choy', 'shiitake-mushroom', 'soy-sauce-light', 'tofu-firm', 'sesame-oil']) {
      expect(inScript.has(id), `${id} has no original-script alias`).toBe(true);
    }

    // And the Korean entries reach Hangul specifically, not romanisation. The
    // dumplings are the test that matters: one canonical answers to 만두 and to
    // 饺子, because it is one food, and a second canonical would have split it.
    const hangul = new Set(rows
      .filter((row) => /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/u.test(row.alias_raw))
      .map((row) => row.canonical_id));
    for (const id of ['frozen-dumplings', 'eggs', 'green-onion', 'sesame-oil', 'soy-sauce-light']) {
      expect(hangul.has(id), `${id} has no Hangul alias`).toBe(true);
    }
  });

  test('recipe ids and titles are unique', () => {
    expect(new Set(PLANNER_CATALOGUE.map((recipe) => recipe.id)).size).toBe(PLANNER_CATALOGUE.length);
    expect(new Set(PLANNER_CATALOGUE.map((recipe) => recipe.title)).size).toBe(PLANNER_CATALOGUE.length);
  });
});

describe('planner catalogue audit', () => {
  test('every authored recipe passes its own audit against the shipped catalogue', () => {
    const failures = PLANNER_CATALOGUE
      .map((recipe) => auditCatalogueRecipe({ recipe, canonicals }))
      .filter((audit) => audit.findings.length > 0)
      .map((audit) => `${audit.recipeId}: ${audit.findings.map((finding) => `${finding.kind} — ${finding.detail}`).join('; ')}`);
    expect(failures).toEqual([]);
  });

  test('no authored ingredient is left without catalogue nutrition', () => {
    for (const recipe of PLANNER_CATALOGUE) {
      expect(auditCatalogueRecipe({ recipe, canonicals }).unresolvedIngredients).toEqual([]);
    }
  });

  test('calories, protein, carbohydrate and fat are known for every recipe', () => {
    for (const recipe of PLANNER_CATALOGUE) {
      const { unknownNutrients } = auditCatalogueRecipe({ recipe, canonicals });
      expect(unknownNutrients).not.toContain('calories');
      expect(unknownNutrients).not.toContain('proteinG');
      expect(unknownNutrients).not.toContain('carbsG');
      expect(unknownNutrients).not.toContain('fatG');
    }
  });

  test('the audit catches an instruction asking for a food nobody bought', () => {
    const stew = STARTER_MEAL_PREP_TEMPLATES.find((template) => template.id === 'slow-cooker-chicken-stew')!;
    const audit = auditMealPrepTemplate({ template: stew, canonicals });
    const mismatch = audit.findings.filter((finding) => finding.kind === 'instruction_names_unlisted_food');
    expect(mismatch.map((finding) => finding.detail)).toEqual([
      expect.stringContaining('"stock"'),
    ]);
  });

  test('the audit catches an ingredient no step ever uses', () => {
    const audit = auditCatalogueRecipe({
      canonicals,
      recipe: {
        ...PLANNER_CATALOGUE[0]!,
        id: 'fixture-unused',
        steps: [{ stepNumber: 1, instruction: 'Stir the rolled oats and honey together.', applianceId: null, actionType: 'no_cook' }],
      },
    });
    const unused = audit.findings.filter((finding) => finding.kind === 'unused_ingredient').map((finding) => finding.detail);
    expect(unused).toHaveLength(3);
    expect(unused.join(' ')).toContain('greek-yogurt');
    expect(unused.join(' ')).toContain('banana');
    expect(unused.join(' ')).toContain('peanut-butter');
  });

  test('the audit rejects a unit the catalogue cannot convert', () => {
    const audit = auditMealPrepTemplate({
      canonicals,
      template: {
        id: 'fixture-piece', title: 'Piece amounts', portions: 1, durationMinutes: 5,
        requiredAppliances: [], steps: [{ stepNumber: 1, instruction: 'Chop the garlic.', applianceId: null, actionType: 'prep' }],
        ingredients: [{ canonicalId: 'garlic', name: 'Garlic', quantity: 2, unit: 'piece' }],
      },
    });
    expect(audit.findings.map((finding) => finding.kind)).toEqual(
      expect.arrayContaining(['non_gram_unit', 'unresolved_nutrition']),
    );
  });

  test('every one of the seven pre-existing starter templates still fails this audit', () => {
    // Recorded, not asserted as acceptable: these are the recipes the planner
    // must NOT reuse unchanged. If one ever passes, the catalogue gap behind it
    // was filled and it becomes a candidate for the collection.
    for (const template of STARTER_MEAL_PREP_TEMPLATES) {
      const audit = auditMealPrepTemplate({ template, canonicals });
      expect(audit.findings.length, `${template.id} unexpectedly passes`).toBeGreaterThan(0);
    }
  });

  test('word boundaries keep "rice" and "slice" out of "ice"', () => {
    expect(foodTermsInSteps([
      { stepNumber: 1, instruction: 'Slice the banana and serve over rice.', applianceId: null },
    ])).toEqual(expect.arrayContaining(['rice', 'banana']));
    expect(foodTermsInSteps([
      { stepNumber: 1, instruction: 'Slice the banana.', applianceId: null },
    ])).not.toContain('ice');
  });

  test('a longer term is not double-counted as a shorter one', () => {
    const terms = foodTermsInSteps([
      { stepNumber: 1, instruction: 'Add the light soy sauce and the sesame oil.', applianceId: null },
    ]);
    expect(terms).toContain('light soy sauce');
    expect(terms).not.toContain('soy sauce');
    expect(terms).toContain('sesame oil');
    expect(terms).not.toContain('sesame');
  });
});

describe('planner catalogue snapshots', () => {
  test('nutrition is computed from the catalogue and carries its provenance', () => {
    for (const recipe of PLANNER_CATALOGUE) {
      const snapshot = snapshotOf(recipe);
      expect(snapshot.nutritionPerPortion.source).toBe('canonical_catalogue');
      expect(snapshot.nutritionPerPortion.calories).toBeGreaterThan(0);
      for (const ingredient of snapshot.ingredients) {
        expect(ingredient.nutrition.source).toBe('canonical_catalogue');
      }
    }
  });

  test('every snapshot ingredient states the weight basis it was costed on', () => {
    for (const recipe of PLANNER_CATALOGUE) {
      for (const ingredient of snapshotOf(recipe).ingredients) {
        expect(ingredient.preparation, `${recipe.id}/${ingredient.canonicalId}`).toBeTruthy();
      }
      // Raw-weighed proteins must say so, because the cited source records are raw.
      const chicken = snapshotOf(recipe).ingredients.find((ingredient) => ingredient.canonicalId === 'chicken-breast');
      if (chicken) expect(chicken.preparation).toContain('raw');
    }
  });

  test('the snapshot carries the recipe version, so a later edit is detectable', () => {
    const snapshot = snapshotOf(PLANNER_CATALOGUE[0]!);
    expect(snapshot.sourceVersion).toBe(PLANNER_CATALOGUE[0]!.version);
    expect(snapshot.sourceKind).toBe('starter');
    expect(snapshot.sourceId).toBe(PLANNER_CATALOGUE[0]!.id);
  });

  test('the batch fixture from the design holds: 600 g across four portions', () => {
    const recipe = PLANNER_CATALOGUE.find((entry) => entry.id === 'planner-ginger-chicken-bok-choy')!;
    const chicken = recipe.ingredients.find((ingredient) => ingredient.canonicalId === 'chicken-breast')!;
    expect(chicken.grams).toBe(600);
    expect(recipe.baseYield).toBe(4);

    const snapshot = snapshotOf(recipe);
    const snapshotChicken = snapshot.ingredients.find((ingredient) => ingredient.canonicalId === 'chicken-breast')!;
    // The ingredient amount is the whole batch's demand, not one portion's.
    expect(snapshotChicken.quantity).toBe(600);
    // The nutrition on the snapshot is per portion, so it is a quarter of the batch.
    expect(snapshot.nutritionPerPortion.calories! * recipe.baseYield)
      .toBeCloseTo(snapshot.ingredients.reduce((total, ingredient) => total + ingredient.nutrition.calories!, 0), 6);
  });

  test('unknown fibre stays unknown rather than becoming zero', () => {
    // Rolled oats have no fibre value in the shipped catalogue, so any recipe
    // using them must report fibre as unknown while still costing its calories.
    const oatRecipe = PLANNER_CATALOGUE.find((entry) => entry.id === 'planner-overnight-oats-banana-peanut')!;
    const snapshot = snapshotOf(oatRecipe);
    expect(snapshot.nutritionPerPortion.fibreG).toBeNull();
    expect(snapshot.nutritionPerPortion.calories).toBeGreaterThan(0);

    // And a recipe whose ingredients all carry fibre reports a real figure.
    const salmon = snapshotOf(PLANNER_CATALOGUE.find((entry) => entry.id === 'planner-miso-glazed-salmon')!);
    expect(salmon.nutritionPerPortion.fibreG).toBeGreaterThan(0);
  });

  test('per-portion figures match the shipped catalogue exactly', () => {
    const perPortion = Object.fromEntries(PLANNER_CATALOGUE.map((recipe) => {
      const { calories, proteinG, carbsG, fatG, fibreG } = snapshotOf(recipe).nutritionPerPortion;
      const round = (value: number | null) => value === null ? null : Math.round(value * 10) / 10;
      return [recipe.id, [round(calories), round(proteinG), round(carbsG), round(fatG), round(fibreG)]];
    }));
    expect(perPortion).toEqual(EXPECTED_PER_PORTION);
  });
});

describe('planner catalogue selection has no pantry gate', () => {
  test('an empty pantry removes nothing from any meal type', () => {
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as PlannedMealType[]) {
      const listed = catalogueForMealType(mealType);
      const eligible = listed.filter((recipe) =>
        plannerRecipeEligible({ recipe: snapshotOf(recipe), mealType }));
      expect(eligible).toHaveLength(listed.length);
    }
  });

  test('equipment and dietary exclusions still apply', () => {
    const noAppliances = PLANNER_CATALOGUE.filter((recipe) =>
      plannerRecipeEligible({ recipe: snapshotOf(recipe), ownedAppliances: new Set() }));
    expect(noAppliances.every(isNoCook)).toBe(true);
    expect(noAppliances.length).toBeGreaterThanOrEqual(2);

    // Excluding wheat drops the shoyu recipes and keeps the tamari ones. The
    // catalogue's own source record for `soy-sauce-light` is "Soy sauce made
    // from soy and wheat (shoyu)"; `tamari` is "made from soy".
    const withoutWheat = PLANNER_CATALOGUE.filter((recipe) =>
      plannerRecipeEligible({ recipe: snapshotOf(recipe), excludedCanonicalIds: new Set(['soy-sauce-light', 'hoisin-sauce']) }));
    expect(withoutWheat.map((recipe) => recipe.id)).not.toContain('planner-ginger-chicken-bok-choy');
    expect(withoutWheat.map((recipe) => recipe.id)).toContain('planner-smashed-cucumber-tofu-salad');
    expect(withoutWheat.map((recipe) => recipe.id)).toContain('planner-miso-glazed-salmon');
  });
});

/**
 * Computed from the shipped catalogue, kept here so a silent change to either a
 * recipe amount or a canonical's source data fails loudly. Values are kcal,
 * protein g, carbohydrate g, fat g and fibre g per portion, rounded to one
 * decimal. A `null` fibre is the honest reading of a gap in the source data,
 * not a zero, and sixteen of the nineteen entries have one.
 */
const EXPECTED_PER_PORTION: Record<string, (number | null)[]> = {
  'planner-overnight-oats-banana-peanut': [516.4, 27.9, 72.3, 14.1, null],
  'planner-miso-tofu-morning-soup': [212.1, 16.4, 13.6, 11.7, 5.3],
  'planner-savoury-oat-porridge-shiitake': [316.4, 11.2, 48.7, 8.7, null],
  'planner-smashed-cucumber-tofu-salad': [364.3, 23.3, 17, 24.5, null],
  'planner-ginger-chicken-bok-choy': [264.8, 37.3, 11, 8.4, null],
  'planner-garlic-shrimp-tomato': [255.9, 31.6, 7.6, 11.4, null],
  'planner-pork-belly-bok-choy-braise': [842.8, 16.7, 12.7, 80.1, null],
  'planner-miso-glazed-salmon': [398.5, 35.8, 13.7, 21.8, 2.4],
  'planner-braised-tofu-ginger-pork': [352.8, 31.1, 5.5, 24.6, null],
  'planner-chicken-thigh-tomato-parmesan': [364.6, 34.4, 5.5, 23.1, null],
  'planner-gyeran-mari-rolled-omelette': [165.8, 10.6, 2.5, 12.3, 0.5],
  'planner-bulgogi-marinated-beef': [306.3, 26.7, 10.2, 18.1, null],
  'planner-mandu-guk-dumpling-soup': [286.3, 22.2, 17.8, 14.1, null],
  'planner-kimchi-jjigae-pork-tofu': [406.6, 14.3, 11, 35.1, null],
  'planner-doenjang-jjigae-pork-tofu': [213.3, 15.6, 11.9, 12.3, null],
  'planner-bibimbap-beef-vegetables': [737.4, 27.3, 96.4, 26.4, null],
  'planner-miyeokguk-seaweed-beef-soup': [152.9, 14.9, 4.2, 9.1, null],
  'planner-tteokguk-rice-cake-soup': [384.7, 19, 54.3, 10.3, null],
  'planner-tteok-mandu-guk-new-year-soup': [447.9, 25.2, 53.2, 15, null],
};
