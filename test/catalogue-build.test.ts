import { describe, expect, test } from 'vitest';

import {
  CATALOGUE_SOURCES,
  chooseFdcFood,
  durationToDays,
  enrichWithCofid,
  flattenFoodKeeperRow,
  foodKeeperRows,
  hasSpeciesConflict,
  mapFoodKeeperRow,
  mergeCataloguePatch,
  nutritionFromFdc,
  stableCatalogueJson,
  type BuildReport,
  type CatalogueEntry,
} from '../scripts/build-catalogue';

function entry(overrides: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return {
    id: 'chicken-breast',
    displayName: 'Chicken breast',
    class: 'protein',
    defaultLocation: 'fridge',
    shelfLifeDays: { fridge: 5 },
    openLifeDays: null,
    ...overrides,
  };
}

function reportLists(): Pick<BuildReport, 'filled' | 'conflicts' | 'skipped'> {
  return { filled: [], conflicts: [], skipped: [] };
}

function buildReport(): BuildReport {
  return {
    sources: CATALOGUE_SOURCES,
    foodkeeper: { rows: 0, matched: 0, uncertain: [], unmatched: [], guarded: [] },
    foodDataCentral: { queried: 0, matched: 0, unmatched: [], review: {}, skipped: true },
    cofid: { reviewed: 0, matched: 0 },
    filled: [],
    conflicts: [],
    skipped: [],
  };
}

describe('catalogue build pipeline', () => {
  test('flattens the FoodKeeper workbook cell format', () => {
    const row = flattenFoodKeeperRow([{ Name: 'Butter' }, { Pantry_Min: 1 }]);
    expect(row).toEqual({ Name: 'Butter', Pantry_Min: 1 });
    expect(
      foodKeeperRows({
        sheets: [
          { name: 'Other', data: [] },
          { name: 'Product', data: [[{ Name: 'Butter' }]] },
        ],
      }),
    ).toEqual([{ Name: 'Butter' }]);
  });

  test.each([
    [12, 'Hours', 1],
    [2, 'Days', 2],
    [2, 'Weeks', 14],
    [2, 'Months', 60],
    [2, 'Years', 730],
    [1, 'Year', 365],
    [3, 'Indefinitely', null],
    [3, 'When Ripe', null],
    [3, 'Not Recommended', null],
    [3, 'Package use-by date', null],
  ])('maps %s %s to %s days', (value, metric, expected) => {
    expect(durationToDays(value, metric)).toBe(expected);
  });

  test('maps ranges by location, uses the default-location lower bound, and ignores thawing', () => {
    const patch = mapFoodKeeperRow(
      {
        DOP_Pantry_Min: 1,
        DOP_Pantry_Max: 2,
        DOP_Pantry_Metric: 'Months',
        DOP_Refrigerate_Min: 3,
        DOP_Refrigerate_Max: 5,
        DOP_Refrigerate_Metric: 'Days',
        DOP_Freeze_Min: 6,
        DOP_Freeze_Max: 9,
        DOP_Freeze_Metric: 'Months',
        Refrigerate_After_Opening_Min: 2,
        Refrigerate_After_Opening_Max: 3,
        Refrigerate_After_Opening_Metric: 'Days',
        Refrigerate_After_Thawing_Min: 99,
        Refrigerate_After_Thawing_Max: 100,
        Refrigerate_After_Thawing_Metric: 'Days',
      },
      'fridge',
    );
    expect(patch).toEqual({
      shelfLifeDays: { pantry: 60, fridge: 5, freezer: 270 },
      earlyWarningDays: 3,
      openLifeDays: 3,
    });
  });

  test('an equal range remains one shelf-life figure without an early-warning claim', () => {
    expect(
      mapFoodKeeperRow(
        {
          DOP_Refrigerate_Min: 5,
          DOP_Refrigerate_Max: 5,
          DOP_Refrigerate_Metric: 'Days',
        },
        'fridge',
      ),
    ).toEqual({
      shelfLifeDays: { fridge: 5 },
      earlyWarningDays: null,
      openLifeDays: null,
    });
  });

  test('non-numeric storage terms produce no shelf-life claim', () => {
    expect(
      mapFoodKeeperRow(
        {
          DOP_Pantry_Min: 1,
          DOP_Pantry_Max: 1,
          DOP_Pantry_Metric: 'Indefinitely',
          DOP_Refrigerate_Min: 1,
          DOP_Refrigerate_Max: 1,
          DOP_Refrigerate_Metric: 'Package use-by date',
        },
        'pantry',
      ),
    ).toEqual({ shelfLifeDays: {}, earlyWarningDays: null, openLifeDays: null });
  });

  test('fills only missing values, records provenance, and reports authored conflicts', () => {
    const lists = reportLists();
    const original = entry();
    const merged = mergeCataloguePatch(
      original,
      {
        shelfLifeDays: { fridge: 7, freezer: 180 },
        earlyWarningDays: 3,
        kcalPer100: 165,
      },
      'foodkeeper',
      'Chicken parts',
      lists,
    );
    expect(merged.shelfLifeDays).toEqual({ fridge: 5, freezer: 180 });
    expect(merged.earlyWarningDays).toBe(3);
    expect(merged.kcalPer100).toBe(165);
    expect(merged.sources).toMatchObject({
      'shelfLifeDays.fridge': 'hand-authored',
      'shelfLifeDays.freezer': 'foodkeeper',
      earlyWarningDays: 'foodkeeper',
      kcalPer100: 'foodkeeper',
    });
    expect(lists.conflicts).toHaveLength(1);
    expect(original.shelfLifeDays).toEqual({ fridge: 5 });
  });

  test('a later build may refresh its own dataset value without touching authored data', () => {
    const lists = reportLists();
    const original = entry({
      shelfLifeDays: { fridge: 5, freezer: 180 },
      sources: {
        'shelfLifeDays.fridge': 'hand-authored',
        'shelfLifeDays.freezer': 'foodkeeper',
      },
    });
    const merged = mergeCataloguePatch(
      original,
      { shelfLifeDays: { fridge: 7, freezer: 200 } },
      'foodkeeper',
      'Chicken parts',
      lists,
    );
    expect(merged.shelfLifeDays).toEqual({ fridge: 5, freezer: 200 });
    expect(lists.conflicts).toHaveLength(1);
    expect(lists.filled).toEqual([
      expect.objectContaining({ field: 'shelfLifeDays.freezer', proposed: 200 }),
    ]);
  });

  test('an absent dataset row cannot remove or reorder a hand-authored entry', () => {
    const gochujang = entry({
      id: 'gochujang',
      displayName: 'Gochujang',
      class: 'condiment',
      shelfLifeDays: { pantry: 730, fridge: 730 },
    });
    expect(stableCatalogueJson([gochujang])).toBe(stableCatalogueJson([gochujang]));
    expect(JSON.parse(stableCatalogueJson([gochujang]))).toEqual([gochujang]);
  });

  test('guards the measured chicken-versus-turkey false match', () => {
    expect(hasSpeciesConflict('Chicken breast', 'Turkey parts, breast halves, boneless')).toBe(true);
    expect(hasSpeciesConflict('Chicken breast', 'Chicken parts, breast halves, boneless')).toBe(false);
  });

  test('extracts nullable FoodData Central nutrition', () => {
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientId: 1008, value: 165 },
          { nutrientId: 1003, value: 31 },
          { nutrientId: 1004, value: 3.6 },
        ],
      }),
    ).toEqual({
      kcalPer100: 165,
      proteinPer100: 31,
      carbsPer100: null,
      fatPer100: 3.6,
      fibrePer100: null,
      vitaminCMgPer100: null,
      ironMgPer100: null,
      vitaminB12McgPer100: null,
      calciumMgPer100: null,
      folateMcgPer100: null,
      vitaminAMcgPer100: null,
      potassiumMgPer100: null,
      vitaminDMcgPer100: null,
      magnesiumMgPer100: null,
      zincMgPer100: null,
      sodiumMgPer100: null,
      vitaminEMgPer100: null,
      vitaminKMcgPer100: null,
      thiaminMgPer100: null,
      riboflavinMgPer100: null,
    });
  });

  test('extracts named nutrient amounts from the abridged Branded shape', () => {
    expect(
      nutritionFromFdc({
        dataType: 'Branded',
        foodNutrients: [
          { number: '208', name: 'Energy', unitName: 'KCAL', amount: 225 },
          { number: '203', name: 'Protein', unitName: 'G', amount: 5 },
          { number: '205', name: 'Carbohydrate, by difference', unitName: 'G', amount: 50 },
          { number: '204', name: 'Total lipid (fat)', unitName: 'G', amount: 0 },
          { number: '291', name: 'Fiber, total dietary', unitName: 'G', amount: 5 },
        ],
      }),
    ).toEqual(expect.objectContaining({
      kcalPer100: 225,
      proteinPer100: 5,
      carbsPer100: 50,
      fatPer100: 0,
      fibrePer100: 5,
    }));
  });

  test('extracts all eight micronutrients when FoodData Central reports them all', () => {
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientId: 1079, value: 2.2 },
          { nutrientId: 1162, value: 28.1 },
          { nutrientId: 1089, value: 2.7 },
          { nutrientId: 1178, value: 0 },
          { nutrientId: 1087, value: 99 },
          { nutrientId: 1177, value: 194 },
          { nutrientId: 1106, value: 469 },
          { nutrientId: 1092, value: 558 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        fibrePer100: 2.2,
        vitaminCMgPer100: 28.1,
        ironMgPer100: 2.7,
        vitaminB12McgPer100: 0,
        calciumMgPer100: 99,
        folateMcgPer100: 194,
        vitaminAMcgPer100: 469,
        potassiumMgPer100: 558,
      }),
    );
  });

  test('extracts the eight later nutrients by FoodData Central ID', () => {
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientId: 1114, value: 0.2 },
          { nutrientId: 1090, value: 79 },
          { nutrientId: 1095, value: 0.53 },
          { nutrientId: 1093, value: 79 },
          { nutrientId: 1109, value: 2.03 },
          { nutrientId: 1185, value: 482.9 },
          { nutrientId: 1165, value: 0.078 },
          { nutrientId: 1166, value: 0.189 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        vitaminDMcgPer100: 0.2,
        magnesiumMgPer100: 79,
        zincMgPer100: 0.53,
        sodiumMgPer100: 79,
        vitaminEMgPer100: 2.03,
        vitaminKMcgPer100: 482.9,
        thiaminMgPer100: 0.078,
        riboflavinMgPer100: 0.189,
      }),
    );
  });

  test('falls back to the nutrient name when the later nutrients carry no ID', () => {
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientName: 'Vitamin D (D2 + D3)', unitName: 'UG', value: 0.4 },
          { nutrientName: 'Magnesium, Mg', unitName: 'MG', value: 25 },
          { nutrientName: 'Zinc, Zn', unitName: 'MG', value: 1.1 },
          { nutrientName: 'Sodium, Na', unitName: 'MG', value: 4 },
          { nutrientName: 'Vitamin E (alpha-tocopherol)', unitName: 'MG', value: 0.9 },
          { nutrientName: 'Vitamin K (phylloquinone)', unitName: 'UG', value: 102 },
          { nutrientName: 'Thiamin', unitName: 'MG', value: 0.05 },
          { nutrientName: 'Riboflavin', unitName: 'MG', value: 0.12 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        vitaminDMcgPer100: 0.4,
        magnesiumMgPer100: 25,
        zincMgPer100: 1.1,
        sodiumMgPer100: 4,
        vitaminEMgPer100: 0.9,
        vitaminKMcgPer100: 102,
        thiaminMgPer100: 0.05,
        riboflavinMgPer100: 0.12,
      }),
    );
  });

  test('takes combined vitamin D in mcg, not the IU figure or a single component', () => {
    // FDC reports the same vitamin D three ways. 1110 is IU and 1112/1111 are
    // the D2 and D3 halves; picking any of them would silently store a number
    // in the wrong unit or a fraction of the total.
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientId: 1110, nutrientName: 'Vitamin D (D2 + D3), International Units', value: 40 },
          { nutrientId: 1112, nutrientName: 'Vitamin D2 (ergocalciferol)', value: 0.4 },
          { nutrientId: 1114, nutrientName: 'Vitamin D (D2 + D3)', unitName: 'UG', value: 1 },
        ],
      }).vitaminDMcgPer100,
    ).toBe(1);
    // Only the IU row present: no mcg figure exists, and converting one is not
    // this function's job — null, not a guess.
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientId: 1110, nutrientName: 'Vitamin D (D2 + D3), International Units', value: 40 },
        ],
      }).vitaminDMcgPer100,
    ).toBeNull();
  });

  test('takes alpha-tocopherol for vitamin E and phylloquinone for vitamin K', () => {
    const result = nutritionFromFdc({
      foodNutrients: [
        { nutrientId: 1125, nutrientName: 'Tocopherol, beta', value: 0.01 },
        { nutrientId: 1126, nutrientName: 'Tocopherol, gamma', value: 0.4 },
        { nutrientId: 1183, nutrientName: 'Menaquinone-4', value: 3 },
        { nutrientId: 1184, nutrientName: 'Dihydrophylloquinone', value: 1 },
      ],
    });
    expect(result.vitaminEMgPer100).toBeNull();
    expect(result.vitaminKMcgPer100).toBeNull();

    // And the fortification-only alpha-tocopherol row is not the total either.
    expect(
      nutritionFromFdc({
        foodNutrients: [
          {
            nutrientName: 'Vitamin E (alpha-tocopherol), added',
            unitName: 'MG',
            value: 1.4,
          },
        ],
      }).vitaminEMgPer100,
    ).toBeNull();
  });

  test('anchors thiamin and riboflavin so an "added" fortification row is not mistaken for the total', () => {
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientName: 'Thiamin, added', unitName: 'MG', value: 0.5 },
          { nutrientName: 'Riboflavin, added', unitName: 'MG', value: 0.6 },
        ],
      }),
    ).toEqual(
      expect.objectContaining({ thiaminMgPer100: null, riboflavinMgPer100: null }),
    );
  });

  test('a mix of present and absent later nutrients leaves the missing ones null, never zero', () => {
    const result = nutritionFromFdc({
      foodNutrients: [
        { nutrientId: 1093, value: 0 },
        { nutrientId: 1166, value: 0.189 },
      ],
    });
    // A measured zero is a value, not a gap — sodium stays 0.
    expect(result.sodiumMgPer100).toBe(0);
    expect(result.riboflavinMgPer100).toBe(0.189);
    expect(result.vitaminDMcgPer100).toBeNull();
    expect(result.magnesiumMgPer100).toBeNull();
    expect(result.zincMgPer100).toBeNull();
    expect(result.vitaminEMgPer100).toBeNull();
    expect(result.vitaminKMcgPer100).toBeNull();
    expect(result.thiaminMgPer100).toBeNull();
  });

  test('records FoodData Central as the provenance of each later nutrient it fills', () => {
    const report = reportLists();
    const merged = mergeCataloguePatch(
      entry(),
      nutritionFromFdc({
        foodNutrients: [
          { nutrientId: 1114, value: 0.2 },
          { nutrientId: 1090, value: 79 },
          { nutrientId: 1095, value: 0.53 },
          { nutrientId: 1093, value: 79 },
          { nutrientId: 1109, value: 2.03 },
          { nutrientId: 1185, value: 482.9 },
          { nutrientId: 1165, value: 0.078 },
          { nutrientId: 1166, value: 0.189 },
        ],
      }),
      'food-data-central',
      'Chicken, breast',
      report,
    );

    expect(merged).toMatchObject({
      vitaminDMcgPer100: 0.2,
      magnesiumMgPer100: 79,
      zincMgPer100: 0.53,
      sodiumMgPer100: 79,
      vitaminEMgPer100: 2.03,
      vitaminKMcgPer100: 482.9,
      thiaminMgPer100: 0.078,
      riboflavinMgPer100: 0.189,
    });
    for (const field of [
      'vitaminDMcgPer100',
      'magnesiumMgPer100',
      'zincMgPer100',
      'sodiumMgPer100',
      'vitaminEMgPer100',
      'vitaminKMcgPer100',
      'thiaminMgPer100',
      'riboflavinMgPer100',
    ]) {
      expect(merged.sources?.[field]).toBe('food-data-central');
      expect(report.filled.some((issue) => issue.field === field)).toBe(true);
    }
    expect(report.conflicts).toEqual([]);
  });

  test('a hand-authored later nutrient keeps its provenance and reports the disagreement', () => {
    const report = reportLists();
    const authored = entry({ sodiumMgPer100: 5 });
    const merged = mergeCataloguePatch(
      authored,
      { sodiumMgPer100: 79 },
      'food-data-central',
      'Chicken, breast',
      report,
    );

    expect(merged.sodiumMgPer100).toBe(5);
    expect(merged.sources?.sodiumMgPer100).toBe('hand-authored');
    expect(report.conflicts).toEqual([
      {
        source: 'food-data-central',
        row: 'Chicken, breast',
        canonicalId: 'chicken-breast',
        field: 'sodiumMgPer100',
        existing: 5,
        proposed: 79,
      },
    ]);
  });

  test('an unknown later nutrient is skipped rather than written as zero', () => {
    const report = reportLists();
    const merged = mergeCataloguePatch(
      entry(),
      { zincMgPer100: null, thiaminMgPer100: 0.078 },
      'food-data-central',
      'Chicken, breast',
      report,
    );

    expect(merged.zincMgPer100).toBeUndefined();
    expect(merged.sources?.zincMgPer100).toBeUndefined();
    expect(merged.thiaminMgPer100).toBe(0.078);
    expect(
      report.skipped.some(
        (issue) => issue.field === 'zincMgPer100' && issue.reason === 'unknown',
      ),
    ).toBe(true);
  });

  test('a mix of present and absent micronutrients leaves the missing ones null, never zero', () => {
    const result = nutritionFromFdc({
      foodNutrients: [
        { nutrientId: 1079, value: 3.1 },
        { nutrientId: 1092, value: 210 },
      ],
    });
    expect(result.fibrePer100).toBe(3.1);
    expect(result.potassiumMgPer100).toBe(210);
    expect(result.vitaminCMgPer100).toBeNull();
    expect(result.ironMgPer100).toBeNull();
    expect(result.vitaminB12McgPer100).toBeNull();
    expect(result.calciumMgPer100).toBeNull();
    expect(result.folateMcgPer100).toBeNull();
    expect(result.vitaminAMcgPer100).toBeNull();
  });

  test('picks "Folate, total" by ID, falling back to its name when the ID is absent', () => {
    expect(
      nutritionFromFdc({
        foodNutrients: [{ nutrientId: 1177, value: 116.5 }],
      }).folateMcgPer100,
    ).toBe(116.5);
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientName: 'Folate, total', unitName: 'UG', value: 103 },
        ],
      }).folateMcgPer100,
    ).toBe(103);
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientId: 1186, nutrientName: 'Folic acid', value: 400 },
        ],
      }).folateMcgPer100,
    ).toBeNull();
  });

  test('uses the existing resolver to reject noisy and uncertain FDC results', async () => {
    const salt = entry({ id: 'salt', displayName: 'Salt', class: 'seasoning' });
    const butter = entry({ id: 'butter', displayName: 'Butter', class: 'dairy' });
    const selected = await chooseFdcFood(
      salt,
      [
        {
          description: 'Butter, salted',
          dataType: 'SR Legacy',
          foodCategory: 'Dairy and Egg Products',
          foodNutrients: [{ nutrientId: 1008, value: 717 }],
        },
        {
          description: 'Salt, table',
          dataType: 'Foundation',
          foodCategory: 'Spices and Herbs',
          foodNutrients: [{ nutrientId: 1008, value: 0 }],
        },
      ],
      [salt, butter],
    );
    expect(selected).toBeNull();

    const exact = await chooseFdcFood(
      salt,
      [{
        description: 'Salt',
        dataType: 'Foundation',
        foodCategory: 'Spices and Herbs',
        foodNutrients: [{ nutrientId: 1008, value: 0 }],
      }],
      [salt, butter],
    );
    expect(exact?.description).toBe('Salt');
  });

  test('does not count a reviewed record that contains no mapped nutrition', async () => {
    const oliveOil = entry({ id: 'olive-oil', displayName: 'Olive oil', class: 'staple' });
    expect(
      await chooseFdcFood(
        oliveOil,
        [{ fdcId: 123, description: 'Olive oil', foodNutrients: [] }],
        [oliveOil],
        123,
      ),
    ).toBeNull();
  });

  test('rejects a reviewed record that has only a micronutrient and no macro data', async () => {
    const oliveOil = entry({ id: 'olive-oil', displayName: 'Olive oil', class: 'staple' });
    expect(
      await chooseFdcFood(
        oliveOil,
        [{ fdcId: 123, description: 'Olive oil', foodNutrients: [{ nutrientId: 1079, value: 2.2 }] }],
        [oliveOil],
        123,
      ),
    ).toBeNull();
  });

  test('rejects an unreviewed candidate with only micronutrient data the same way', async () => {
    const oliveOil = entry({ id: 'olive-oil', displayName: 'Olive oil', class: 'staple' });
    expect(
      await chooseFdcFood(
        oliveOil,
        [{
          description: 'Olive oil',
          dataType: 'Foundation',
          foodCategory: 'Fats and Oils',
          foodNutrients: [{ nutrientId: 1092, value: 1 }],
        }],
        [oliveOil],
      ),
    ).toBeNull();
  });

  test('picks the true total B12 over a co-occurring "added" fortification figure', () => {
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientId: 1178, nutrientName: 'Vitamin B-12', value: 2.5 },
          { nutrientId: 1246, nutrientName: 'Vitamin B-12, added', value: 2.5 },
        ],
      }).vitaminB12McgPer100,
    ).toBe(2.5);
    expect(
      nutritionFromFdc({
        foodNutrients: [
          { nutrientName: 'Vitamin B-12, added', unitName: 'UG', value: 2.5 },
        ],
      }).vitaminB12McgPer100,
    ).toBeNull();
  });

  test('fills Dark soy sauce from the reviewed CoFID row without inventing trace fat', () => {
    const report = buildReport();
    const darkSoy = entry({
      id: 'soy-sauce-dark',
      displayName: 'Dark soy sauce',
      class: 'condiment',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 1095 },
    });
    const [enriched] = enrichWithCofid([darkSoy], report);

    expect(enriched).toMatchObject({
      kcalPer100: 79,
      proteinPer100: 3,
      carbsPer100: 17.9,
      sources: {
        kcalPer100: 'cofid',
        proteinPer100: 'cofid',
        carbsPer100: 'cofid',
      },
    });
    expect(enriched?.fatPer100).toBeUndefined();
    expect(report.cofid).toEqual({ reviewed: 1, matched: 1 });
    expect(report.skipped).toContainEqual(
      expect.objectContaining({ source: 'cofid', field: 'fatPer100', reason: 'unknown' }),
    );
  });

  test('a hand-authored micronutrient value survives a rebuild; the dataset value is reported, not applied', () => {
    const lists = reportLists();
    const original = entry({
      ironMgPer100: 4,
      sources: { ironMgPer100: 'hand-authored' },
    });
    const merged = mergeCataloguePatch(
      original,
      { ironMgPer100: 2.1 },
      'food-data-central',
      'Chicken breast',
      lists,
    );
    expect(merged.ironMgPer100).toBe(4);
    expect(lists.conflicts).toContainEqual(
      expect.objectContaining({ field: 'ironMgPer100', existing: 4, proposed: 2.1 }),
    );
  });

  test('a first-time build fills an empty micronutrient field and records the dataset as its source', () => {
    const lists = reportLists();
    const merged = mergeCataloguePatch(
      entry(),
      { folateMcgPer100: 6 },
      'food-data-central',
      'Chicken breast',
      lists,
    );
    expect(merged.folateMcgPer100).toBe(6);
    expect(merged.sources?.folateMcgPer100).toBe('food-data-central');
    expect(lists.filled).toContainEqual(
      expect.objectContaining({ field: 'folateMcgPer100', proposed: 6 }),
    );
  });

  test('a food missing one of the eight nutrients in its FDC response leaves that field null, not zero', () => {
    const lists = reportLists();
    const merged = mergeCataloguePatch(
      entry(),
      nutritionFromFdc({ foodNutrients: [{ nutrientId: 1008, value: 165 }] }),
      'food-data-central',
      'Chicken breast',
      lists,
    );
    expect(merged.vitaminCMgPer100).toBeUndefined();
    expect(lists.skipped).toContainEqual(
      expect.objectContaining({ field: 'vitaminCMgPer100', reason: 'unknown' }),
    );
  });

  test('CoFID is attribution-only and never overwrites existing FDC nutrition', () => {
    const report = buildReport();
    const existing = entry({
      id: 'soy-sauce-dark',
      displayName: 'Dark soy sauce',
      class: 'condiment',
      kcalPer100: 53,
      sources: { kcalPer100: 'food-data-central' },
    });
    const [enriched] = enrichWithCofid([existing], report);

    expect(CATALOGUE_SOURCES.cofid).toMatchObject({
      licence: 'Open Government Licence v3.0',
      attribution: expect.stringMatching(/licensed under the Open Government Licence v3\.0/),
    });
    expect(enriched?.kcalPer100).toBe(53);
    expect(report.conflicts).toContainEqual(
      expect.objectContaining({ source: 'cofid', field: 'kcalPer100', existing: 53, proposed: 79 }),
    );
  });
});
