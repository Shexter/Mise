import { generateSuggestions } from '@/api/suggest';
import { hasApiKey } from '@/api/keyStore';
import {
  ensureDailyTarget,
  getAllCanonicals,
  getMealsForDate,
  getProfile,
  getRecentMeals,
  getSuggestionCache,
  getSuggestionPreference,
  listPantryItems,
  saveSuggestionCache,
  type NewMeal,
  type NewMealItem,
} from '@/db/queries';
import {
  buildDishScoreContext,
  decorateSuggestionForDisplay,
  selectDisplayed,
  type DishScoreContext,
} from '@/logic/dishScore';
import { defaultBaseIntent, resolveTonightPreference } from '@/logic/suggestionTemplates';
import { applyDietary, type ExclusionSet } from '@/logic/dietary';
import {
  dislikedCanonicalIds,
  getExclusionSet,
  hasAllergenRules,
  listDietaryRules,
} from '@/logic/dietaryService';
import { localDateString, mealTypeForTime } from '@/logic/dates';
import { macrosOfMeals } from '@/logic/scaling';
import { assessMacroGap, macroShortfall } from '@/logic/macroGap';
import { catalogueNutrition } from '@/logic/nutrition';
import {
  bucketStock,
  computeFingerprint,
  DISPLAYED_COUNT,
  HISTORY_WINDOW_DAYS,
  shapeStockPayload,
  summarisePersonalisation,
  type BucketedItem,
  type StockPayload,
} from '@/logic/suggest';
import type {
  CanonicalItem,
  MacroGapContext,
  Macros,
  MealType,
  Suggestion,
  SuggestionMode,
  SuggestionTargetMacro,
  SuggestionSet,
  TonightSuggestionPreference,
  UrgencyBucket,
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
  /** Required for the independently cached macro-gap request. */
  targetMacro?: SuggestionTargetMacro;
  /** Required, and only meaningful, for `mode: 'stretch'`. */
  untilDate?: string;
  /** Bypasses the cache. The only on-demand path that spends a call. */
  forceRefresh?: boolean;
}

export type SuggestionOutcome =
  | { status: 'ready'; set: SuggestionSet; fromCache: boolean }
  | {
      status: 'insufficient_data';
      targetMacro: SuggestionTargetMacro;
      reason?: 'consumed_total_unknown' | 'pantry_coverage_unknown';
    }
  | { status: 'met_target'; targetMacro: SuggestionTargetMacro }
  | { status: 'no_key' }
  | { status: 'error'; message: string };

/** Shared by the surface before a request and by the request itself. */
export async function getResolvedTonightPreference(): Promise<TonightSuggestionPreference> {
  const [profile, savedPreference] = await Promise.all([
    getProfile(),
    getSuggestionPreference(),
  ]);
  return resolveTonightPreference(profile?.goal ?? 'maintain', savedPreference);
}

/** The profile-derived recommendation, even when a saved choice currently wins. */
export async function getRecommendedTonightBaseIntent() {
  const profile = await getProfile();
  return defaultBaseIntent(profile?.goal ?? 'maintain');
}

async function remainingCalories(localDate: string): Promise<{
  remaining: number | null;
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
    remaining: consumed.calories === null ? null : target.targetCalories - consumed.calories,
    macroGap: {
      calories: consumed.calories === null ? null : target.targetCalories - consumed.calories,
      proteinG: consumed.proteinG === null ? null : target.proteinG - consumed.proteinG,
      carbsG: consumed.carbsG === null ? null : target.carbsG - consumed.carbsG,
      fatG: consumed.fatG === null ? null : target.fatG - consumed.fatG,
    },
  };
}

async function buildStockPayload(localDate: string): Promise<{
  payload: StockPayload;
  bucketed: Record<UrgencyBucket, BucketedItem[]>;
  canonicals: Map<string, CanonicalItem>;
}> {
  const [items, canonicalList] = await Promise.all([
    listPantryItems(),
    getAllCanonicals(),
  ]);
  const canonicals = new Map(canonicalList.map((c) => [c.id, c]));
  const bucketed = bucketStock(items, canonicals, localDate);
  return { payload: shapeStockPayload(bucketed), bucketed, canonicals };
}

/**
 * Gets today's suggestions, reusing the cache when nothing material has
 * changed and generating fresh ones otherwise.
 */
export async function getOrGenerateSuggestions(
  context: SuggestionRequestContext,
): Promise<SuggestionOutcome> {
  const localDate = context.localDate;
  const [profile, tonightPreference] = await Promise.all([
    getProfile(),
    context.mode === 'tonight' ? getResolvedTonightPreference() : Promise.resolve(null),
  ]);
  const { payload: stock, bucketed, canonicals } = await buildStockPayload(localDate);
  const { remaining, macroGap } = await remainingCalories(localDate);
  const targetMacro = context.mode === 'macro_gap' ? context.targetMacro : undefined;
  let macroGapContext: MacroGapContext | undefined;
  if (context.mode === 'macro_gap' && !targetMacro) {
    return { status: 'error', message: 'Choose a macro to target.' };
  }
  if (targetMacro) {
    if (!profile) return { status: 'insufficient_data', targetMacro };
    const target = await ensureDailyTarget(localDate, profile);
    const consumed = macrosOfMeals(await getMealsForDate(localDate));
    const shortfallG = macroShortfall(target, consumed, targetMacro);
    if (shortfallG === null) {
      return { status: 'insufficient_data', targetMacro, reason: 'consumed_total_unknown' };
    }
    if (shortfallG <= 0) return { status: 'met_target', targetMacro };
    const assessment = assessMacroGap(await listPantryItems(), canonicals, targetMacro, localDate);
    if (!assessment.hasMeasuredCoverage) {
      return { status: 'insufficient_data', targetMacro, reason: 'pantry_coverage_unknown' };
    }
    macroGapContext = {
      shortfallG,
      bestAchievableG: assessment.bestAchievableG,
      partialCoverage: assessment.hasUnmeasuredStock,
    };
  }
  const recentMeals = await getRecentMeals(HISTORY_WINDOW_DAYS);
  const personalisation = summarisePersonalisation(recentMeals, localDate);

  // Read fresh on every call, cache hit or miss — a rule recorded since the
  // pool was cached must take effect immediately, with no new request
  // (task 7.3/9.5). Rules are not part of the fingerprint: what changed is
  // *selection*, not the facts the pool itself was generated from.
  const rules = await listDietaryRules();
  const exclusionSet = await getExclusionSet(rules);
  const allergenRulesExist = hasAllergenRules(rules);
  const dislikedIds = await dislikedCanonicalIds(rules);
  const scoreContext = buildDishScoreContext(
    bucketed,
    remaining,
    personalisation,
    localDate,
    dislikedIds,
    tonightPreference,
  );

  const urgentStock = [...stock.full]
    .filter((line) => line.bucket !== 'available')
    .map((line) => ({ canonicalId: line.canonicalId, qtyRemaining: null }));
  const fingerprint = computeFingerprint({
    urgentStock,
    remainingCalories: remaining,
    recentlyEaten: personalisation.recentlyEaten,
  });

  if (!context.forceRefresh) {
    const cached = await getSuggestionCache(
      localDate,
      context.mode,
      targetMacro ?? null,
      tonightPreference,
    );
    if (
      cached && cached.fingerprint === fingerprint &&
      sameMacroGapContext(cached.macroGapContext, macroGapContext ?? null)
    ) {
      return {
        status: 'ready',
        set: reselect(cached, context.mode, scoreContext, exclusionSet, allergenRulesExist),
        fromCache: true,
      };
    }
  }

  if (!(await hasApiKey())) {
    return { status: 'no_key' };
  }

  try {
    const result = await generateSuggestions({
      mode: context.mode,
      targetMacro,
      macroGapContext,
      stock,
      personalisation,
      remainingCalories: remaining,
      macroGap,
      tonightPreference,
      untilDate: context.untilDate,
      dietaryRules: rules,
      exclusionSet,
      hasAllergenRules: allergenRulesExist,
    });
    const stretch =
      context.mode === 'stretch' && context.untilDate
        ? {
            dinners: result.suggestions,
            shortfall: result.shortfall,
            untilDate: context.untilDate,
          }
        : null;
    // "Tonight" caches the whole eligible pool and derives the displayed
    // set from it (task 7). Stretch mode is untouched by the scorer — its
    // dinners already live inside `stretch`, so pool and displayed both
    // stay empty for that row (design's "leave stretch mode alone").
    const pool = context.mode === 'stretch' ? [] : result.suggestions;
    const displayed = context.mode === 'stretch'
      ? []
      : selectDisplayed(pool, scoreContext, DISPLAYED_COUNT)
        .map((suggestion) => decorateSuggestionForDisplay(suggestion, scoreContext));
    const set = await saveSuggestionCache(
      localDate,
      context.mode,
      targetMacro ?? null,
      tonightPreference,
      fingerprint,
      displayed,
      stretch,
      result.droppedForConstraint,
      pool,
      result.droppedForDiet,
      macroGapContext ?? null,
    );
    return { status: 'ready', set, fromCache: false };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Suggestions failed.',
    };
  }
}

/**
 * Re-derives the displayed set from a cached pool rather than trusting the
 * stored one (task 7.3/7.4): selection is free, so a newly recorded rule or
 * a corrected dislike takes effect on the next read with no request. Dietary
 * exclusion is re-applied to the cached pool first — not just re-ranked —
 * so a newly recorded allergen removes a violating suggestion immediately
 * (task 9.5), and `droppedForDiet` is recomputed against the *current*
 * rules to match. A row cached before `add-dish-scorer` carries no pool —
 * `getSuggestionCache` already treats that as a pool equal to its old
 * displayed set (task 7.2), so re-selecting from it is a same-three
 * reorder, not a behaviour change. Stretch mode is untouched; its dinners
 * never went through the scorer or the exclusion check.
 */
function reselect(
  cached: SuggestionSet,
  mode: SuggestionMode,
  scoreContext: DishScoreContext,
  exclusionSet: ExclusionSet,
  allergenRulesExist: boolean,
): SuggestionSet {
  if (mode === 'stretch' || cached.pool.length === 0) return cached;
  const eligible = cached.pool.filter(
    (suggestion) => !applyDietary(suggestion, exclusionSet, allergenRulesExist).excluded,
  );
  return {
    ...cached,
    tonightPreference: scoreContext.tonightPreference ?? null,
    suggestions: selectDisplayed(eligible, scoreContext, DISPLAYED_COUNT)
      .map((suggestion) => decorateSuggestionForDisplay(suggestion, scoreContext)),
    droppedForDiet: cached.pool.length - eligible.length,
  };
}

function sameMacroGapContext(
  cached: MacroGapContext | null,
  current: MacroGapContext | null,
): boolean {
  if (cached === null || current === null) return cached === current;
  return cached.shortfallG === current.shortfallG &&
    cached.bestAchievableG === current.bestAchievableG &&
    cached.partialCoverage === current.partialCoverage;
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
 * One completed-dish value per nutrient. A provider estimate is a whole-dish
 * fallback, so it is used only when the corresponding local recipe total is
 * not defensible; it is never added on top of local ingredients.
 */
export function nutritionFromSuggestion(
  suggestion: Suggestion,
  canonicals: ReadonlyMap<string, CanonicalItem>,
): Macros {
  const totals: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const unresolved = new Set<keyof Pick<Macros, 'calories' | 'proteinG' | 'carbsG' | 'fatG'>>();

  for (const use of suggestion.uses) {
    const canonical = canonicals.get(use.canonicalId);
    const nutrition = canonical ? catalogueNutrition(canonical, use.qty, use.unit) : null;
    for (const key of ['calories', 'proteinG', 'carbsG', 'fatG'] as const) {
      const value = nutrition?.values[key];
      if (value === null || value === undefined) {
        unresolved.add(key);
      } else if (!unresolved.has(key)) {
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }

  if (suggestion.missing.length > 0) {
    unresolved.add('calories');
    unresolved.add('proteinG');
    unresolved.add('carbsG');
    unresolved.add('fatG');
  }

  const estimate = suggestion.estimatedNutritionPerServing;
  const servings = Math.max(1, suggestion.servings);
  return {
    calories: unresolved.has('calories')
      ? estimate?.calories ?? null
      : (totals.calories ?? 0) / servings,
    proteinG: unresolved.has('proteinG')
      ? estimate?.proteinG ?? null
      : (totals.proteinG ?? 0) / servings,
    carbsG: unresolved.has('carbsG')
      ? estimate?.carbsG ?? null
      : (totals.carbsG ?? 0) / servings,
    fatG: unresolved.has('fatG')
      ? estimate?.fatG ?? null
      : (totals.fatG ?? 0) / servings,
  };
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

  const nutrition = nutritionFromSuggestion(input.suggestion, input.canonicals);
  const items: NewMealItem[] = [
    {
      name: input.suggestion.dish,
      quantity: 1,
      unit: 'serving',
      calories: nutrition.calories,
      proteinG: nutrition.proteinG,
      carbsG: nutrition.carbsG,
      fatG: nutrition.fatG,
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
