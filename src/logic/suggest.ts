import { differenceInCalendarDays } from 'date-fns';

import { localDateString, parseLocalDate } from '@/logic/dates';
import { isFreezable, type ShelfLife } from '@/logic/expiry';
import { daysUntil } from '@/logic/stockStatus';
import type {
  CanonicalItem,
  FoodClass,
  MealWithItems,
  PantryItem,
  UrgencyBucket,
} from '@/types';

/**
 * The dinner decision's pure core (decisions 33–41). Urgency scoring,
 * stock bucketing, and payload shaping — everything a fixture corpus can
 * check without a model in the loop.
 *
 * Reads stock through the full `PantryItem` (`qtyRemaining`, `priceCents`),
 * not through the pantry view model. `PantryEntry` deliberately omits both
 * so no screen can render an indefensible number — decision 15 constrains
 * what is *displayed*, not what is *computed*. This engine computes with
 * them and renders neither; a reason chip says "saves $8 of stock", a price
 * the user actually paid, never an estimated remaining mass.
 */

/** Expires within this many days: the hard constraint every suggestion must clear. */
export const USE_FIRST_DAYS = 3;
/** Expires within this many days: preferred where it fits, not required. */
export const USE_SOON_DAYS = 10;
/**
 * The value assumed for an item with no recorded price, so an unpriced
 * item still contributes to ranking rather than vanishing from it. A guess,
 * like the match and status thresholds — named so tuning is one edit.
 */
export const DEFAULT_VALUE_CENTS = 500;
/** Freezable stock is rescuable without cooking, so it counts for less. */
export const FREEZABLE_DISCOUNT = 0.5;

/**
 * The engine asks for this many candidates in "tonight" mode and displays
 * `DISPLAYED_COUNT` of them, chosen by `dishScore.ts` (decision 149,
 * `add-dish-scorer`). A scorer over exactly the number shown cannot exclude
 * anything — over-generation is what gives ranking something to do. Stretch
 * mode is unaffected; it selects a covering set, a different problem.
 */
export const CANDIDATE_POOL_SIZE = 10;
/** How many of the pool are actually shown. */
export const DISPLAYED_COUNT = 3;

export type UrgencyItem = Pick<PantryItem, 'expiresAt' | 'priceCents'>;

/**
 * `urgency = f(days_remaining) × value_at_risk × (freezable ? 0.5 : 1)`.
 *
 * `f` decays from 1 the moment something expires toward 0 as its date
 * recedes, so an already-expired item is the most urgent thing in the
 * kitchen and a distant date barely registers. Value at risk means a
 * $8 protein outranks a 40-cent vegetable expiring the same day, and the
 * freeze discount means a rescuable item does not crowd out one that
 * genuinely cannot wait.
 */
export function urgency(
  item: UrgencyItem,
  canonical: ShelfLife,
  today?: string,
): number {
  const daysLeft = daysUntil(item.expiresAt, today);
  if (daysLeft === null) return 0;

  const decay = 1 / (1 + Math.max(daysLeft, 0));
  const value = item.priceCents ?? DEFAULT_VALUE_CENTS;
  const discount = isFreezable(canonical) ? FREEZABLE_DISCOUNT : 1;
  return decay * value * discount;
}

/** Which bucket an item's remaining days place it in (decision 34's table). */
export function bucketFor(daysLeft: number | null): UrgencyBucket {
  if (daysLeft === null) return 'available';
  if (daysLeft <= USE_FIRST_DAYS) return 'use_first';
  if (daysLeft <= USE_SOON_DAYS) return 'use_soon';
  return 'available';
}

export interface BucketedItem {
  item: PantryItem;
  canonical: CanonicalItem;
  bucket: UrgencyBucket;
  urgencyScore: number;
}

/**
 * Buckets every in-stock item and ranks each bucket by urgency, descending.
 * A stated bucket, not a sorted list — decision 34: models do not reliably
 * read list position as priority, and the hard `use_first` constraint is
 * what actually produces the behaviour a sorted list only hopes for.
 */
export function bucketStock(
  items: readonly PantryItem[],
  canonicals: ReadonlyMap<string, CanonicalItem>,
  today?: string,
): Record<UrgencyBucket, BucketedItem[]> {
  const result: Record<UrgencyBucket, BucketedItem[]> = {
    use_first: [],
    use_soon: [],
    available: [],
  };

  for (const item of items) {
    const canonical = canonicals.get(item.canonicalId);
    if (!canonical) continue;
    const daysLeft = daysUntil(item.expiresAt, today);
    const bucket = bucketFor(daysLeft);
    result[bucket].push({
      item,
      canonical,
      bucket,
      urgencyScore: urgency(item, canonical, today),
    });
  }

  for (const bucket of Object.values(result)) {
    bucket.sort((a, b) => b.urgencyScore - a.urgencyScore);
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Payload shaping                                                            */
/* -------------------------------------------------------------------------- */

/** Classes sent in full regardless of bucket — the payload's "protein and produce" carve-out. */
const ALWAYS_FULL_CLASSES: readonly FoodClass[] = [
  'protein',
  'produce',
  'dairy',
  'frozen',
  'beverage',
];

export interface StockLine {
  canonicalId: string;
  displayName: string;
  bucket: UrgencyBucket;
  daysLeft: number | null;
  priceCents: number | null;
  freezable: boolean;
}

export interface StockPayload {
  /** Full detail: every use_first/use_soon item, plus proteins and produce. */
  full: StockLine[];
  /**
   * Available staples and seasonings, named but not detailed — the model
   * is told it can lean on them, not that there are exactly 340 g left.
   * Still carries `canonicalId`, because "compressed" is about the level
   * of detail sent, not about whether the ingredient can be used: a
   * suggestion citing gochujang in `uses` needs its id regardless of which
   * list it travelled in.
   */
  compressed: StockLine[];
  /** Available staples, compressed to names — "assume present". */
  staplesSummary: string[];
  /** Available seasonings and condiments, as one descriptive line. */
  seasoningsSummary: string;
}

/**
 * Shapes bucketed stock into the model payload. Sending the whole pantry is
 * expensive and dilutes attention across forty spices that were never the
 * point — urgent and fresh stock goes in full, the rest compresses.
 */
export function shapeStockPayload(
  bucketed: Record<UrgencyBucket, BucketedItem[]>,
): StockPayload {
  const full: StockLine[] = [];
  const compressed: StockLine[] = [];
  const staples = new Set<string>();
  const seasonings = new Set<string>();

  for (const bucket of Object.values(bucketed)) {
    for (const entry of bucket) {
      const { item, canonical } = entry;
      const line: StockLine = {
        canonicalId: canonical.id,
        displayName: canonical.displayName,
        bucket: entry.bucket,
        daysLeft: daysUntil(item.expiresAt),
        priceCents: item.priceCents,
        freezable: isFreezable(canonical),
      };

      if (entry.bucket !== 'available') {
        full.push(line);
        continue;
      }
      if (ALWAYS_FULL_CLASSES.includes(canonical.foodClass)) {
        full.push(line);
      } else if (canonical.foodClass === 'staple') {
        staples.add(canonical.displayName);
        compressed.push(line);
      } else {
        seasonings.add(canonical.displayName);
        compressed.push(line);
      }
    }
  }

  return {
    full,
    compressed,
    staplesSummary: [...staples],
    seasoningsSummary:
      seasonings.size > 0
        ? `well stocked on: ${[...seasonings].join(', ')}`
        : 'no seasonings catalogued',
  };
}

/* -------------------------------------------------------------------------- */
/* Personalisation                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Keyword tags for a lightweight local cuisine lean, matched against dish
 * names. Deliberately simple — a full classifier is out of scope, and a
 * keyword match over the user's own naming is enough to stop suggestions
 * drifting away from what they actually cook. Exported so it can grow.
 */
export const CUISINE_KEYWORDS: Readonly<Record<string, string>> = {
  gochujang: 'Korean',
  kimchi: 'Korean',
  bulgogi: 'Korean',
  ramen: 'Japanese',
  miso: 'Japanese',
  teriyaki: 'Japanese',
  sushi: 'Japanese',
  soy: 'Asian',
  'stir fry': 'Asian',
  'stir-fry': 'Asian',
  wok: 'Asian',
  curry: 'South Asian',
  dal: 'South Asian',
  tikka: 'South Asian',
  taco: 'Mexican',
  burrito: 'Mexican',
  quesadilla: 'Mexican',
  pasta: 'Italian',
  risotto: 'Italian',
  pizza: 'Italian',
  pho: 'Vietnamese',
  banh: 'Vietnamese',
};

/** Recently-eaten suppression window (decision 37). */
export const RECENTLY_EATEN_DAYS = 7;
/** History window for cuisine lean and frequent dishes. */
export const HISTORY_WINDOW_DAYS = 60;
/** A dish cooked at least this many times counts as a repeat. */
export const REPEAT_THRESHOLD = 2;

export interface PersonalisationSummary {
  /** e.g. "Korean (6 of 20 dinners)". Null when no keyword lean is detectable. */
  cuisineLean: string | null;
  /** The bare cuisine name behind `cuisineLean` (e.g. "Korean"), for scoring rather than display. */
  topCuisine: string | null;
  /** Dish names cooked at least `REPEAT_THRESHOLD` times in the window. */
  frequentDishes: string[];
  /** Dish names logged within `RECENTLY_EATEN_DAYS`. Suppress, do not suggest. */
  recentlyEaten: string[];
}

/**
 * Summarises meal history into signals, computed locally and passed as
 * summaries rather than raw history — cheaper, and the user's full eating
 * record never has to leave the device for this feature to work.
 */
export function summarisePersonalisation(
  meals: readonly MealWithItems[],
  today: string = localDateString(),
): PersonalisationSummary {
  const homeCooked = meals.filter((meal) => meal.venue === 'home');

  const cuisineCounts = new Map<string, number>();
  const dishCounts = new Map<string, number>();
  const recentlyEaten = new Set<string>();

  for (const meal of homeCooked) {
    const name = meal.name.trim();
    if (name.length === 0) continue;
    dishCounts.set(name, (dishCounts.get(name) ?? 0) + 1);

    const lower = name.toLowerCase();
    for (const [keyword, cuisine] of Object.entries(CUISINE_KEYWORDS)) {
      if (lower.includes(keyword)) {
        cuisineCounts.set(cuisine, (cuisineCounts.get(cuisine) ?? 0) + 1);
      }
    }

    const daysAgo = differenceInCalendarDays(
      parseLocalDate(today),
      parseLocalDate(meal.localDate),
    );
    if (daysAgo >= 0 && daysAgo < RECENTLY_EATEN_DAYS) {
      recentlyEaten.add(name);
    }
  }

  let cuisineLean: string | null = null;
  let topCuisine: string | null = null;
  if (cuisineCounts.size > 0 && homeCooked.length > 0) {
    const [leadingCuisine, count] = [...cuisineCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0]!;
    topCuisine = leadingCuisine;
    cuisineLean = `${leadingCuisine} (${count} of ${homeCooked.length} dinners)`;
  }

  const frequentDishes = [...dishCounts.entries()]
    .filter(([, count]) => count >= REPEAT_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return {
    cuisineLean,
    topCuisine,
    frequentDishes,
    recentlyEaten: [...recentlyEaten],
  };
}

/* -------------------------------------------------------------------------- */
/* Caching                                                                     */
/* -------------------------------------------------------------------------- */

export interface FingerprintInput {
  /** Every use_first / use_soon item's id and remaining amount. */
  urgentStock: { canonicalId: string; qtyRemaining: number | null }[];
  remainingCalories: number;
  recentlyEaten: readonly string[];
}

/**
 * A stable hash over the inputs that would change the answer: urgent
 * stock, remaining calories, and recently-eaten dishes (decision 40).
 *
 * A pure date key would miss stock consumed during the day; regenerating
 * on every open would defeat the point of caching. This answers "has
 * anything material changed" without re-deriving the whole payload —
 * reuse when it matches, regenerate when it does not.
 */
export function computeFingerprint(input: FingerprintInput): string {
  const stable = JSON.stringify({
    urgent: [...input.urgentStock]
      .sort((a, b) => a.canonicalId.localeCompare(b.canonicalId))
      .map((entry) => `${entry.canonicalId}:${entry.qtyRemaining ?? 'null'}`),
    // Rounded so a one-calorie fluctuation from rounding elsewhere does not
    // spuriously invalidate the cache; a logged meal moves this by far more.
    calories: Math.round(input.remainingCalories / 10) * 10,
    recentlyEaten: [...input.recentlyEaten].sort(),
  });
  return djb2(stable);
}

/** Dependency-free string hash — no crypto import needed for a cache key. */
function djb2(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
