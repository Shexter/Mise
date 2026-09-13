import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  applyPlanGroceries,
  getActivePlanGroceryApplication,
  listPantryItems,
  listShoppingItems,
  loadSeedData,
  getMealScheduleForWeek,
  saveMealSchedule,
  undoPlanGroceries,
} from '@/db/queries';
import { buildPlanGroceryDemand } from '@/logic/plannerGroceries';
import { useCaptureStore } from '@/store/captureStore';
import { PlannerConflictError } from '@/logic/plannerSchedule';
import {
  addRecipeToSlot,
  batchCapacity,
  copyAsNewBatch,
  copyFromSameBatch,
  dayIsComplete,
  moveSlotTo,
  nextUpcomingSlot,
  removeSlot,
  setEatenPortions,
  setProducedPortions,
  setSlotStatus,
  slotsForDate,
  weekSummary,
} from '@/components/planner/model';
import type { PlanGroceryDemand, PlannerDraft, PlannerRecipeSnapshot } from '@/types';
import { closeTestDatabase, openTestDatabase } from './stubs/db';

const read = (path: string) => readFileSync(path, 'utf8');

const snapshot = (id: string, title: string, baseYield = 4): PlannerRecipeSnapshot => ({
  id, sourceKind: 'starter', sourceId: `src-${id}`, sourceVersion: '1',
  title, mealTypes: ['lunch', 'dinner'], cuisines: ['Chinese'], baseYield,
  durationMinutes: 30, requiredAppliances: ['cooktop'],
  ingredients: [{
    id: `${id}-ing`, canonicalId: 'chicken-breast', name: 'Chicken breast',
    quantity: 600, unit: 'g', preparation: 'raw', optional: false, included: true,
    nutrition: { calories: 636, proteinG: 135, carbsG: 0, fatG: 12, fibreG: null, source: 'canonical_catalogue' },
  }],
  steps: [{ stepNumber: 1, instruction: 'Cook it.', applianceId: 'cooktop', actionType: 'cook' }],
  nutritionPerPortion: { calories: 159, proteinG: 33.8, carbsG: 0, fatG: 3, fibreG: null, source: 'canonical_catalogue' },
  createdAt: '2026-09-07T00:00:00.000Z',
});

const emptyDraft = (): PlannerDraft => ({
  scheduleId: 'schedule', weekStart: '2026-09-07', baseRevision: 1,
  slots: [], batches: [], snapshots: [],
});

let counter = 0;
const ids = () => `id-${++counter}`;

function withMeal(date = '2026-09-07', mealType: 'breakfast' | 'lunch' | 'dinner' = 'lunch') {
  counter = 0;
  return addRecipeToSlot(emptyDraft(), {
    snapshot: snapshot('snap', 'Ginger chicken'),
    localDate: date, mealType, eatenPortions: 1, producedPortions: 4, makeId: ids,
  });
}

describe('planner editing rules', () => {
  test('scheduling a recipe creates its own batch and snapshot copy', () => {
    const draft = withMeal();
    expect(draft.slots).toHaveLength(1);
    expect(draft.batches).toHaveLength(1);
    // The snapshot is copied, not shared, so editing the collection later cannot
    // rewrite a saved week.
    expect(draft.snapshots[0]!.id).not.toBe('snap');
    expect(draft.snapshots[0]!.ingredients[0]!.id).not.toBe('snap-ing');
    expect(draft.snapshots[0]!.title).toBe('Ginger chicken');
  });

  test('an occupied slot refuses to be overwritten without explicit replacement', () => {
    const draft = withMeal();
    expect(() => addRecipeToSlot(draft, {
      snapshot: snapshot('other', 'Something else'),
      localDate: '2026-09-07', mealType: 'lunch', eatenPortions: 1, producedPortions: 2, makeId: ids,
    })).toThrow(PlannerConflictError);

    const replaced = addRecipeToSlot(draft, {
      snapshot: snapshot('other', 'Something else'),
      localDate: '2026-09-07', mealType: 'lunch', eatenPortions: 1, producedPortions: 2,
      replace: true, makeId: ids,
    });
    expect(replaced.slots).toHaveLength(1);
    // Replacing drops the old batch too, so its ingredients leave the list.
    expect(replaced.batches).toHaveLength(1);
    expect(replaced.snapshots).toHaveLength(1);
    expect(replaced.snapshots[0]!.title).toBe('Something else');
  });

  test('moving keeps the same batch and the same date rules as adding', () => {
    const draft = withMeal();
    const slotId = draft.slots[0]!.id;
    const moved = moveSlotTo(draft, { slotId, localDate: '2026-09-09', mealType: 'dinner' });
    expect(moved.slots[0]!.localDate).toBe('2026-09-09');
    expect(moved.slots[0]!.batchId).toBe(draft.slots[0]!.batchId);
  });

  test('leftovers reuse the batch; cooking again does not', () => {
    const draft = withMeal();
    const slotId = draft.slots[0]!.id;

    const leftovers = copyFromSameBatch(draft, { slotId, localDate: '2026-09-08', mealType: 'lunch', makeId: ids });
    expect(leftovers.batches).toHaveLength(1);
    expect(leftovers.slots).toHaveLength(2);
    expect(leftovers.slots[1]!.batchId).toBe(draft.slots[0]!.batchId);

    const again = copyAsNewBatch(draft, { slotId, localDate: '2026-09-08', mealType: 'lunch', makeId: ids });
    expect(again.batches).toHaveLength(2);
  });

  test('a batch cannot promise more portions than it makes', () => {
    let draft = withMeal();
    const slotId = draft.slots[0]!.id;
    const batchId = draft.batches[0]!.id;
    expect(batchCapacity(draft, batchId)).toEqual({ produced: 4, allocated: 1, remaining: 3 });

    for (const date of ['2026-09-08', '2026-09-09', '2026-09-10']) {
      draft = copyFromSameBatch(draft, { slotId, localDate: date, mealType: 'lunch', makeId: ids });
    }
    expect(batchCapacity(draft, batchId).remaining).toBe(0);
    expect(() => copyFromSameBatch(draft, { slotId, localDate: '2026-09-11', mealType: 'lunch', makeId: ids }))
      .toThrow(/exceed batch production/);
    expect(() => setProducedPortions(draft, batchId, 2)).toThrow(/exceed batch production/);
  });

  test('leftovers cannot be eaten before the batch is cooked', () => {
    const draft = withMeal('2026-09-09');
    expect(() => copyFromSameBatch(draft, {
      slotId: draft.slots[0]!.id, localDate: '2026-09-08', mealType: 'lunch', makeId: ids,
    })).toThrow(/before the batch is cooked/);
  });

  test('skipping keeps the meal visible and returns its portions to the batch', () => {
    const draft = withMeal();
    const slotId = draft.slots[0]!.id;
    const skipped = setSlotStatus(draft, slotId, 'skipped');
    expect(skipped.slots[0]!.status).toBe('skipped');
    expect(skipped.slots).toHaveLength(1);
    expect(batchCapacity(skipped, draft.batches[0]!.id).allocated).toBe(0);
  });

  test('removing the last slot of a batch removes its groceries too', () => {
    const draft = withMeal();
    const removed = removeSlot(draft, draft.slots[0]!.id);
    expect(removed.slots).toHaveLength(0);
    expect(removed.batches).toHaveLength(0);
    expect(removed.snapshots).toHaveLength(0);
  });

  test('removing one of two sharers keeps the batch for the other', () => {
    const draft = withMeal();
    const shared = copyFromSameBatch(draft, {
      slotId: draft.slots[0]!.id, localDate: '2026-09-08', mealType: 'lunch', makeId: ids,
    });
    const removed = removeSlot(shared, shared.slots[0]!.id);
    expect(removed.slots).toHaveLength(1);
    expect(removed.batches).toHaveLength(1);
  });

  test('portion changes are bounded by what the batch makes', () => {
    const draft = withMeal();
    expect(setEatenPortions(draft, draft.slots[0]!.id, 4).slots[0]!.eatenPortions).toBe(4);
    expect(() => setEatenPortions(draft, draft.slots[0]!.id, 5)).toThrow(/exceed batch production/);
    expect(() => setEatenPortions(draft, draft.slots[0]!.id, 0)).toThrow(/must be positive/);
  });

  test('the day view always exposes three slots, filled or not', () => {
    const day = slotsForDate(withMeal(), '2026-09-07');
    expect(day.entries.map((entry) => entry.mealType)).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(day.entries.filter((entry) => entry.resolved)).toHaveLength(1);
  });

  test('the next action follows status, and a finished day reports complete', () => {
    const draft = withMeal();
    expect(nextUpcomingSlot(draft, '2026-09-07')?.snapshot.title).toBe('Ginger chicken');
    expect(dayIsComplete(draft, '2026-09-07')).toBe(false);

    const logged = setSlotStatus(draft, draft.slots[0]!.id, 'logged');
    expect(nextUpcomingSlot(logged, '2026-09-07')).toBeNull();
    expect(dayIsComplete(logged, '2026-09-07')).toBe(true);

    // A day with nothing on it is not "complete" — it is unplanned.
    expect(dayIsComplete(logged, '2026-09-10')).toBe(false);
  });

  test('a partial week is a valid week', () => {
    expect(weekSummary(emptyDraft())).toMatchObject({ scheduledSlots: 0, empty: true });
    expect(weekSummary(withMeal())).toMatchObject({ scheduledSlots: 1, filledDays: 1, empty: false });
  });
});

describe('applied grocery revision is readable after a restart', () => {
  beforeEach(async () => {
    openTestDatabase();
    // The shopping row references a real catalogue ingredient, so the seed has
    // to be present for this to exercise the actual foreign keys.
    await loadSeedData();
  });
  afterEach(() => closeTestDatabase());

  const demand: PlanGroceryDemand = {
    key: 'canonical:chicken-breast:g:0', canonicalId: 'chicken-breast', displayName: 'Chicken breast',
    quantity: 600, unit: 'g', hasUnknownQuantity: false,
    contributions: [{
      sourceKey: 'batch:ing', batchId: 'batch', snapshotIngredientId: 'ing',
      canonicalId: 'chicken-breast', displayName: 'Chicken breast', quantity: 600, unit: 'g',
    }],
  };

  const persisted = async () => saveMealSchedule({
    scheduleId: null, weekStart: '2026-09-07', baseRevision: null,
    snapshots: [snapshot('snap', 'Ginger chicken')],
    batches: [{ id: 'batch', scheduleId: '', snapshotId: 'snap', cookDate: '2026-09-07', producedPortions: 4, linkedFirstMealId: null }],
    slots: [{ id: 'slot', scheduleId: '', localDate: '2026-09-07', mealType: 'lunch', batchId: 'batch', eatenPortions: 1, status: 'planned', linkedMealId: null }],
  });

  test('reports nothing applied, then the standing revision, then nothing after undo', async () => {
    const schedule = await persisted();
    expect(await getActivePlanGroceryApplication(schedule.id)).toBeNull();

    const applicationId = await applyPlanGroceries(schedule.id, schedule.revision, [demand]);
    const active = await getActivePlanGroceryApplication(schedule.id);
    expect(active).toMatchObject({ id: applicationId, scheduleRevision: schedule.revision });
    // The revision key is what lets Shop tell "still current" from "plan changed".
    expect(active?.revisionKey).toContain(schedule.id);

    await undoPlanGroceries(applicationId);
    expect(await getActivePlanGroceryApplication(schedule.id)).toBeNull();
  });
});

describe('planner surfaces keep the app they were added to', () => {
  const today = read('app/(tabs)/index.tsx');
  const tabs = read('app/(tabs)/_layout.tsx');
  const picker = read('app/plan/picker.tsx');
  const guide = read('app/plan/meal.tsx');
  const review = read('app/review.tsx');
  const capture = read('src/store/captureStore.ts');
  const home = read('src/components/planner/PlannerHome.tsx');

  test('four destinations and the shared Add survive', () => {
    const destinations = [...tabs.matchAll(/name="([a-z]+)"/g)].map((match) => match[1]);
    expect(new Set(destinations)).toEqual(new Set(['index', 'pantry', 'shop', 'settings']));
    // No planner tab, and no second floating action.
    expect(tabs).not.toMatch(/name="plan"/);
    expect(home).not.toMatch(/Fab|FloatingAction/);
  });

  test('the dinner fallback is one tap from Today', () => {
    expect(home).toContain("router.push('/dinner')");
    expect(home).toContain("What's for dinner?");
  });

  test('Today still shows fibre and actual nutrition, now as its own task page', () => {
    const calories = read('src/components/today/CaloriesPage.tsx');
    expect(calories).toContain('DailyTargetSummary');
    expect(calories).toContain('dailyNutritionSummary');
    // Decision 201 replaced the single scroll with two pages. The nutrient
    // summaries lead Calories; no planner content precedes them.
    expect(calories).not.toContain('PlannerHome');
    expect(calories.indexOf('styles.hero')).toBeLessThan(calories.indexOf('<DayRail'));
    expect(calories.indexOf('<DailyTargetSummary')).toBeLessThan(calories.indexOf('styles.banner'));
    expect(today).toContain('<TodayTaskSelector');
    // The labels are exactly these two, and the second is never "Nutrition".
    const selector = read('src/components/today/TodayTaskSelector.tsx');
    expect(selector).toContain("'Meal plan'");
    expect(selector).toContain("'Calories'");
    expect(selector).not.toContain("'Nutrition'");
  });

  test('the picker never gates on pantry stock', () => {
    for (const forbidden of ['listPantryItems', 'coverageForRecipe', 'onHand', 'missingIngredients']) {
      expect(picker).not.toContain(forbidden);
    }
    expect(picker).toContain("Mise works out what to buy");
  });

  test('opening a cooking guide writes nothing on its own', () => {
    for (const forbidden of ['insertMeal', 'addMeal(', 'depleteForMeal', 'applyDepletion', 'savePlanGroceries']) {
      expect(guide).not.toContain(forbidden);
    }
    // The only write path is the ordinary review screen.
    expect(guide).toContain("router.push('/review')");
    expect(guide).toContain('setPlannedMealDraft');
  });

  test('review keeps its ordinary save and adds the planner one beside it', () => {
    expect(review).toContain('await addMeal(meal)');
    expect(review).toContain('insertPlannedMeal');
    expect(review).toContain('plannerCommit');
    // Backward compatible: the pre-existing handoff is untouched.
    expect(capture).toContain('setMealDraft');
    expect(capture).toContain('setPlannedMealDraft');
    expect(read('app/recipe/[id].tsx')).toContain('setMealDraft');
  });

  test('planner components carry no literal colours or hard-coded touch targets', () => {
    const files = [
      'src/components/planner/MealSlotRow.tsx',
      'src/components/planner/PlannerAgenda.tsx',
      'src/components/planner/PlannerHome.tsx',
      'src/components/planner/PlanGrocerySection.tsx',
      'src/components/planner/SlotActionSheet.tsx',
      'src/components/planner/SlotDestinationSheet.tsx',
      'src/components/planner/PortionSheet.tsx',
      'src/components/planner/BatchSheet.tsx',
      'src/components/planner/WeekDayRail.tsx',
      'app/plan/picker.tsx',
      'app/plan/recipe.tsx',
      'app/plan/meal.tsx',
    ];
    for (const file of files) {
      const source = read(file);
      expect(source, `${file} uses a literal colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source, `${file} hard-codes a touch target`).not.toMatch(/minHeight:\s*4[48]\b/);
    }
  });

  test('every planner route is registered', () => {
    const layout = read('app/_layout.tsx');
    for (const route of ['plan/picker', 'plan/recipe', 'plan/meal']) {
      expect(layout).toContain(`name="${route}"`);
    }
  });

  test('drag has a labelled equivalent and respects reduced motion', () => {
    const drag = read('src/components/planner/DraggableSlot.tsx');
    expect(drag).toContain('useReducedMotion');
    expect(drag).toContain('activateAfterLongPress');
    // Hovering marks a day; it never commits the move.
    expect(drag).toContain('onHover');
    const actions = read('src/components/planner/SlotActionSheet.tsx');
    for (const label of ['Move to…', 'Cook another batch', 'Use portions from this batch', 'Replace…', 'Skip', 'Remove']) {
      expect(actions).toContain(label);
    }
  });

  test('onboarding offers planning first and persists before the handoff', () => {
    const welcome = read('app/onboarding/welcome.tsx');
    expect(welcome.indexOf('Plan my meals')).toBeLessThan(welcome.indexOf('Set my calorie & macro target'));
    expect(welcome).toContain("useState<OnboardingIntent>('meal_prep')");

    const first = read('app/onboarding/first-schedule.tsx');
    // Saved before either bridge is offered.
    expect(first.indexOf('await save();')).toBeLessThan(first.indexOf('const onSeeWeek'));
    expect(first).toContain('Skip for now');
    expect(first).toContain('Set up daily calorie target');
    // Recipes come before pantry capture in the branch.
    expect(read('app/onboarding/appliances.tsx')).toContain("/onboarding/first-schedule");
  });

  test('the pantry prompt points at the shared planner rather than a second plan store', () => {
    const pantry = read('app/(tabs)/pantry.tsx');
    expect(pantry).toContain('Plan your meals on Today');
    expect(pantry).not.toContain("router.push('/onboarding/appliances')");
  });
});

describe('the planner never depends on the pantry', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });
  afterEach(() => closeTestDatabase());

  test('a week can be planned, costed and applied with an empty pantry', async () => {
    // Nothing is in stock. This is the ordinary case the design is built for.
    expect(await listPantryItems()).toHaveLength(0);

    const planned = withMeal();
    const schedule = await saveMealSchedule({ ...planned, scheduleId: null, baseRevision: null });

    const demands = buildPlanGroceryDemand({
      batches: schedule.batches, snapshots: schedule.snapshots,
    });
    // Full demand, not reduced by anything the kitchen does or does not hold.
    expect(demands).toHaveLength(1);
    expect(demands[0]).toMatchObject({ canonicalId: 'chicken-breast', quantity: 600, unit: 'g' });

    await applyPlanGroceries(schedule.id, schedule.revision, demands);
    const shopping = await listShoppingItems(true);
    expect(shopping.some((item) => item.canonicalId === 'chicken-breast')).toBe(true);
    // Applying groceries is not a pantry write.
    expect(await listPantryItems()).toHaveLength(0);
  });

  test("the first scheduled meal survives a reload, which is what the handoff relies on", async () => {
    const planned = withMeal();
    await saveMealSchedule({ ...planned, scheduleId: null, baseRevision: null });

    // Reopening is the restart: the meal, its batch and its snapshot come back.
    const reopened = await getMealScheduleForWeek('2026-09-07');
    expect(reopened?.slots).toHaveLength(1);
    expect(reopened?.batches).toHaveLength(1);
    expect(reopened?.snapshots[0]?.title).toBe('Ginger chicken');
    expect(reopened?.slots[0]?.status).toBe('planned');
  });
});

describe('occupied destinations ask before they overwrite', () => {
  test('cancelling a replacement leaves the original draft untouched', () => {
    const draft = withMeal();
    const original = draft.slots[0]!;

    // The conflict is raised before anything is written, so the caller can ask.
    expect(() => addRecipeToSlot(draft, {
      snapshot: snapshot('other', 'Something else'),
      localDate: '2026-09-07', mealType: 'lunch', eatenPortions: 1, producedPortions: 2, makeId: ids,
    })).toThrow(PlannerConflictError);

    // "Cancel" is simply not calling again: the draft object is unchanged.
    expect(draft.slots).toHaveLength(1);
    expect(draft.slots[0]).toBe(original);
    expect(draft.snapshots[0]!.title).toBe('Ginger chicken');
  });

  test('a move onto an occupied slot needs the same explicit replacement', () => {
    let draft = withMeal('2026-09-07', 'lunch');
    draft = addRecipeToSlot(draft, {
      snapshot: snapshot('two', 'Second meal'),
      localDate: '2026-09-08', mealType: 'lunch', eatenPortions: 1, producedPortions: 2, makeId: ids,
    });
    const moving = draft.slots[0]!.id;
    expect(() => moveSlotTo(draft, { slotId: moving, localDate: '2026-09-08', mealType: 'lunch' }))
      .toThrow(PlannerConflictError);
    expect(draft.slots).toHaveLength(2);

    const replaced = moveSlotTo(draft, { slotId: moving, localDate: '2026-09-08', mealType: 'lunch', replace: true });
    expect(replaced.slots).toHaveLength(1);
    expect(replaced.slots[0]!.id).toBe(moving);
  });
});

describe('planner commit context is scoped to the planned save', () => {
  const meal = {
    loggedAt: '2026-09-07T12:00:00.000Z', localDate: '2026-09-07', mealType: 'lunch' as const,
    name: 'Ginger chicken', photoUri: null, source: 'recipe' as const, confidence: null,
    venue: 'home' as const, servingsMult: 1, items: [],
  };

  beforeEach(() => useCaptureStore.getState().clear());

  test('a planned draft carries its commit context', () => {
    useCaptureStore.getState().setPlannedMealDraft(meal, {
      slotId: 'slot', idempotencyKey: 'key', eatenPortions: 1, productionPortions: 4,
    });
    expect(useCaptureStore.getState().plannerCommit).toMatchObject({ slotId: 'slot', idempotencyKey: 'key' });
  });

  test('an ordinary draft clears it, so the next save cannot link the wrong slot', () => {
    useCaptureStore.getState().setPlannedMealDraft(meal, {
      slotId: 'slot', idempotencyKey: 'key', eatenPortions: 1, productionPortions: 4,
    });
    useCaptureStore.getState().setMealDraft(meal);
    expect(useCaptureStore.getState().plannerCommit).toBeNull();
    expect(useCaptureStore.getState().mealDraft).toEqual(meal);
  });

  test('a photo capture and an explicit clear both reset it', () => {
    useCaptureStore.getState().setPlannedMealDraft(meal, {
      slotId: 'slot', idempotencyKey: 'key', eatenPortions: 1, productionPortions: 4,
    });
    useCaptureStore.getState().set({ photoUri: 'file://photo.jpg' });
    expect(useCaptureStore.getState().plannerCommit).toBeNull();

    useCaptureStore.getState().setPlannedMealDraft(meal, {
      slotId: 'slot', idempotencyKey: 'key', eatenPortions: 1, productionPortions: 4,
    });
    useCaptureStore.getState().clear();
    expect(useCaptureStore.getState().plannerCommit).toBeNull();
    expect(useCaptureStore.getState().mealDraft).toBeNull();
  });
});

describe('cross-week date selection reloads the week', () => {
  test('Today reloads the planner when the selected date leaves the loaded week', () => {
    const plan = read('src/components/today/MealPlanPage.tsx');
    // One guard now, because the Meal plan page has one date navigator: the
    // week pager and the day rail both call it.
    expect(plan).toContain('selectPlannerDate');
    expect(plan).toContain('planner.load(localDate)');
    expect(plan).toContain('weekOf(localDate)[0]');
    expect(plan).toContain('onSelectDate={selectPlannerDate}');
    const home = read('src/components/planner/PlannerHome.tsx');
    expect(home.match(/onSelectDate\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test('the future-date alert continues straight into review', () => {
    const guide = read('app/plan/meal.tsx');
    expect(guide).toContain('onPress: () => continueToReview(localDateString())');
    // The eating date is passed explicitly rather than read back from state.
    expect(guide).toContain('const continueToReview = (eatenOn: string)');
    expect(guide).toContain('actualLocalDate: eatenOn');
  });
});
