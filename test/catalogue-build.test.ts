import { describe, expect, test } from 'vitest';

import {
  chooseFdcFood,
  durationToDays,
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
    });
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
});
