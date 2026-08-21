import type { Suggestion } from '@/types';

/**
 * Everything the swipe card renders that is a decision rather than a layout.
 *
 * Kept out of the component so the four calorie-fit states, the three prep
 * tiers, and the pantry coverage bands can be tested under Node — the
 * components themselves are never rendered by the test runner.
 */

export type PrepSpeed = 'quick' | 'medium' | 'slow';

const QUICK_MAX_MINUTES = 20;
const MEDIUM_MAX_MINUTES = 45;

export const PREP_SPEED_LABELS: Record<PrepSpeed, string> = {
  quick: 'Quick',
  medium: 'Medium',
  slow: 'Slow',
};

export function prepSpeed(effortMinutes: number): PrepSpeed {
  if (!Number.isFinite(effortMinutes) || effortMinutes <= QUICK_MAX_MINUTES) return 'quick';
  return effortMinutes <= MEDIUM_MAX_MINUTES ? 'medium' : 'slow';
}

/**
 * The four badge states from the spec, plus `unknown` for the honest case
 * where no daily target has been set and there is nothing to fit against.
 * Exactly one is ever returned, so a card can never show two badges.
 */
export type CalorieFitKind =
  | 'exact-fit'
  | 'fits-budget'
  | 'over-budget'
  | 'estimated'
  | 'unknown';

export interface CalorieFit {
  kind: CalorieFitKind;
  /** Short text on the badge itself. */
  label: string;
  /** Spoken meaning, so a screen reader never reads the icon. */
  accessibilityLabel: string;
  /** The calorie figure as displayed, tilde-prefixed when it is an estimate. */
  calorieLabel: string;
  /** Rounded kcal above the remaining allowance; 0 unless over budget. */
  overBy: number;
}

/** Within this distance of the remaining allowance a meal is an exact fit. */
export const EXACT_FIT_TOLERANCE_KCAL = 75;

export function calorieFit(input: {
  mealCalories: number;
  remainingCalories: number | null;
  estimated: boolean;
}): CalorieFit {
  const kcal = Math.round(input.mealCalories);
  // An unconfirmed number cannot be judged against a budget, so incomplete
  // nutrition takes precedence over every fit state.
  if (input.estimated) {
    return {
      kind: 'estimated',
      label: 'Estimated',
      accessibilityLabel: `Estimated, about ${kcal} calories`,
      calorieLabel: `~${kcal} kcal`,
      overBy: 0,
    };
  }
  if (input.remainingCalories === null || !Number.isFinite(input.remainingCalories)) {
    return {
      kind: 'unknown',
      label: 'Per serving',
      accessibilityLabel: `${kcal} calories per serving`,
      calorieLabel: `${kcal} kcal`,
      overBy: 0,
    };
  }
  const delta = Math.round(input.mealCalories - input.remainingCalories);
  if (Math.abs(delta) <= EXACT_FIT_TOLERANCE_KCAL) {
    return {
      kind: 'exact-fit',
      label: 'Exact fit',
      accessibilityLabel: `Exact fit, ${kcal} calories`,
      calorieLabel: `${kcal} kcal`,
      overBy: 0,
    };
  }
  if (delta < 0) {
    return {
      kind: 'fits-budget',
      label: 'Fits budget',
      accessibilityLabel: `Fits budget, ${kcal} calories`,
      calorieLabel: `${kcal} kcal`,
      overBy: 0,
    };
  }
  return {
    kind: 'over-budget',
    label: `+${delta} kcal over`,
    accessibilityLabel: `Over budget by ${delta} calories`,
    calorieLabel: `${kcal} kcal`,
    overBy: delta,
  };
}

export type PantryCoverage = 'full' | 'partial' | 'low';

/** Under half on hand is the point the card starts signalling a shop. */
export function pantryCoverage(held: number, total: number): PantryCoverage {
  if (total <= 0 || held >= total) return 'full';
  return held * 2 >= total ? 'partial' : 'low';
}

export function pantryLabel(held: number, total: number): string {
  return `${held}/${total} on hand`;
}

export function pantryAccessibilityLabel(held: number, total: number): string {
  const missing = Math.max(0, total - held);
  if (missing === 0) return `All ${total} ingredients on hand`;
  return `${held} of ${total} ingredients on hand, ${missing} to buy`;
}

/** "1 meal remaining", never "1 meals remaining". */
export function remainingLabel(count: number): string {
  return count === 1 ? '1 meal remaining' : `${count} meals remaining`;
}

/**
 * A dish name is the only cuisine signal a suggestion carries — the model
 * returns no category field. This is a deliberately small, additive lexicon:
 * an unrecognised dish returns null and the pill is simply not rendered,
 * which is the specified behaviour. It never guesses from one weak token.
 */
const CUISINE_TERMS: readonly (readonly [string, readonly string[]])[] = [
  ['Japanese', ['ramen', 'donburi', 'teriyaki', 'katsu', 'miso', 'udon', 'yakisoba', 'onigiri', 'sushi']],
  ['Thai', ['pad thai', 'green curry', 'red curry', 'tom yum', 'larb', 'massaman']],
  ['Chinese', ['stir-fry', 'stir fry', 'chow mein', 'mapo', 'dumpling', 'char siu', 'kung pao']],
  ['Korean', ['bibimbap', 'bulgogi', 'kimchi', 'gochujang', 'japchae']],
  ['Indian', ['dal', 'daal', 'curry', 'masala', 'korma', 'biryani', 'saag', 'tikka']],
  ['Italian', ['pasta', 'risotto', 'gnocchi', 'lasagne', 'lasagna', 'carbonara', 'bolognese', 'pizza', 'pesto']],
  ['Mexican', ['taco', 'burrito', 'quesadilla', 'enchilada', 'fajita', 'tostada', 'chilli con carne']],
  ['Middle Eastern', ['shakshuka', 'falafel', 'shawarma', 'tagine', 'hummus', 'kofta']],
  ['Vietnamese', ['pho', 'banh mi', 'bun cha']],
  ['Greek', ['souvlaki', 'moussaka', 'gyros', 'tzatziki']],
  ['Spanish', ['paella', 'tortilla espanola', 'patatas bravas']],
  ['French', ['ratatouille', 'gratin', 'cassoulet', 'bourguignon']],
];

export function detectCuisine(dish: string): string | null {
  const haystack = dish.toLowerCase();
  for (const [cuisine, terms] of CUISINE_TERMS) {
    if (terms.some((term) => haystack.includes(term))) return cuisine;
  }
  return null;
}

/**
 * Held versus total for the card's pantry badge. When the caller passes the
 * live on-hand set, a card that was generated before a cook depleted the
 * pantry re-counts against current stock rather than its own stale `uses`.
 */
export function pantryStatusFor(
  meal: Suggestion,
  onHandCanonicalIds?: ReadonlySet<string>,
): { held: number; total: number } {
  const total = meal.uses.length + meal.missing.length;
  if (!onHandCanonicalIds) return { held: meal.uses.length, total };
  return { held: meal.uses.filter((use) => onHandCanonicalIds.has(use.canonicalId)).length, total };
}
