import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  clearedRouteParams,
  isValidLocalDate,
  resolveTodayPage,
  resolveTodayRouteIntent,
} from '@/logic/todayRoute';
import { dayRailOffset } from '@/components/planner/dayRailScroll';
import {
  recallScrollOffset,
  rememberScrollOffset,
  resetRememberedScroll,
  scrollMemoryKey,
} from '@/components/today/useRememberedScroll';
import { dailyNutritionSummary } from '@/logic/dailyNutritionSummary';
import { localDateString } from '@/logic/dates';
import { useDayStore } from '@/store/dayStore';
import { useMealScheduleStore } from '@/store/mealScheduleStore';
import type { DailyTarget, MealItem, MealWithItems } from '@/types';
import { closeTestDatabase, openTestDatabase } from './stubs/db';

const read = (path: string) => readFileSync(path, 'utf8');

const today = read('app/(tabs)/index.tsx');
const calories = read('src/components/today/CaloriesPage.tsx');
const plan = read('src/components/today/MealPlanPage.tsx');
const home = read('src/components/planner/PlannerHome.tsx');
const selector = read('src/components/today/TodayTaskSelector.tsx');

/* -------------------------------------------------------------------------- */
/* 3.1 Route intent                                                           */
/* -------------------------------------------------------------------------- */

describe('Today route intent', () => {
  test('a first ordinary entry with no stored preference opens Meal plan', () => {
    const intent = resolveTodayRouteIntent({});
    expect(intent.page).toBeNull();
    expect(intent.consumed).toEqual([]);
    expect(resolveTodayPage(intent, null)).toBe('meal-plan');
  });

  test('a later ordinary entry restores the page last chosen by hand', () => {
    const intent = resolveTodayRouteIntent({});
    expect(resolveTodayPage(intent, 'calories')).toBe('calories');
    expect(resolveTodayPage(intent, 'meal-plan')).toBe('meal-plan');
  });

  test('the pre-existing saved-meal link still lands on the logged day', () => {
    const intent = resolveTodayRouteIntent({ savedMealId: 'meal-1' });
    expect(intent.page).toBe('calories');
    expect(intent.highlightMealId).toBe('meal-1');
    // Even for someone whose remembered page is the plan.
    expect(resolveTodayPage(intent, 'meal-plan')).toBe('calories');
  });

  test('the pre-existing onboarding week link still lands on the plan in Week', () => {
    const intent = resolveTodayRouteIntent({ plannerView: 'week' });
    expect(intent.page).toBe('meal-plan');
    expect(intent.plannerView).toBe('week');
    expect(resolveTodayPage(intent, 'calories')).toBe('meal-plan');
  });

  test('the planner switch\'s old "today" value means Day', () => {
    expect(resolveTodayRouteIntent({ plannerView: 'today' }).plannerView).toBe('day');
    expect(resolveTodayRouteIntent({ plannerView: 'day' }).plannerView).toBe('day');
  });

  test('an unrecognised page or view is ignored rather than guessed at', () => {
    const intent = resolveTodayRouteIntent({ todayPage: 'nutrition', plannerView: 'month' });
    expect(intent.page).toBeNull();
    expect(intent.plannerView).toBeNull();
    expect(intent.consumed).toEqual([]);
    expect(resolveTodayPage(intent, 'calories')).toBe('calories');
  });

  test('an invalid date never moves the plan', () => {
    expect(resolveTodayRouteIntent({ date: 'tomorrow' }).plannerDate).toBeNull();
    expect(resolveTodayRouteIntent({ date: '2026-13-40' }).plannerDate).toBeNull();
    expect(resolveTodayRouteIntent({ date: '' }).plannerDate).toBeNull();
    expect(resolveTodayRouteIntent({ date: '2026-09-08' }).plannerDate).toBe('2026-09-08');
    expect(isValidLocalDate('2026-02-30')).toBe(false);
  });

  test('an explicit page outranks the legacy parameter beside it', () => {
    const intent = resolveTodayRouteIntent({ todayPage: 'meal-plan', savedMealId: 'meal-2' });
    expect(intent.page).toBe('meal-plan');
    // The highlight is still honoured; only the page choice changed.
    expect(intent.highlightMealId).toBe('meal-2');
  });

  test('a scheduled recipe names the plan and the date it was scheduled into', () => {
    const intent = resolveTodayRouteIntent({ todayPage: 'meal-plan', date: '2026-09-15' });
    expect(intent.page).toBe('meal-plan');
    expect(intent.plannerDate).toBe('2026-09-15');
  });

  test('only understood parameters are consumed, and they are cleared by name', () => {
    const intent = resolveTodayRouteIntent({
      todayPage: 'calories', savedMealId: 'meal-3', date: 'nonsense', plannerView: 'week',
    });
    expect([...intent.consumed].sort()).toEqual(['plannerView', 'savedMealId', 'todayPage']);
    expect(clearedRouteParams(intent)).toEqual({
      todayPage: undefined, savedMealId: undefined, plannerView: undefined,
    });
    // A typo is left in the URL rather than quietly erased.
    expect(clearedRouteParams(intent)).not.toHaveProperty('date');
  });

  test('array-shaped parameters are read the way the router delivers them', () => {
    const intent = resolveTodayRouteIntent({ todayPage: ['calories'], savedMealId: ['meal-4'] });
    expect(intent.page).toBe('calories');
    expect(intent.highlightMealId).toBe('meal-4');
  });

  test('Today applies an arrival once and does not write it to the preference', () => {
    expect(today).toContain('appliedIntent');
    expect(today).toContain('router.setParams(clearedRouteParams(intent))');
    expect(today).toContain('writeTodayPagePreference(next)');
    expect(today).not.toContain('writeTodayPagePreference(intent');
  });
});

/* -------------------------------------------------------------------------- */
/* 3.2 Two dates                                                              */
/* -------------------------------------------------------------------------- */

describe('planning dates and logged dates stay apart', () => {
  beforeEach(() => openTestDatabase());
  afterEach(() => {
    closeTestDatabase();
    useMealScheduleStore.setState({
      status: 'idle', selectedDate: localDateString(), schedule: null, draft: null, error: null,
    });
  });

  test('each page reads its own store for the date it displays', () => {
    expect(plan).toContain("useMealScheduleStore((state) => state.selectedDate)");
    expect(plan).not.toContain('useDayStore');
    expect(calories).toContain('useDayStore');
    expect(calories).not.toContain('useMealScheduleStore');
    // One date navigator each: the logged strip on Calories, the week pager
    // and day rail on the plan.
    expect(calories).toContain('<DateStrip');
    expect(calories).not.toContain('WeekDayRail');
    expect(home).toContain('<WeekDayRail');
    expect(home).not.toContain('DateStrip');
  });

  test('the logged date still refuses the future while the plan does not', async () => {
    const future = '2999-01-01';
    const before = useDayStore.getState().selectedDate;
    await useDayStore.getState().selectDate(future);
    expect(useDayStore.getState().selectedDate).toBe(before);

    await useMealScheduleStore.getState().load(future);
    expect(useMealScheduleStore.getState().selectedDate).toBe(future);
  });

  test('selecting a date in another week loads that week', async () => {
    await useMealScheduleStore.getState().load('2026-09-08');
    expect(useMealScheduleStore.getState().draft?.weekStart).toBe('2026-09-07');
    await useMealScheduleStore.getState().load('2026-09-15');
    expect(useMealScheduleStore.getState().draft?.weekStart).toBe('2026-09-14');
  });

  test('a late read for a week already left is ignored', async () => {
    const slow = useMealScheduleStore.getState().load('2026-09-08');
    const fast = useMealScheduleStore.getState().load('2026-09-15');
    await Promise.all([slow, fast]);
    // The week on screen is the last one asked for, whichever read settled last.
    expect(useMealScheduleStore.getState().selectedDate).toBe('2026-09-15');
    expect(useMealScheduleStore.getState().draft?.weekStart).toBe('2026-09-14');
    expect(useMealScheduleStore.getState().status).toBe('ready');
  });

  test('a reload reads the persisted draft back rather than discarding it', async () => {
    await useMealScheduleStore.getState().load('2026-09-08');
    const draft = useMealScheduleStore.getState().draft!;
    await useMealScheduleStore.getState().updateDraft({
      ...draft,
      snapshots: [{
        id: 'snap', sourceKind: 'saved_recipe', sourceId: 'saved-1', sourceVersion: 'v1',
        title: 'Work in progress', mealTypes: ['dinner'], cuisines: [], baseYield: 1,
        durationMinutes: null, requiredAppliances: [], ingredients: [], steps: [],
        nutritionPerPortion: { calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null, source: null },
        createdAt: '2026-09-08T00:00:00.000Z',
      }],
    });
    await useMealScheduleStore.getState().load('2026-09-08');
    expect(useMealScheduleStore.getState().draft?.snapshots[0]?.title).toBe('Work in progress');
  });

  test('focus reloads the week the plan is on, and midnight is still caught', () => {
    expect(today).toContain('planner.load(planner.selectedDate)');
    expect(today).toContain("AppState.addEventListener('change', onChange)");
    expect(today).toContain('void syncToToday()');
    expect(today).toContain('return () => resumeFollowing();');
  });

  test('a plan for another day never claims that day\'s intake was logged', () => {
    expect(today).toContain('plannerDate === selectedDate && nutritionSummary.hasMeals');
  });
});

/* -------------------------------------------------------------------------- */
/* 3.3 Selector, scroll and hidden content                                    */
/* -------------------------------------------------------------------------- */

describe('the task selector and page scrolling', () => {
  beforeEach(() => resetRememberedScroll());

  test('the selector is labelled exactly Meal plan and Calories, with tab semantics', () => {
    expect(selector).toContain("'Meal plan'");
    expect(selector).toContain("'Calories'");
    expect(selector).not.toContain("'Nutrition'");
    expect(selector).toContain('accessibilityRole="tablist"');
    expect(selector).toContain('accessibilityRole="tab"');
    expect(selector).toContain('accessibilityState={{ selected }}');
    // Selection is not carried by colour alone.
    expect(selector).toContain('ruleSelected');
  });

  test('the selector sits outside both pages\' scroll views', () => {
    expect(today.indexOf('<TodayTaskSelector')).toBeLessThan(today.indexOf('<MealPlanPage'));
    expect(today).not.toContain('<ScrollView');
    expect(calories).toContain('<ScrollView');
    expect(plan).toContain('<ScrollView');
  });

  test('only the selected page is mounted, so hidden content takes no focus', () => {
    expect(today).toContain("page === 'meal-plan' ? (");
    expect(today).not.toContain("display: 'none'");
  });

  test('each page and date remembers its own position, and a new date starts at the top', () => {
    const planKey = scrollMemoryKey('meal-plan', '2026-09-08');
    const caloriesKey = scrollMemoryKey('calories', '2026-09-08');
    rememberScrollOffset(planKey, 640);
    rememberScrollOffset(caloriesKey, 120);

    expect(recallScrollOffset(planKey)).toBe(640);
    expect(recallScrollOffset(caloriesKey)).toBe(120);
    // Another day is a different page of content, so it opens at the top.
    expect(recallScrollOffset(scrollMemoryKey('calories', '2026-09-09'))).toBe(0);
    // A rubber-banded negative offset is not a position.
    rememberScrollOffset(caloriesKey, -40);
    expect(recallScrollOffset(caloriesKey)).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 3.4 One planning rail                                                      */
/* -------------------------------------------------------------------------- */

describe('the plan has one date rail and a compact view control', () => {
  const agenda = read('src/components/planner/PlannerAgenda.tsx');
  const rail = read('src/components/planner/WeekDayRail.tsx');
  const control = read('src/components/planner/PlanViewControl.tsx');
  const draggable = read('src/components/planner/DraggableSlot.tsx');

  test('the rail is rendered once, by the page, in both views', () => {
    expect((home.match(/<WeekDayRail/g) ?? []).length).toBe(1);
    expect(agenda).not.toContain('<WeekDayRail');
    // No `view === 'week'` gate around it any more.
    expect(home).not.toContain("view === 'week' ? (\n        <WeekDayRail");
  });

  test('Day and Week are a menu, not a second segmented control', () => {
    expect(control).toContain('<Sheet');
    expect(control).toContain("label: 'Day'");
    expect(control).toContain("label: 'Week'");
    expect(control).toContain('accessibilityState={{ selected }}');
    // The planner's own pill switch is gone; the only tablist is the task one.
    expect(home).not.toContain("accessibilityRole=\"tab\"");
  });

  test('day squares are hit-tested in the coordinate space a gesture reports', () => {
    expect(rail).toContain('measureInWindow');
    expect(draggable).not.toContain('railOffset');
    expect(draggable).toContain('absoluteX >= target.x');
    // Positions are taken again as a lift starts, because both scroll views
    // can have moved since layout.
    expect(draggable).toContain('runOnJS(onLift)()');
    expect(home).toContain('onLiftSlot={() => setMeasureKey((key) => key + 1)}');
  });

  test('tap equivalents and partial-week actions survive', () => {
    expect(agenda).toContain("case 'move'");
    expect(agenda).toContain('<SlotDestinationSheet');
    expect(home).toContain('Done planning');
    expect(home).toContain('Review groceries');
    expect(home).toContain('Save or reuse a week');
  });

  test('the week pager reaches future and past weeks without the logged-date limit', () => {
    expect(home).toContain('addWeeks(selectedDate, -1)');
    expect(home).toContain('addWeeks(selectedDate, 1)');
    expect(home).toContain('weekRangeLabel(selectedDate)');
    expect(home).not.toContain('isFuture');
  });
});

/* -------------------------------------------------------------------------- */
/* The day rail keeps the selected day on screen                              */
/* -------------------------------------------------------------------------- */

describe('the day rail reveals the day it is about', () => {
  // Seven 52 dp tiles with 8 dp gaps. The viewport varies: a 411 dp phone shows
  // almost the whole week, a narrow one shows about half.
  const TILE = 52;
  const GAP = 8;
  const CONTENT = 7 * TILE + 6 * GAP + 16;
  const tileX = (index: number) => index * (TILE + GAP);
  const offsetFor = (index: number, viewportWidth: number) => dayRailOffset({
    tileX: tileX(index), tileWidth: TILE, viewportWidth, contentWidth: CONTENT,
  });

  /** Roughly a 411 dp phone once the screen gutters are taken off. */
  const PHONE = 371;
  /** Narrow enough that centring is actually reachable. */
  const NARROW = 200;

  test('Sunday is brought fully into view instead of clipping at the edge', () => {
    // The defect this fixes: the rail opened at offset zero and the selected
    // day hung off the right edge, which on a Sunday is today.
    expect(offsetFor(6, PHONE)).toBe(CONTENT - PHONE);
    expect(tileX(6) + TILE).toBeLessThanOrEqual(offsetFor(6, PHONE) + PHONE);
    // Left alone at zero it would have been clipped, which is the bug.
    expect(tileX(6) + TILE).toBeGreaterThan(PHONE);
  });

  test('Monday sits at the start rather than being centred into empty space', () => {
    expect(offsetFor(0, PHONE)).toBe(0);
    expect(offsetFor(0, NARROW)).toBe(0);
  });

  test('a midweek day is centred when the week is wider than the rail', () => {
    const wednesday = offsetFor(2, NARROW);
    expect(wednesday).toBeGreaterThan(0);
    expect(wednesday).toBeLessThan(CONTENT - NARROW);
    expect(tileX(2) + TILE / 2 - wednesday).toBeCloseTo(NARROW / 2, 5);
  });

  test('every day of every week ends up fully visible', () => {
    for (const viewport of [NARROW, PHONE, 320]) {
      for (let index = 0; index < 7; index += 1) {
        const offset = offsetFor(index, viewport);
        expect(tileX(index), `day ${index} at ${viewport}`).toBeGreaterThanOrEqual(offset);
        expect(tileX(index) + TILE, `day ${index} at ${viewport}`)
          .toBeLessThanOrEqual(offset + viewport);
      }
    }
  });

  test('a rail with nothing to scroll rests at zero', () => {
    expect(offsetFor(6, 900)).toBe(0);
    // And a viewport reported before layout settles cannot produce a negative.
    expect(dayRailOffset({ tileX: 0, tileWidth: TILE, viewportWidth: 0, contentWidth: 0 })).toBe(0);
  });

  test('the rail places a new week and animates within one, honouring Reduce Motion', () => {
    const rail = read('src/components/planner/WeekDayRail.tsx');
    expect(rail).toContain('positionedWeek.current === week && !reduceMotion');
    expect(rail).toContain('useReducedMotion');
    // Scroll offsets are content coordinates; drop targets stay window ones.
    expect(rail).toContain('measureInWindow');
    expect(rail).toContain('dayRailOffset({');
  });
});

/* -------------------------------------------------------------------------- */
/* 3.5 Return navigation                                                      */
/* -------------------------------------------------------------------------- */

describe('finishing a task returns to the page that owns it', () => {
  test('every meal-save caller names Calories', () => {
    for (const path of ['app/review.tsx', 'app/manual.tsx', 'app/dinner.tsx']) {
      expect(read(path), path).toContain("todayPage: 'calories'");
    }
  });

  test('scheduling a recipe names the plan and its date, not the picker', () => {
    const recipe = read('app/plan/recipe.tsx');
    expect(recipe).toContain("router.navigate({ pathname: '/(tabs)', params: { todayPage: 'meal-plan', date } })");
    expect(recipe).not.toContain("router.navigate('/plan/picker')");
  });

  test('the onboarding handoff still opens the saved week', () => {
    expect(read('app/onboarding/first-schedule.tsx'))
      .toContain("params: { todayPage: 'meal-plan', plannerView: 'week' }");
  });

  test('cancelling a preview goes back rather than committing anything', () => {
    const recipe = read('app/plan/recipe.tsx');
    expect(recipe).toContain('label="Back to recipes"');
    expect(recipe).toContain('router.back()');
  });

  test('the planner view is controlled, so a handoff can change it after first render', () => {
    expect(home).toContain('view: PlannerView;');
    expect(home).toContain('onChangeView: (view: PlannerView) => void;');
    expect(home).not.toContain('initialView');
    expect(today).toContain('if (intent.plannerView) setView(intent.plannerView)');
  });
});

/* -------------------------------------------------------------------------- */
/* 4.1–4.3 Calories content                                                   */
/* -------------------------------------------------------------------------- */

const target: DailyTarget = {
  localDate: '2026-09-08', targetCalories: 2000, proteinG: 120, carbsG: 220, fatG: 70, fibreG: 30,
};

function meal(items: Partial<MealItem>[]): MealWithItems {
  return {
    id: 'meal', loggedAt: '2026-09-08T12:00:00.000Z', localDate: '2026-09-08',
    mealType: 'lunch', name: 'Lunch', photoUri: null, source: 'manual',
    confidence: null, venue: 'home', servingsMult: 1,
    createdAt: '2026-09-08T12:00:00.000Z',
    items: items.map((item, index): MealItem => ({
      id: `item-${index}`, mealId: 'meal', name: 'Food', quantity: 1, unit: 'g',
      calories: null, proteinG: null, carbsG: null, fatG: null, fibreG: null,
      isManualAddition: false, sortOrder: index, canonicalId: null, ...item,
    })),
  };
}

describe('Calories keeps its states honest', () => {
  test('no target is not a zero target', () => {
    const summary = dailyNutritionSummary('2026-09-08', [meal([{ calories: 500 }])], null);
    expect(summary.metrics.energy.target).toBeNull();
    expect(summary.metrics.fibre.target).toBeNull();
    // And the page says so rather than drawing four meters against nothing.
    expect(calories).toContain('No daily target is recorded');
    expect(calories).toContain("target === null ? 'No target'");
  });

  test('a day with no meals has a defensible zero, not an unknown', () => {
    const summary = dailyNutritionSummary('2026-09-08', [], target);
    expect(summary.hasMeals).toBe(false);
    expect(summary.metrics.energy.knownValue).toBe(0);
    expect(summary.metrics.energy.coverage).toBe('no-meals');
  });

  test('all-unknown intake stays unknown, and partial intake is marked partial', () => {
    const unknown = dailyNutritionSummary('2026-09-08', [meal([{}])], target);
    expect(unknown.metrics.energy.knownValue).toBeNull();
    expect(unknown.metrics.energy.coverage).toBe('unknown');

    const partial = dailyNutritionSummary(
      '2026-09-08', [meal([{ calories: 500 }, {}])], target,
    );
    expect(partial.metrics.energy.knownValue).toBe(500);
    expect(partial.metrics.energy.coverage).toBe('partial');
  });

  test('an unknown day shows no remaining figure at all', () => {
    // `remaining` is null unless both the known value and the target exist, so
    // a partial day never presents a complete-looking headline.
    expect(calories).toContain('energy.knownValue === null || energy.target === null');
    expect(calories).toContain("'Calories unavailable'");
    expect(calories).toContain('One or more meals have unknown calories.');
  });

  test('the summaries precede the rail, the banners and the history', () => {
    const hero = calories.indexOf('styles.hero');
    expect(hero).toBeLessThan(calories.indexOf('<DailyTargetSummary'));
    expect(calories.indexOf('<DailyTargetSummary')).toBeLessThan(calories.indexOf('<DayRail'));
    expect(calories.indexOf('<DayRail')).toBeLessThan(calories.indexOf('styles.banner'));
    expect(calories.indexOf('styles.banner')).toBeLessThan(calories.indexOf('<MealRow'));
  });

  test('delete keeps its undo, and loading is not an empty day', () => {
    expect(calories).toContain("actionLabel: 'Undo'");
    // The nutrient rows' dinner-gap action reads as an action, not as a caption.
    expect(read('src/components/DailyTargetSummary.tsx')).toContain('requestLabel: { color: color.action }');
    expect(calories).toContain('onAction: () => void undoRemove()');
    expect(calories).toContain('loading && meals.length === 0 ? null');
  });

  test('a linked plan slot is not counted twice against the day', () => {
    const agenda = read('src/components/planner/PlannerAgenda.tsx');
    // Only slots still `planned` are added to what is already eaten; a logged
    // slot is already in the day store's meals.
    expect(agenda).toContain("slot.status === 'planned'");
    expect(agenda).toContain('[...eatenEntries, ...planned]');
  });

  test('large text reflows rather than clipping, and the page uses theme roles only', () => {
    expect(read('src/components/Meter.tsx')).toContain('PixelRatio.getFontScale()');
    // The plan's own rows follow the same rule: past the threshold the fixed
    // meal-type column goes, rather than breaking `Breakfast` mid-word.
    const slotRow = read('src/components/planner/MealSlotRow.tsx');
    expect(slotRow).toContain('PixelRatio.getFontScale()');
    expect(slotRow).toContain('STACK_ABOVE_FONT_SCALE');
    // A narrow phone squeezes the same column, so it stacks there too.
    expect(slotRow).toContain('STACK_BELOW_WIDTH = 360');
    expect(slotRow).toContain('width < STACK_BELOW_WIDTH');
    expect(slotRow).toContain('stacked ? undefined : styles.slotColumn');
    expect(slotRow).toContain('numberOfLines={stacked ? undefined : 2}');
    expect(calories).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\s*\(/i);
    expect(read('src/components/today/TodayTaskSelector.tsx')).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    // Nothing on this page truncates: no value or label is given a line cap,
    // so enlarged text wraps instead of losing a digit.
    expect(calories).not.toContain('numberOfLines');
  });

  test('planning stays optional and the one Add affordance is unchanged', () => {
    expect(calories).not.toContain('<Fab');
    expect(calories).not.toContain('<RecentMealsSheet');
    expect(calories).toContain('<NavCoachMark');
    // A plan that fails to load is the planner's problem, not the day's: the
    // Calories page does not read the schedule store at all.
    expect(calories).not.toContain('mealScheduleStore');
    expect(home).toContain('Your plan could not be loaded');
    expect(home).toContain('label="Try again"');
  });
});
