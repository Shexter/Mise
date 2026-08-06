import { generateSuggestions } from '@/api/suggest';
import { hasApiKey } from '@/api/keyStore';
import {
  ensureDailyTarget,
  getAllCanonicals,
  getMealsForDate,
  getProfile,
  getRecentMeals,
  getSuggestionCache,
  listPantryItems,
  saveSuggestionCache,
  type NewMeal,
  type NewMealItem,
} from '@/db/queries';
import { localDateString, mealTypeForTime } from '@/logic/dates';
import { macrosOfMeals } from '@/logic/scaling';
import {
  bucketStock,
  computeFingerprint,
  HISTORY_WINDOW_DAYS,
  shapeStockPayload,
  summarisePersonalisation,
  type StockPayload,
} from '@/logic/suggest';
import type {
  CanonicalItem,
  Macros,
  MealType,
  Suggestion,
  SuggestionMode,
  SuggestionSet,
} from '@/types';

/**
 * Binds the pure engine in `suggest.ts` to the database, the identity
 * layer, and the model call — the same shape as `depletionService.ts`.
 * This is where caching happens: reuse when nothing material has changed,
 * regenerate when it has, and only an explicit refresh spends a call on
 * demand outside that rule (decision 40).
 */

export interface SuggestionRequestContext {
  localDate: string;
  mode: SuggestionMode;
  /** Required, and only meaningful, for `mode: 'stretch'`. */
  untilDate?: string;
  /** Bypasses the cache. The only on-demand path that spends a call. */
  forceRefresh?: boolean;
}

export type SuggestionOutcome =
  | { status: 'ready'; set: SuggestionSet; fromCache: boolean }
  | { status: 'no_key' }
  | { status: 'error'; message: string };

async function remainingCalories(localDate: string): Promise<{
  remaining: number;
  macroGap: Macros;
}> {
  const profile = await getProfile();
  if (!profile) {
    return { remaining: 0, macroGap: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 } };
  }
  const target = await ensureDailyTarget(localDate, profile);
  const meals = await getMealsForDate(localDate);
  const consumed = macrosOfMeals(meals);
  return {
    remaining: target.targetCalories - consumed.calories,
    macroGap: {
      calories: target.targetCalories - consumed.calories,
      proteinG: target.proteinG - consumed.proteinG,
      carbsG: target.carbsG - consumed.carbsG,
      fatG: target.fatG - consumed.fatG,
    },
  };
}

async function buildStockPayload(
  localDate: string,
): Promise<{ payload: StockPayload; canonicals: Map<string, CanonicalItem> }> {
  const [items, canonicalList] = await Promise.all([
    listPantryItems(),
    getAllCanonicals(),
  ]);
  const canonicals = new Map(canonicalList.map((c) => [c.id, c]));
  const bucketed = bucketStock(items, canonicals, localDate);
  return { payload: shapeStockPayload(bucketed), canonicals };
}

/**
 * Gets today's suggestions, reusing the cache when nothing material has
 * changed and generating fresh ones otherwise.
 */
export async function getOrGenerateSuggestions(
  context: SuggestionRequestContext,
): Promise<SuggestionOutcome> {
  const localDate = context.localDate;
  const { payload: stock } = await buildStockPayload(localDate);
  const { remaining, macroGap } = await remainingCalories(localDate);
  const recentMeals = await getRecentMeals(HISTORY_WINDOW_DAYS);
  const personalisation = summarisePersonalisation(recentMeals, localDate);

  const urgentStock = [...stock.full]
    .filter((line) => line.bucket !== 'available')
    .map((line) => ({ canonicalId: line.canonicalId, qtyRemaining: null }));
  const fingerprint = computeFingerprint({
    urgentStock,
    remainingCalories: remaining,
    recentlyEaten: personalisation.recentlyEaten,
  });

  if (!context.forceRefresh) {
    const cached = await getSuggestionCache(localDate, context.mode);
    if (cached && cached.fingerprint === fingerprint) {
      return { status: 'ready', set: cached, fromCache: true };
    }
  }

  if (!(await hasApiKey())) {
    return { status: 'no_key' };
  }

  try {
    const result = await generateSuggestions({
      mode: context.mode,
      stock,
      personalisation,
      remainingCalories: remaining,
      macroGap,
      untilDate: context.untilDate,
    });
    const stretch =
      context.mode === 'stretch' && context.untilDate
        ? {
            dinners: result.suggestions,
            shortfall: result.shortfall,
            untilDate: context.untilDate,
          }
        : null;
    const set = await saveSuggestionCache(
      localDate,
      context.mode,
      fingerprint,
      context.mode === 'stretch' ? [] : result.suggestions,
      stretch,
      result.droppedForConstraint,
    );
    return { status: 'ready', set, fromCache: false };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Suggestions failed.',
    };
  }
}

export interface CookSuggestionInput {
  suggestion: Suggestion;
  /** Servings the cooking made, defaulting to the suggestion's own figure. */
  servingsMade: number;
  localDate: string;
  mealType?: MealType;
  canonicals: ReadonlyMap<string, CanonicalItem>;
}

/**
 * Turns a suggestion into a meal ready for the existing commit path — "I
 * cooked this" (task 7.1). No parallel path: this is the same `NewMeal`
 * shape `review.tsx` and `manual.tsx` build, so depletion, totals,
 * reversal, and editing all just work.
 *
 * The suggestion states amounts for its own `servings`; `servingsMade`
 * scales the batch the same way "servings this made" does on the review
 * screen (decision 10) — as a ratio fed into `servingsMult`, not baked
 * into the item quantities, so `planDepletion` applies it once.
 *
 * The model gives calories per serving for the dish as a whole, not per
 * ingredient, so calories land on one dish-level item and the ingredient
 * items that carry the canonical ids for depletion carry zero — the
 * refusal to fabricate a per-ingredient split (decision 62).
 */
export function mealFromSuggestion(input: CookSuggestionInput): NewMeal {
  const servingsMult =
    Math.max(1, input.servingsMade) / Math.max(1, input.suggestion.servings);

  const items: NewMealItem[] = [
    {
      name: input.suggestion.dish,
      quantity: 1,
      unit: 'serving',
      calories: input.suggestion.kcalPerServing,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      isManualAddition: false,
    },
    ...input.suggestion.uses.map((use) => ({
      name: input.canonicals.get(use.canonicalId)?.displayName ?? use.canonicalId,
      quantity: use.qty,
      unit: use.unit,
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      isManualAddition: false,
      canonicalId: use.canonicalId,
    })),
  ];

  return {
    loggedAt: new Date().toISOString(),
    localDate: input.localDate,
    mealType: input.mealType ?? mealTypeForTime(),
    name: input.suggestion.dish,
    photoUri: null,
    source: 'suggestion',
    confidence: null,
    venue: 'home',
    servingsMult,
    items,
  };
}

/** Today's suggestions, following the app's local-date convention. */
export function todaysSuggestions(
  mode: SuggestionMode = 'tonight',
  options: { untilDate?: string; forceRefresh?: boolean } = {},
): Promise<SuggestionOutcome> {
  return getOrGenerateSuggestions({
    localDate: localDateString(),
    mode,
    ...options,
  });
}
