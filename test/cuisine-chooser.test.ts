import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { cuisineFilters, cuisineId, isReleaseCuisine, recipeHasCuisine, RELEASE_CUISINE_IDS } from '@/logic/cuisines';
import { catalogueForMealType, PLANNER_CATALOGUE } from '@/logic/plannerCatalogue';
import { reviewPlannerRecipe } from '@/logic/plannerRecipe';
import type { ExclusionSet } from '@/logic/dietary';
import type { PlannerRecipeSnapshot } from '@/types';

const read = (path: string) => readFileSync(path, 'utf8');

const picker = read('app/plan/picker.tsx');
const rail = read('src/components/planner/CuisineRail.tsx');
const row = read('src/components/planner/RecipeChoiceRow.tsx');
const preview = read('app/plan/recipe.tsx');
const agenda = read('src/components/planner/PlannerAgenda.tsx');

/* -------------------------------------------------------------------------- */
/* 5.1 The chooser knows its destination                                      */
/* -------------------------------------------------------------------------- */

describe('the chooser follows the meal type actually selected', () => {
  test('heading, results, preview action and preview route all read one value', () => {
    // `selectedMealType`, not the route's original `mealType`, everywhere.
    expect(picker).toContain('Choose {slotPhrase(date, selectedMealType)}');
    expect(picker).toContain('catalogueForMealType(selectedMealType)');
    expect(picker).toContain('const previewLabel = `Preview for ${MEAL_TYPE_LABEL[selectedMealType].toLowerCase()}`');
    expect(picker).toContain('mealType: selectedMealType');
  });

  test('replacing is locked to the slot it started from', () => {
    expect(picker).toContain('const selectedMealType = replaceSlotId ? slotMealType : mealType;');
    expect(picker).toContain('use Move on the meal itself');
    // The originating slot id travels with the replace request.
    expect(agenda).toContain('onReplaceRecipe(resolved.slot.localDate, resolved.slot.mealType, resolved.slot.id)');
    expect(read('src/components/planner/PlannerHome.tsx'))
      .toContain('params: { date: localDate, mealType, replaceSlotId }');
  });

  test('the picker keeps its own state, so Back from a preview restores it', () => {
    // Query, cuisine, meal type and the saved list are component state on a
    // screen the preview is pushed on top of — nothing is passed out and read
    // back, so returning cannot lose them.
    expect(picker).toContain("const [query, setQuery] = useState('')");
    expect(picker).toContain('const [cuisine, setCuisine] = useState<string | null>(null)');
    expect(picker).toContain("router.push({");
    expect(picker).not.toContain('router.replace(');
  });
});

/* -------------------------------------------------------------------------- */
/* 5.2 Cuisine identity and filter scope                                      */
/* -------------------------------------------------------------------------- */

describe('cuisine ids map to the labels recipes actually record', () => {
  test('the release vocabulary is exactly the cuisines the collection holds', () => {
    const filters = cuisineFilters();
    expect(filters.map((entry) => entry.id)).toEqual([...RELEASE_CUISINE_IDS]);
    expect(filters.map((entry) => entry.label)).toEqual([
      'Chinese', 'Japanese', 'Korean', 'Italian', 'Mediterranean', 'International',
    ]);
    // Korean is here because nine reviewed recipes carry the label, not
    // because the concept art drew a tile for it.
    expect(isReleaseCuisine('korean')).toBe(true);
    // Nothing the concept art showed but the collection does not have.
    for (const absent of ['thai', 'vietnamese']) {
      expect(filters.some((entry) => entry.id === absent)).toBe(false);
      expect(isReleaseCuisine(absent)).toBe(false);
    }
  });

  test('every count is a real recipe count', () => {
    for (const filter of cuisineFilters()) {
      const actual = PLANNER_CATALOGUE.filter((recipe) => recipeHasCuisine(recipe, filter.id)).length;
      expect(filter.count).toBe(actual);
      expect(actual).toBeGreaterThan(0);
    }
  });

  test('an unfamiliar label still gets a stable id rather than being dropped', () => {
    expect(cuisineId('Chinese')).toBe('chinese');
    expect(cuisineId(' Mediterranean ')).toBe('mediterranean');
    expect(cuisineId('Modern Australian')).toBe('modern-australian');
    expect(isReleaseCuisine('modern-australian')).toBe(false);
  });

  test('a cuisine and meal-type combination with no recipes is a real state', () => {
    // Japanese has no dinner in the reviewed collection, and the chooser has to
    // say so rather than show an empty list.
    const japaneseDinner = catalogueForMealType('dinner')
      .filter((recipe) => recipeHasCuisine(recipe, 'japanese'));
    const japaneseLunch = catalogueForMealType('lunch')
      .filter((recipe) => recipeHasCuisine(recipe, 'japanese'));
    expect(japaneseLunch.length + japaneseDinner.length).toBeGreaterThan(0);
    expect(picker).toContain('function emptyExplanation');
    expect(picker).toContain('is available for ${meal}');
  });

  test('saved recipes are excluded from a cuisine filter, not disguised as matches', () => {
    expect(picker).toContain('const savedMatches = useMemo(() => cuisine !== null ? [] : saved');
    expect(picker).toContain('do not record a cuisine');
    expect(picker).toContain('accessibilityLabel="Show saved recipes"');
    // Clearing the cuisine keeps the search and the target date.
    expect(picker).toContain('onPress={() => setCuisine(null)}');
  });

  test('clearing filters keeps the date and the meal slot', () => {
    expect(picker).toContain("onPress={() => { setQuery(''); setCuisine(null); }}");
    expect(picker).toContain('You are still choosing {slotPhrase(date, selectedMealType)}. Nothing has been scheduled.');
    expect(picker).toContain('accessibilityHint="Keeps the date and meal you are choosing for"');
  });

  test('a failed saved-recipe read is distinct from an empty collection', () => {
    expect(picker).toContain("const [savedState, setSavedState] = useState<'loading' | 'ready' | 'error'>('loading')");
    expect(picker).toContain('Your saved recipes could not be read');
    expect(picker).toContain('This is a read failure, not an empty collection');
    expect(picker).toContain('label="Retry"');
    expect(picker).toContain('Reading your saved recipes…');
    expect(picker).toContain('Recipes you save from Pantry appear here too.');
  });
});

/* -------------------------------------------------------------------------- */
/* 5.3 The illustrated rail                                                   */
/* -------------------------------------------------------------------------- */

describe('the cuisine rail stays native and labelled', () => {
  test('labels are text outside the artwork, and announce selection', () => {
    expect(rail).toContain('accessibilityRole="tablist"');
    expect(rail).toContain('accessibilityRole="tab"');
    expect(rail).toContain('accessibilityState={{ selected }}');
    expect(rail).toContain('accessibilityLabel={label}');
    // The painting itself is decorative; it must not announce the label twice.
    expect(rail).toContain('accessibilityElementsHidden');
    expect(rail).toContain('importantForAccessibility="no-hide-descendants"');
  });

  test('All is a drawn control, not a generated image', () => {
    expect(rail).toContain('function BowlGlyph');
    expect(rail).toContain("from 'react-native-svg'");
    expect(rail).not.toMatch(/require\(["'].*assets\//);
  });

  test('selection is carried by a ring and a label, not by colour alone', () => {
    expect(rail).toContain('frameSelected');
    expect(rail).toContain('borderWidth: 3');
    expect(rail).toContain('labelSelected');
  });

  test('overflow is operable without a precise gesture', () => {
    expect(rail).toContain('accessibilityLabel="More cuisines"');
    expect(rail).toContain('scroller.current?.scrollTo');
    // The button appears exactly when the rail actually overflows.
    expect(rail).toContain('setOverflowing(width > viewport.current + 1)');
  });

  test('a failed image costs the picture and nothing else', () => {
    expect(rail).toContain('onArtworkError');
    expect(rail).toContain('setFailed((current) => new Set([...current, cuisine.id]))');
    expect(rail).toContain('label.slice(0, 1).toUpperCase()');
    // And the registry is not the source of truth for which cuisines exist.
    const registry = read('src/media/cuisineIllustrations.ts');
    expect(registry).not.toContain('PLANNER_CATALOGUE');
    expect(read('src/logic/cuisines.ts')).not.toContain('cuisineIllustration');
  });
});

/* -------------------------------------------------------------------------- */
/* 5.4 Recipe rows                                                            */
/* -------------------------------------------------------------------------- */

describe('recipe rows preview rather than schedule', () => {
  test('the action is labelled Preview and names the meal', () => {
    expect(row).toContain('actionLabel');
    expect(picker).toContain('`Preview for ${MEAL_TYPE_LABEL[selectedMealType].toLowerCase()}`');
    // The concept's direct add would bypass every check the preview runs.
    expect(picker).not.toContain('Add to today');
    expect(row).not.toContain('Add to');
  });

  test('the heading is honest about what the collection can do', () => {
    expect(picker).toContain('Recipes for your plan');
    expect(picker).not.toContain('Recommended for your week');
    expect(picker).not.toMatch(/chosen for you|recommended|tasty ideas/i);
  });

  test('a cuisine label sets its own width rather than breaking mid-word', () => {
    expect(rail).toContain('minWidth: TILE');
    expect(rail).not.toContain('maxWidth');
  });

  test('thumbnails are substantial and names are never cropped to fit them', () => {
    expect(row).toContain('const THUMBNAIL = 96');
    expect(row).toContain('<RowTitle>{title}</RowTitle>');
    expect(row).not.toContain('numberOfLines');
  });

  test('metadata is assembled from recorded facts', () => {
    expect(picker).toContain('function catalogueMeta');
    expect(picker).toContain('${recipe.durationMinutes} min');
    expect(picker).toContain('makes ${recipe.baseYield}');
    expect(picker).toContain("isNoCook(recipe) ? 'no cooking' : recipe.cuisines[0]");
  });

  test('final scheduling still happens in the preview, after its checks', () => {
    expect(preview).toContain('label={`Add to ${slotPhrase(date, mealType)}`}');
    expect(preview).toContain('isOccupied(draft, date, mealType)');
    expect(preview).toContain('Batch makes');
    expect(preview).toContain('Your portion');
  });
});

/* -------------------------------------------------------------------------- */
/* 5.5 Eligibility, conflicts and cancellation                                */
/* -------------------------------------------------------------------------- */

const emptyExclusions: ExclusionSet = { canonicalIds: new Set(), unresolvedText: new Set() };

function snapshot(overrides: Partial<PlannerRecipeSnapshot> = {}): PlannerRecipeSnapshot {
  return {
    id: 'snap', sourceKind: 'starter', sourceId: 'planner-ginger-chicken-bok-choy',
    sourceVersion: '1', title: 'Ginger chicken', mealTypes: ['dinner'], cuisines: ['Chinese'],
    baseYield: 4, durationMinutes: 30, requiredAppliances: ['cooktop'],
    ingredients: [
      {
        id: 'i1', canonicalId: 'chicken-breast', name: 'Chicken breast', quantity: 600, unit: 'g',
        preparation: 'raw', optional: false, included: true,
        nutrition: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
      },
    ],
    steps: [{ stepNumber: 1, instruction: 'Cook it.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: null }],
    nutritionPerPortion: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
    createdAt: '2026-09-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('a recipe is reviewed before it is scheduled', () => {
  test('a recorded exclusion is named, and the recipe is not silently dropped', () => {
    const review = reviewPlannerRecipe({
      recipe: snapshot(),
      exclusions: { canonicalIds: new Set(['chicken-breast']), unresolvedText: new Set() },
      ownedApplianceIds: new Set(['cooktop']),
    });
    expect(review.excluded).toEqual([{ name: 'Chicken breast', canonicalId: 'chicken-breast' }]);
    expect(review.missingAppliances).toEqual([]);
    // The preview asks before overriding it, rather than either hiding the
    // recipe or scheduling it without saying anything.
    expect(preview).toContain('This conflicts with your dietary profile');
    expect(preview).toContain("text: 'Schedule anyway'");
    expect(preview).toContain('Nothing has been scheduled yet.');
  });

  test('an unresolved ingredient is marked unverified, never assumed compatible', () => {
    const review = reviewPlannerRecipe({
      recipe: snapshot({
        ingredients: [{
          id: 'i1', canonicalId: null, name: 'Grandma\'s sauce', quantity: null, unit: null,
          preparation: null, optional: false, included: true,
          nutrition: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
        }],
      }),
      exclusions: { canonicalIds: new Set(['peanut']), unresolvedText: new Set() },
      ownedApplianceIds: new Set(['cooktop']),
    });
    expect(review.excluded).toEqual([]);
    expect(review.unverified).toEqual(["Grandma's sauce"]);
    expect(preview).toContain('Not checked against your dietary rules');
  });

  test('a name-only rule still excludes an ingredient it names', () => {
    const review = reviewPlannerRecipe({
      recipe: snapshot({
        ingredients: [{
          id: 'i1', canonicalId: null, name: 'Belacan', quantity: null, unit: null,
          preparation: null, optional: false, included: true,
          nutrition: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
        }],
      }),
      exclusions: { canonicalIds: new Set(), unresolvedText: new Set(['belacan']) },
      ownedApplianceIds: null,
    });
    expect(review.excluded.map((item) => item.name)).toEqual(['Belacan']);
  });

  test('equipment is only claimed missing once ownership has been recorded', () => {
    const unknown = reviewPlannerRecipe({
      recipe: snapshot(), exclusions: emptyExclusions, ownedApplianceIds: null,
    });
    expect(unknown.applianceOwnershipKnown).toBe(false);
    expect(unknown.missingAppliances).toEqual([]);

    const recorded = reviewPlannerRecipe({
      recipe: snapshot(), exclusions: emptyExclusions, ownedApplianceIds: new Set(['oven']),
    });
    expect(recorded.applianceOwnershipKnown).toBe(true);
    expect(recorded.missingAppliances).toEqual(['cooktop']);
    expect(preview).toContain('Needs equipment you have not recorded');
  });

  test('excluded ingredients that were removed from the recipe stop counting', () => {
    const review = reviewPlannerRecipe({
      recipe: snapshot({
        ingredients: [{
          id: 'i1', canonicalId: 'chicken-breast', name: 'Chicken breast', quantity: 600, unit: 'g',
          preparation: 'raw', optional: true, included: false,
          nutrition: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
        }],
      }),
      exclusions: { canonicalIds: new Set(['chicken-breast']), unresolvedText: new Set() },
      ownedApplianceIds: new Set(['cooktop']),
    });
    expect(review.excluded).toEqual([]);
  });

  test('local recipes need no API key and no pantry stock', () => {
    for (const forbidden of ['listPantryItems', 'coverageForRecipe', 'onHand', 'missingIngredients', 'hasApiKey']) {
      expect(picker, forbidden).not.toContain(forbidden);
    }
    expect(PLANNER_CATALOGUE.length).toBeGreaterThan(0);
    for (const mealType of ['breakfast', 'lunch', 'dinner'] as const) {
      expect(catalogueForMealType(mealType).length).toBeGreaterThanOrEqual(3);
    }
  });

  test('browsing and cancelling write nothing at all', () => {
    for (const forbidden of ['insertMeal', 'addMeal(', 'depleteForMeal', 'savePlanGroceries', 'updateDraft', 'saveMealSchedule']) {
      expect(picker, forbidden).not.toContain(forbidden);
    }
    // The only write on the preview is the commit behind the confirmed action.
    expect(preview).toContain('const ok = await commit(next,');
    expect(preview).toContain('label="Back to recipes"');
  });

  test('an occupied slot asks before it is replaced', () => {
    expect(preview).toContain('Replace ${slotPhrase(date, mealType)}?');
    expect(preview).toContain("{ text: 'Cancel', style: 'cancel'");
    expect(preview).toContain("text: 'Replace', style: 'destructive'");
  });
});
