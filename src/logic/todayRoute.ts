import { parseLocalDate } from '@/logic/dates';

/**
 * Which of Today's two tasks an arrival names, and what date it names it on.
 *
 * Today holds two subpages — planning a week, and reviewing what was actually
 * eaten — and almost every route into it is finishing one of those two tasks.
 * A meal save has nothing to say about the plan, and a scheduled recipe has
 * nothing to say about calories, so the arrival itself decides the page rather
 * than leaving the person to find the half of the screen their work landed on.
 *
 * Pure on purpose: no store, no navigation, no storage. The screen resolves an
 * intent from its parameters, applies it once, and clears what it used.
 */

export type TodayPage = 'meal-plan' | 'calories';

/** Day shows one date's meals; Week shows the rail plus the selected day. */
export type PlannerView = 'day' | 'week';

export const TODAY_PAGES: readonly TodayPage[] = ['meal-plan', 'calories'];

/** The default for an install that has never chosen. Planning leads. */
export const DEFAULT_TODAY_PAGE: TodayPage = 'meal-plan';

/** Expo Router hands every parameter through as a string or an array of them. */
type RouteValue = string | string[] | undefined | null;

export interface TodayRouteParams {
  /** The page this arrival names. Added by this change. */
  todayPage?: RouteValue;
  /** Pre-existing: the meal a save wants highlighted. Implies Calories. */
  savedMealId?: RouteValue;
  /** The planning date a scheduled recipe landed on. */
  date?: RouteValue;
  /** Pre-existing: `week` from the onboarding handoff. Implies Meal plan. */
  plannerView?: RouteValue;
}

export interface TodayRouteIntent {
  /** The page this arrival names, or `null` when it names none. */
  page: TodayPage | null;
  /** A planning date to select, or `null`. */
  plannerDate: string | null;
  /** A planner view to switch to, or `null`. */
  plannerView: PlannerView | null;
  /** The saved meal to highlight, or `null`. */
  highlightMealId: string | null;
  /**
   * The parameters that were understood, and so must be cleared once applied.
   * An unrecognised parameter is not listed: clearing it would hide a typo
   * that should stay visible in the URL that produced it.
   */
  consumed: readonly (keyof TodayRouteParams)[];
}

export const EMPTY_TODAY_ROUTE_INTENT: TodayRouteIntent = {
  page: null,
  plannerDate: null,
  plannerView: null,
  highlightMealId: null,
  consumed: [],
};

function first(value: RouteValue): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asPage(value: string | null): TodayPage | null {
  return value !== null && (TODAY_PAGES as readonly string[]).includes(value)
    ? (value as TodayPage)
    : null;
}

/**
 * `today` is the name the planner's own switch used before this change, and
 * old links still carry it. It means the same thing Day now means.
 */
function asPlannerView(value: string | null): PlannerView | null {
  if (value === 'week') return 'week';
  if (value === 'day' || value === 'today') return 'day';
  return null;
}

/** A local date the app could actually display, rather than any string. */
export function isValidLocalDate(value: string | null): value is string {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseLocalDate(value);
  return !Number.isNaN(parsed.getTime());
}

/**
 * Reads an arrival's parameters into one intent.
 *
 * An unrecognised page, view or date is ignored rather than guessed at: landing
 * on the wrong task is worse than landing on the remembered one, and a bad date
 * must never silently move a plan.
 */
export function resolveTodayRouteIntent(params: TodayRouteParams): TodayRouteIntent {
  const consumed: (keyof TodayRouteParams)[] = [];

  const explicitPage = asPage(first(params.todayPage));
  if (explicitPage !== null) consumed.push('todayPage');

  const highlightMealId = first(params.savedMealId);
  if (highlightMealId !== null) consumed.push('savedMealId');

  const plannerView = asPlannerView(first(params.plannerView));
  if (plannerView !== null) consumed.push('plannerView');

  const rawDate = first(params.date);
  const plannerDate = isValidLocalDate(rawDate) ? rawDate : null;
  if (plannerDate !== null) consumed.push('date');

  // An explicit page wins. Otherwise the legacy parameters still say which task
  // finished: a saved meal is a logged one, and a planner view is a plan.
  const page = explicitPage
    ?? (highlightMealId !== null ? 'calories' : null)
    ?? (plannerView !== null || plannerDate !== null ? 'meal-plan' : null);

  return { page, plannerDate, plannerView, highlightMealId, consumed };
}

/**
 * The page to show: what the arrival named, else what was last chosen by hand,
 * else planning.
 */
export function resolveTodayPage(
  intent: TodayRouteIntent,
  stored: TodayPage | null,
): TodayPage {
  return intent.page ?? stored ?? DEFAULT_TODAY_PAGE;
}

/** Route parameters cleared by name, so `setParams` can undo exactly one arrival. */
export function clearedRouteParams(
  intent: TodayRouteIntent,
): Record<string, undefined> {
  return Object.fromEntries(intent.consumed.map((key) => [key, undefined]));
}
