import { CUISINE_KEYWORDS } from '@/logic/suggest';
import type { BucketedItem, PersonalisationSummary } from '@/logic/suggest';
import { daysUntil } from '@/logic/stockStatus';
import type { Suggestion, UrgencyBucket } from '@/types';

/**
 * Ranks a generated candidate pool locally (decision 149, `add-dish-scorer`).
 *
 * Pure: no request, no database read, no mutation of a suggestion. The
 * absolute constraints — an invented canonical id, decision 136's use-first
 * check — already ran upstream in `parseSuggestResponse`, over the whole
 * pool, before anything here is called. Everything reaching `scoreDish` is
 * already eligible; scoring only ever chooses among eligible suggestions; a
 * suggestion this module drops is never repaired, only left out (decisions
 * 136 and 150's convention).
 *
 * Every term is read from a fact the app already computed or the model
 * already returned — `urgency` and `summarisePersonalisation` do the actual
 * measurement elsewhere. Inventing a new signal here would be two changes
 * wearing one name, and the new signal would be unmeasured while this one
 * took the blame.
 */

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

export interface StockIndexEntry {
  /** Summed `urgency()` across every physical item under this canonical id. */
  urgencyScore: number;
  /** The nearest expiry among those items. Null when none carries a date. */
  daysLeft: number | null;
}

export interface DishScoreContext {
  stockIndex: ReadonlyMap<string, StockIndexEntry>;
  remainingCalories: number;
  personalisation: PersonalisationSummary;
}

/**
 * Aggregates bucketed stock (whatever `bucketStock` already computed) by
 * canonical id, since a suggestion's `uses` names an ingredient, not a
 * specific physical item — two containers of the same urgent, valuable
 * ingredient both count toward it, and the nearer of their expiry dates is
 * the pressure a dish clears. `today` must be the same date `bucketStock`
 * itself was called with, so the two agree on what "days left" means.
 */
export function buildStockIndex(
  bucketed: Record<UrgencyBucket, BucketedItem[]>,
  today?: string,
): Map<string, StockIndexEntry> {
  const index = new Map<string, StockIndexEntry>();
  for (const bucket of Object.values(bucketed)) {
    for (const entry of bucket) {
      const daysLeft = daysUntil(entry.item.expiresAt, today);
      const existing = index.get(entry.canonical.id);
      if (!existing) {
        index.set(entry.canonical.id, { urgencyScore: entry.urgencyScore, daysLeft });
        continue;
      }
      index.set(entry.canonical.id, {
        urgencyScore: existing.urgencyScore + entry.urgencyScore,
        daysLeft: nearer(existing.daysLeft, daysLeft),
      });
    }
  }
  return index;
}

function nearer(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

export function buildDishScoreContext(
  bucketed: Record<UrgencyBucket, BucketedItem[]>,
  remainingCalories: number,
  personalisation: PersonalisationSummary,
  today?: string,
): DishScoreContext {
  return {
    stockIndex: buildStockIndex(bucketed, today),
    remainingCalories,
    personalisation,
  };
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* -------------------------------------------------------------------------- */

/** How much decayed, priced urgency (dollars, roughly) maxes the value-at-risk term. */
export const VALUE_AT_RISK_SCALE_CENTS = 1000;
/** Minutes at which the effort term has decayed to half. */
export const EFFORT_HALF_LIFE_MINUTES = 30;
/** Calories over the day's remainder at which the calorie-fit term has decayed to half. */
export const CALORIE_FIT_HALF_LIFE = 400;
/** Score contribution for a dish that repeats a frequently-cooked one exactly. */
export const FAMILIAR_DISH_SCORE = 1;
/** Score contribution for a dish that merely matches the leaning cuisine. */
export const FAMILIAR_CUISINE_SCORE = 0.5;
/** Flat penalty for a dish that repeats something eaten in the recently-eaten window. */
export const RECENCY_PENALTY = 1;

export const VALUE_AT_RISK_WEIGHT = 3;
export const EXPIRY_PRESSURE_WEIGHT = 2;
export const EFFORT_WEIGHT = 1;
export const CALORIE_FIT_WEIGHT = 1;
export const FAMILIARITY_WEIGHT = 1;
export const RECENCY_PENALTY_WEIGHT = 4;

function valueAtRiskTerm(suggestion: Suggestion, context: DishScoreContext): number {
  let sum = 0;
  for (const use of suggestion.uses) {
    sum += context.stockIndex.get(use.canonicalId)?.urgencyScore ?? 0;
  }
  return Math.min(1, sum / VALUE_AT_RISK_SCALE_CENTS);
}

function expiryPressureTerm(suggestion: Suggestion, context: DishScoreContext): number {
  let nearest: number | null = null;
  for (const use of suggestion.uses) {
    const days = context.stockIndex.get(use.canonicalId)?.daysLeft ?? null;
    nearest = nearer(nearest, days);
  }
  if (nearest === null) return 0;
  return 1 / (1 + Math.max(nearest, 0));
}

function effortTerm(suggestion: Suggestion): number {
  return 1 / (1 + suggestion.effortMinutes / EFFORT_HALF_LIFE_MINUTES);
}

function calorieFitTerm(suggestion: Suggestion, context: DishScoreContext): number {
  const overshoot = Math.max(
    0,
    suggestion.kcalPerServing - Math.max(context.remainingCalories, 0),
  );
  return 1 / (1 + overshoot / CALORIE_FIT_HALF_LIFE);
}

function familiarityTerm(suggestion: Suggestion, context: DishScoreContext): number {
  const { personalisation } = context;
  if (personalisation.frequentDishes.includes(suggestion.dish)) {
    return FAMILIAR_DISH_SCORE;
  }
  if (personalisation.topCuisine && cuisineOf(suggestion.dish) === personalisation.topCuisine) {
    return FAMILIAR_CUISINE_SCORE;
  }
  return 0;
}

function recencyTerm(suggestion: Suggestion, context: DishScoreContext): number {
  return context.personalisation.recentlyEaten.includes(suggestion.dish)
    ? -RECENCY_PENALTY
    : 0;
}

/** The cuisine a dish name reads as, via the same keyword table `summarisePersonalisation` uses. */
function cuisineOf(dish: string): string | null {
  const lower = dish.toLowerCase();
  for (const [keyword, cuisine] of Object.entries(CUISINE_KEYWORDS)) {
    if (lower.includes(keyword)) return cuisine;
  }
  return null;
}

/**
 * Scores one suggestion. Pure — the same suggestion and context always
 * produce the same number, and nothing here reaches outside its arguments.
 */
export function scoreDish(suggestion: Suggestion, context: DishScoreContext): number {
  return (
    VALUE_AT_RISK_WEIGHT * valueAtRiskTerm(suggestion, context) +
    EXPIRY_PRESSURE_WEIGHT * expiryPressureTerm(suggestion, context) +
    EFFORT_WEIGHT * effortTerm(suggestion) +
    CALORIE_FIT_WEIGHT * calorieFitTerm(suggestion, context) +
    FAMILIARITY_WEIGHT * familiarityTerm(suggestion, context) +
    RECENCY_PENALTY_WEIGHT * recencyTerm(suggestion, context)
  );
}

/* -------------------------------------------------------------------------- */
/* Selection and variety                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Below this, two dishes count as different enough to show together.
 * Similarity is the greater of ingredient overlap (Jaccard over `uses`
 * canonical ids) and a flat bump for sharing a detected cuisine — reusing
 * `CUISINE_KEYWORDS`, never the dish names themselves, since "chicken stir
 * fry" and "pork stir fry" are different dinners with similar names and
 * "fried rice" and "chāhan" are the same dinner without one.
 */
export const SIMILARITY_THRESHOLD = 0.5;
/** How similar two dishes count as, purely for sharing a detected cuisine. */
export const CUISINE_SIMILARITY = 0.6;

function ingredientOverlap(a: Suggestion, b: Suggestion): number {
  const aIds = new Set(a.uses.map((use) => use.canonicalId));
  const bIds = new Set(b.uses.map((use) => use.canonicalId));
  if (aIds.size === 0 && bIds.size === 0) return 0;
  let shared = 0;
  for (const id of aIds) {
    if (bIds.has(id)) shared += 1;
  }
  const union = new Set([...aIds, ...bIds]).size;
  return union === 0 ? 0 : shared / union;
}

function similarity(a: Suggestion, b: Suggestion): number {
  const overlap = ingredientOverlap(a, b);
  const cuisineA = cuisineOf(a.dish);
  const cuisineB = cuisineOf(b.dish);
  const cuisineMatch = cuisineA !== null && cuisineA === cuisineB ? CUISINE_SIMILARITY : 0;
  return Math.max(overlap, cuisineMatch);
}

/**
 * Selects `count` suggestions from a scored pool: the top scorer, then
 * repeatedly the highest scorer that is sufficiently unlike every dish
 * already selected. Never mutates a suggestion — only orders and filters
 * the array (spec: "never altered to improve its score").
 *
 * The variety floor: if fewer than `count` pass the similarity check, the
 * remainder is filled from the next-highest scorers regardless of
 * similarity. Showing three alike dinners is still better than showing one.
 */
export function selectDisplayed(
  pool: readonly Suggestion[],
  context: DishScoreContext,
  count: number,
): Suggestion[] {
  const ranked = [...pool].sort(
    (a, b) => scoreDish(b, context) - scoreDish(a, context),
  );

  const selected: Suggestion[] = [];
  for (const candidate of ranked) {
    if (selected.length >= count) break;
    const tooSimilar = selected.some(
      (chosen) => similarity(candidate, chosen) >= SIMILARITY_THRESHOLD,
    );
    if (!tooSimilar) selected.push(candidate);
  }

  if (selected.length < count) {
    for (const candidate of ranked) {
      if (selected.length >= count) break;
      if (!selected.includes(candidate)) selected.push(candidate);
    }
  }

  // Selection order (variety-first, then the floor) is not display order.
  // "The scored order replaces the generated order" (spec) means whichever
  // dishes are chosen still appear ranked by score — a lower-scoring
  // variety pick does not jump ahead of a higher-scoring floor pick just
  // because it was found first.
  return selected.sort((a, b) => scoreDish(b, context) - scoreDish(a, context));
}
