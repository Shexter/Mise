/** Shared domain types. Mirrors the SQLite schema in `src/db/schema.ts`. */

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type Goal = 'lose' | 'maintain' | 'gain';

export type Units = 'metric' | 'imperial';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type MealSource = 'photo' | 'manual' | 'suggestion' | 'recipe';

/**
 * Where a meal came from, and therefore whether it debits the pantry.
 *
 * One closed field rather than two booleans (decisions 10 and 11): the
 * servings multiplier debits the whole batch when it is cooked, so eating
 * the remaining portions must debit nothing. Modelling leftovers as a venue
 * makes the incoherent combination — a leftovers meal that also claims to
 * have produced four servings — impossible to express.
 */
export type MealVenue = 'home' | 'out' | 'leftovers';

/** What the photo estimator can infer from the setting itself. Leftovers are
 * a local history signal, not something a plate photograph can establish. */
export type VenueAssessment = Exclude<MealVenue, 'leftovers'>;

export const MEAL_VENUES: readonly MealVenue[] = ['home', 'out', 'leftovers'];

export type Confidence = 'high' | 'medium' | 'low';

export type MeasureUnit =
  | 'g'
  | 'ml'
  | 'piece'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'slice'
  | 'serving';

export const MEASURE_UNITS: readonly MeasureUnit[] = [
  'g',
  'ml',
  'piece',
  'cup',
  'tbsp',
  'tsp',
  'slice',
  'serving',
];

export const MEAL_TYPES: readonly MealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
];

export type TargetSource = 'estimated' | 'dexa' | 'inbody' | 'stated';
export const TARGET_SOURCES: readonly TargetSource[] = ['estimated', 'dexa', 'inbody', 'stated'];
export type StatedFigureKind = 'resting' | 'total' | 'adjusted';
export const STATED_FIGURE_KINDS: readonly StatedFigureKind[] = ['resting', 'total', 'adjusted'];
export type MeasurementProvider = Extract<TargetSource, 'dexa' | 'inbody'>;

/** One current scan per provider; values are retained in the provider's own terms. */
export interface BodyMeasurement {
  provider: MeasurementProvider;
  weightKg: number;
  measuredAt: string;
  bodyFatPct: number | null;
  leanTissueKg: number | null;
  boneMineralContentKg: number | null;
  fatFreeMassKg: number;
}

export interface Profile {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetCalories: number;
  targetSource: TargetSource;
  statedCalories: number | null;
  statedFigureKind: StatedFigureKind | null;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  /** Absolute user-owned daily target; not derived from the calorie split. */
  fibreTargetG: number;
  units: Units;
  onboardedAt: string;
}

export interface MealItem {
  id: string;
  mealId: string;
  name: string;
  quantity: number;
  unit: MeasureUnit;
  /** Calories for the whole row, i.e. already multiplied by `quantity`. */
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** Null when this item predates tracking or its estimate omitted it. */
  fibreG: number | null;
  isManualAddition: boolean;
  sortOrder: number;
  /**
   * The exact ingredient this item means, when the source already knows it
   * — a cooked dinner suggestion states its ingredients precisely. Null
   * means "resolve by name", which is every other source's honest state: a
   * photograph produces "soy sauce" and genuinely cannot say which bottle.
   * Depletion prefers this over name matching whenever it is present.
   */
  canonicalId: string | null;
}

export interface Meal {
  id: string;
  loggedAt: string;
  localDate: string;
  mealType: MealType;
  name: string;
  photoUri: string | null;
  source: MealSource;
  confidence: Confidence | null;
  venue: MealVenue;
  /** How many servings the cooking produced. Always 1 for non-home venues. */
  servingsMult: number;
  createdAt: string;
}

export interface MealWithItems extends Meal {
  items: MealItem[];
}

/* -------------------------------------------------------------------------- */
/* Saved recipes                                                               */
/* -------------------------------------------------------------------------- */

/** A locally saved recipe the user brought into Mise. */
export interface Recipe {
  id: string;
  title: string;
  /** Original post or page, if the recipe arrived with one. Never fetched. */
  sourceLink: string | null;
  /** Kept only for the user's own reference; never published or shared. */
  steps: readonly string[];
  /** A locally stored screenshot, if this recipe arrived from an image. */
  imageUri: string | null;
  /** A bare shared link remains useful while its content is still missing. */
  status: 'awaiting_content' | 'ready';
  createdAt: string;
  updatedAt: string;
}

/** One ingredient as the recipe stated it. Missing quantity is intentional. */
export interface RecipeIngredient {
  id: string;
  recipeId: string;
  name: string;
  quantity: number | null;
  unit: MeasureUnit | null;
  /** Null means the ingredient could not be safely resolved yet. */
  canonicalId: string | null;
  sortOrder: number;
}

export interface RecipeWithIngredients extends Recipe {
  ingredients: readonly RecipeIngredient[];
}

/* -------------------------------------------------------------------------- */
/* Shopping list                                                              */
/* -------------------------------------------------------------------------- */

export type ShoppingListStatus = 'open' | 'purchased' | 'snoozed' | 'dismissed';
export const SHOPPING_LIST_STATUSES: readonly ShoppingListStatus[] = [
  'open',
  'purchased',
  'snoozed',
  'dismissed',
];

export type ShoppingListSourceKind =
  | 'pantry_low'
  | 'pantry_out'
  | 'recipe_missing'
  | 'suggestion_missing'
  | 'manual';

export const SHOPPING_LIST_SOURCE_KINDS: readonly ShoppingListSourceKind[] = [
  'pantry_low',
  'pantry_out',
  'recipe_missing',
  'suggestion_missing',
  'manual',
];

export type ShoppingListCategory = FoodClass | 'other';

export interface ShoppingListItem {
  id: string;
  canonicalId: string | null;
  displayName: string;
  normalizedName: string;
  status: ShoppingListStatus;
  requestedQty: number | null;
  requestedUnit: MeasureUnit | null;
  note: string | null;
  category: ShoppingListCategory;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  sources: ShoppingListSource[];
}

export interface ShoppingListSource {
  id: string;
  shoppingItemId: string;
  kind: ShoppingListSourceKind;
  sourceId: string | null;
  recipeId: string | null;
  suggestionId: string | null;
  createdAt: string;
}

export interface ShoppingListReceiptMatch {
  id: string;
  shoppingItemId: string;
  receiptId: string;
  receiptLineId: string;
  previousStatus: ShoppingListStatus;
  matchedAt: string;
  undoneAt: string | null;
}

export interface ShoppingListSection {
  category: ShoppingListCategory;
  label: string;
  items: ShoppingListItem[];
}

export interface Macros {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fibreG: number | null;
}

export interface DailyTarget {
  localDate: string;
  targetCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
}

/** One logged day's calendar summary. Missing days have no object at all. */
export interface DaySummary {
  localDate: string;
  /** Null when any logged meal on the day has unknown calories. */
  calories: number | null;
  /** The target snapshotted for that day; null means no comparison is honest. */
  targetCalories: number | null;
}

/** A hidden-ingredient quick-pick, loaded from `assets/hidden-ingredients.json`. */
export interface HiddenIngredient {
  name: string;
  defaultQuantity: number;
  unit: MeasureUnit;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG?: number | null;
  /** Links the quick-pick to its canonical ingredient, where one exists. */
  canonicalId?: string;
}

/* -------------------------------------------------------------------------- */
/* Ingredient identity                                                         */
/* -------------------------------------------------------------------------- */

/** How an ingredient depletes. Orthogonal to where it is stored. */
export type FoodClass =
  | 'staple'
  | 'produce'
  | 'protein'
  | 'dairy'
  | 'seasoning'
  | 'condiment'
  | 'frozen'
  | 'beverage';

export const FOOD_CLASSES: readonly FoodClass[] = [
  'staple',
  'produce',
  'protein',
  'dairy',
  'seasoning',
  'condiment',
  'frozen',
  'beverage',
];

/** Where an ingredient lives by default. Drives expiry, never depletion. */
export type StorageLocation = 'pantry' | 'fridge' | 'freezer' | 'counter';

export const STORAGE_LOCATIONS: readonly StorageLocation[] = [
  'pantry',
  'fridge',
  'freezer',
  'counter',
];

/** The channel a food reference or alias came from. */
export type ReferenceSource =
  | 'seed'
  | 'barcode'
  | 'receipt'
  | 'vision'
  | 'meal_log'
  | 'user'
  | 'dietary'
  | 'dataset';

export const REFERENCE_SOURCES: readonly ReferenceSource[] = [
  'seed',
  'barcode',
  'receipt',
  'vision',
  'meal_log',
  'user',
  'dietary',
  'dataset',
];

/** Provenance for values committed into the shipped canonical catalogue. */
export type SourceId =
  | 'hand-authored'
  | 'foodkeeper'
  | 'food-data-central'
  | 'cofid';

export const SOURCE_IDS: readonly SourceId[] = [
  'hand-authored',
  'foodkeeper',
  'food-data-central',
  'cofid',
];

/** The food concept — one row per real-world ingredient. `id` is the slug. */
export interface CanonicalItem {
  id: string;
  displayName: string;
  foodClass: FoodClass;
  defaultLocation: StorageLocation;
  /** Unopened shelf life in days, keyed by location. */
  shelfLifeDays: Partial<Record<StorageLocation, number>>;
  /** Remaining-days threshold at which an item enters `use_soon`. */
  earlyWarningDays: number | null;
  /** Days once opened; null where opening changes nothing. */
  openLifeDays: number | null;
  /** Per-field origin for catalogue values. */
  sources: Partial<Record<string, SourceId>>;
  /** Generic ingredient nutrition per 100 g; null means unknown. */
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
  typicalUseQty: number | null;
  typicalUseUnit: MeasureUnit | null;
  typicalPkgQty: number | null;
  typicalPkgUnit: MeasureUnit | null;
  densityGPerMl: number | null;
  isSeed: boolean;
  createdAt: string;
}

/** One observed name for a canonical ingredient. */
export interface ItemAlias {
  id: string;
  aliasNorm: string;
  aliasRaw: string;
  canonicalId: string;
  source: ReferenceSource;
  locale: string | null;
  confidence: number;
  timesConfirmed: number;
  createdAt: string;
}

/** A specific purchasable SKU, always tied to one canonical ingredient. */
export interface Product {
  id: string;
  gtin: string | null;
  brand: string | null;
  name: string;
  pkgQty: number | null;
  pkgUnit: MeasureUnit | null;
  /** Explicit SKU container count; null means the source did not state one. */
  containerCount: number | null;
  canonicalId: string;
  kcalPer100: number | null;
  proteinPer100: number | null;
  carbsPer100: number | null;
  fatPer100: number | null;
  source: ReferenceSource;
  fetchedAt: string | null;
  /** Updated only by a successful barcode recognition, never by opening review. */
  lastScannedAt: string | null;
}

/** A valid GTIN that the remote product catalogue did not recognise. */
export interface BarcodeMiss {
  gtin: string;
  fetchedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Pantry stock                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The closed set the shelf-life lookup keys off. Location *names* are free
 * text the user owns; a "Chest freezer" and a "Garage freezer" are both kind
 * `freezer` and get freezer shelf life without the lookup knowing either name.
 */
export type LocationKind = 'fridge' | 'freezer' | 'ambient' | 'counter';

export const LOCATION_KINDS: readonly LocationKind[] = [
  'fridge',
  'freezer',
  'ambient',
  'counter',
];

/** A storage location. User-editable; four defaults ship with the schema. */
export interface Location {
  id: string;
  name: string;
  kind: LocationKind;
  sortOrder: number;
}

/** The four-bucket fullness for uses-tracked items (decision 14). */
export type Fullness = 'full' | 'half' | 'low' | 'out';

export const FULLNESS_LEVELS: readonly Fullness[] = [
  'full',
  'half',
  'low',
  'out',
];

/**
 * Advisory only (decision 15) — never rendered as a number.
 *
 * `replaced` is distinct from `discarded`: a receipt reconciling against an
 * empty item superseded it with a new purchase, which is not the same claim
 * as the old item being thrown away uneaten (decision 68).
 */
export type StockStatus =
  | 'in_stock'
  | 'running_low'
  | 'out'
  | 'discarded'
  | 'replaced';

export const STOCK_STATUSES: readonly StockStatus[] = [
  'in_stock',
  'running_low',
  'out',
  'discarded',
  'replaced',
];

/** Where an item's expiry date came from. A user or label date is never
 * overwritten by a recompute. */
export type ExpirySource = 'predicted' | 'label' | 'user';

/** Who last set `qtyRemaining`: the user's own entry may be echoed back to
 * them; an estimate must never be displayed. */
export type QuantitySource = 'user' | 'estimate';

/** One physical thing in the kitchen. Three tins are three rows. */
export interface PantryItem {
  id: string;
  canonicalId: string;
  productId: string | null;
  locationId: string;
  qtyRemaining: number | null;
  qtyUnit: MeasureUnit | null;
  qtySource: QuantitySource | null;
  fullness: Fullness | null;
  usesCount: number;
  /** Local date (yyyy-MM-dd) the item was acquired. */
  purchasedAt: string;
  openedAt: string | null;
  expiresAt: string | null;
  expirySource: ExpirySource | null;
  priceCents: number | null;
  photoUri: string | null;
  status: StockStatus;
  /**
   * Estimated decrements applied since the last ground-truth anchor — a
   * receipt, a fullness tap, or a quantity the user entered. A count rather
   * than an error bound, deliberately: a bound would imply a rigour the
   * inputs do not support (decision 53).
   */
  estimatedDecrementsSinceAnchor: number;
  lastAnchorAt: string | null;
  /**
   * Whether the "is the old one finished?" prompt has already been shown
   * for this item. Set the first time a receipt reconciles against it while
   * it is `running_low`, regardless of the answer, so it is asked at most
   * once (decision 68, decision 14's anti-nagging rule).
   */
  replacementAsked: boolean;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Depletion                                                                   */
/* -------------------------------------------------------------------------- */

/** What produced a consumption event. */
export type ConsumptionKind =
  | 'meal_item'
  | 'hidden_ingredient'
  | 'manual'
  | 'correction';

/**
 * One recorded decrement. The ledger is what makes an automatic change
 * explainable and reversible: negating an event is its own undo, which is
 * why editing a meal reverses its events and replays rather than computing
 * a delta.
 */
export interface ConsumptionEvent {
  id: string;
  /** Null where the ingredient was consumed but is not in the catalogue. */
  pantryItemId: string | null;
  canonicalId: string;
  mealId: string | null;
  /** The amount removed, in `unit`. Null where only a use was counted. */
  qty: number | null;
  unit: MeasureUnit | null;
  /** Uses counted against a uses-tracked item, already scaled by servings. */
  uses: number;
  servingsMult: number;
  kind: ConsumptionKind;
  createdAt: string;
}

/** A reference the cascade could not resolve, waiting for review. */
export interface QueuedMatch {
  id: string;
  rawText: string;
  source: ReferenceSource;
  /** JSON captured at scan time: receipt id, price, quantity. */
  context: string | null;
  suggestedId: string | null;
  confidence: number | null;
  createdAt: string;
}

/** A single detected food, as returned by the vision model. */
export interface EstimatedItem {
  name: string;
  quantity: number;
  unit: MeasureUnit;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG?: number | null;
}

/** A parsed, validated vision response. */
export interface MealEstimate {
  mealName: string;
  confidence: Confidence;
  items: EstimatedItem[];
  likelyHiddenIngredients: string[];
  /** Optional so older/provider-omitted responses remain valid estimates. */
  venueAssessment: VenueAssessment | null;
}

/* -------------------------------------------------------------------------- */
/* Dinner decision                                                             */
/* -------------------------------------------------------------------------- */

/** How pressing an in-stock ingredient is to use (decision 34). */
export type UrgencyBucket = 'use_first' | 'use_soon' | 'available';

export const URGENCY_BUCKETS: readonly UrgencyBucket[] = [
  'use_first',
  'use_soon',
  'available',
];

/** One ingredient a suggestion consumes, named by identity, not description. */
export interface SuggestionUse {
  canonicalId: string;
  qty: number;
  unit: MeasureUnit;
}

/** An ingredient a suggestion needs but the kitchen does not have. */
export interface SuggestionMissing {
  canonicalId: string | null;
  /** A free-text name, used when the model named something with no candidate id. */
  name: string;
  note: string | null;
}

/** Why a suggestion was chosen, in the user's own terms. */
export type SuggestionReasonKind =
  | 'clears_stock'
  | 'saves_value'
  | 'fits_calories'
  | 'matches_history'
  | 'matches_template';

export interface SuggestionReason {
  kind: SuggestionReasonKind;
  /** Rendered text, e.g. "saves $8 of stock". */
  label: string;
}

/**
 * An optional provider estimate for the completed dish, expressed per serving.
 * It is never ingredient-level catalogue data and stays labelled as an estimate.
 */
export interface SuggestionNutritionEstimate {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: 'provider';
}

/** A visible serving adjustment derived locally, never a nutrition target. */
export interface SuggestionPortionRecommendation {
  servings: number;
  label: string;
}

/** One idea, never presented as a tested recipe. */
export interface Suggestion {
  dish: string;
  reasons: SuggestionReason[];
  kcalPerServing: number;
  servings: number;
  effortMinutes: number;
  uses: SuggestionUse[];
  missing: SuggestionMissing[];
  method: string[];
  /** Absent on cached suggestions created before macro-gap estimates shipped. */
  estimatedNutritionPerServing?: SuggestionNutritionEstimate | null;
  /** Derived locally for the displayed set; never sent back to a provider. */
  portionRecommendation?: SuggestionPortionRecommendation | null;
}

/** The objective a generated set was produced for. */
export type SuggestionMode = 'tonight' | 'stretch' | 'macro_gap';

export const SUGGESTION_MODES: readonly SuggestionMode[] = ['tonight', 'stretch', 'macro_gap'];
export type SuggestionTargetMacro = 'protein' | 'carbs' | 'fat';

/** A durable, fixed dinner intent. It is not a request mode. */
export type SuggestionBaseIntent =
  | 'balanced'
  | 'use_it_up'
  | 'protein_forward'
  | 'lighter_portions'
  | 'familiar_favourites';

export const SUGGESTION_BASE_INTENTS: readonly SuggestionBaseIntent[] = [
  'balanced',
  'use_it_up',
  'protein_forward',
  'lighter_portions',
  'familiar_favourites',
];

/** An optional time preference that composes with a base intent. */
export type SuggestionPrepSpeed = 'standard' | 'quick';

export const SUGGESTION_PREP_SPEEDS: readonly SuggestionPrepSpeed[] = ['standard', 'quick'];

export type SuggestionPreferenceSource = 'saved' | 'profile_default';

/** The resolved preference a tonight request actually uses. */
export interface TonightSuggestionPreference {
  baseIntent: SuggestionBaseIntent;
  prepSpeed: SuggestionPrepSpeed;
  source: SuggestionPreferenceSource;
}

/** The durable choice, deliberately separate from the profile. */
export interface SavedSuggestionPreference {
  baseIntent: SuggestionBaseIntent;
  prepSpeed: SuggestionPrepSpeed;
  updatedAt: string;
}

/** The locally defensible macro-gap facts that framed a generated set. */
export interface MacroGapContext {
  shortfallG: number;
  bestAchievableG: number;
  partialCoverage: boolean;
}

/** "Make it to Sunday": a plan rather than three independent dishes. */
export interface StretchPlan {
  dinners: Suggestion[];
  /** The honest gap, e.g. "Sunday needs one protein." Null when stock reaches the date. */
  shortfall: string | null;
  untilDate: string;
}

/** A generated, cached set — either tonight's three ideas or a stretch plan. */
export interface SuggestionSet {
  id: string;
  localDate: string;
  mode: SuggestionMode;
  /** Required only for the independently cached macro-gap request. */
  targetMacro: SuggestionTargetMacro | null;
  /** Null for tonight/stretch and cache rows written before macro-gap support. */
  macroGapContext: MacroGapContext | null;
  /** Present only for a tonight request. */
  tonightPreference: TonightSuggestionPreference | null;
  fingerprint: string;
  /** The displayed set — `dishScore.ts`'s top picks from `pool`, in scored order. */
  suggestions: Suggestion[];
  stretch: StretchPlan | null;
  createdAt: string;
  /** How many the local use-first check dropped after parsing (task 11.3). */
  droppedForConstraint: number;
  /**
   * The full eligible candidate pool `suggestions` was selected from
   * (`add-dish-scorer`). Retained so a later change to selection — a
   * recorded dietary rule, a corrected dislike — can re-rank for free,
   * with no new request (task 7.3). Empty for "stretch" mode, which the
   * scorer does not touch, and for cache rows written before this change.
   */
  pool: Suggestion[];
  /**
   * How many `applyDietary` dropped — an allergen or restriction match, or
   * an unresolved ingredient with an allergen rule recorded
   * (`add-dietary-profile` task 6.3). Recomputed against the *current*
   * rules on every read, not just at generation time, so recording a new
   * allergen updates this immediately. Reported separately from
   * `droppedForConstraint`: different sentence, different action.
   */
  droppedForDiet: number;
}

/* -------------------------------------------------------------------------- */
/* Dietary profile                                                            */
/* -------------------------------------------------------------------------- */

/**
 * What a rule costs to get wrong (`add-dietary-profile`'s proposal). Only
 * the user knows which one a given rule is — "no pork" is a restriction for
 * one person and a dislike for another — so the kind is chosen at creation,
 * never inferred from the ingredient.
 */
export type DietaryRuleKind = 'allergen' | 'restriction' | 'dislike';

export const DIETARY_RULE_KINDS: readonly DietaryRuleKind[] = [
  'allergen',
  'restriction',
  'dislike',
];

/** Something the user cannot or will not eat. */
export interface DietaryRule {
  id: string;
  kind: DietaryRuleKind;
  /** Set when the rule resolved to a catalogue ingredient. Null means text-only. */
  canonicalId: string | null;
  /** As the user typed it. */
  text: string;
  /** Fallback match key when `canonicalId` is null — a weaker guarantee, shown as such. */
  normalisedText: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Receipt import                                                              */
/* -------------------------------------------------------------------------- */

/** Only a grocery receipt creates pantry items (decision 11 arriving through a second door). */
export type ReceiptType = 'grocery' | 'restaurant' | 'other';

export const RECEIPT_TYPES: readonly ReceiptType[] = [
  'grocery',
  'restaurant',
  'other',
];

/** Extraction never writes; review commits — `pending` until the review is accepted. */
export type ReceiptStatus = 'pending' | 'applied' | 'discarded';

export const RECEIPT_STATUSES: readonly ReceiptStatus[] = [
  'pending',
  'applied',
  'discarded',
];

/**
 * What kind of line this is, decided by the extraction call itself — the
 * only step with the context to tell an unmatched food from a household
 * good (decision 69). `deposit` and `refund` are money-only, same as
 * `discount` — none of the three is a thing that entered the kitchen.
 */
export type ReceiptLineKind =
  | 'food'
  | 'non_food'
  | 'arithmetic'
  | 'discount'
  | 'deposit'
  | 'refund';

export const RECEIPT_LINE_KINDS: readonly ReceiptLineKind[] = [
  'food',
  'non_food',
  'arithmetic',
  'discount',
  'deposit',
  'refund',
];

/**
 * A count of containers (`2 @ £1.79`) versus a divisible measure
 * (`0.834 kg @ £12.99/kg`) — the two are read differently and create
 * pantry items differently. Null where the line has no quantity at all
 * (non-food, arithmetic, money-only lines).
 */
export type QuantityKind = 'count' | 'measure';

export const QUANTITY_KINDS: readonly QuantityKind[] = ['count', 'measure'];

/** A photographed receipt's header, before its lines resolve or apply. */
export interface Receipt {
  id: string;
  type: ReceiptType;
  store: string | null;
  /** Local date (yyyy-MM-dd). Falls back to the capture date when illegible. */
  purchasedAt: string;
  /** The printed pre-tax total — what the arithmetic check compares the lines against. */
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  imageUri: string;
  status: ReceiptStatus;
  /** A manual review edit makes a frame rebuild unsafe for this draft. */
  frameEditsLocked: boolean;
  createdAt: string;
}

/**
 * One printed line, carrying both what was extracted and what the user made
 * of it — the audit trail decision 21's re-anchoring depends on, and why
 * this is a table rather than a JSON blob on the receipt (design.md).
 */
export interface ReceiptLine {
  id: string;
  receiptId: string;
  rawText: string;
  kind: ReceiptLineKind;
  /** Purchased quantity, in the app's own unit vocabulary — the model's best estimate, same as a photographed meal's. */
  qty: number | null;
  unit: MeasureUnit | null;
  /** Whether `qty` counts containers or measures a divisible amount. Null when `qty` is null or the line carries no quantity at all. */
  quantityKind: QuantityKind | null;
  lineTotalCents: number | null;
  /** Per-unit price where the line showed a multiple. Provenance only — the pantry item is priced from the line total. */
  unitPriceCents: number | null;
  canonicalId: string | null;
  /**
   * For a `discount` line only: the food line it reduces, when the receipt
   * names one. Null means either not a discount or a basket-wide discount
   * that names no line (spec: reduce the receipt total, not a line).
   */
  appliesToLineId: string | null;
  /** Set once the review is accepted and this line created a pantry item. */
  pantryItemId: string | null;
  /** The user excluded this line during review. */
  excluded: boolean;
  createdAt: string;
}

export interface ReceiptWithLines extends Receipt {
  lines: ReceiptLine[];
}

/** One durable photograph contributing to a receipt draft. */
export type ReceiptFrameStatus = 'pending' | 'extracted' | 'failed';

export interface ReceiptFrame {
  id: string;
  receiptId: string;
  imageUri: string;
  sortOrder: number;
  status: ReceiptFrameStatus;
  lastErrorKind: string | null;
  createdAt: string;
  extractedAt: string | null;
}

/** A camera image retained until it can be interpreted and reviewed. */
export type PendingCaptureKind = 'receipt' | 'items' | 'unclear' | 'nothing';
export type PendingCaptureStatus = 'pending' | 'failed';

export interface PendingCapture {
  id: string;
  imageUri: string;
  detectedKind: PendingCaptureKind | null;
  status: PendingCaptureStatus;
  retryCount: number;
  lastErrorKind: string | null;
  createdAt: string;
  updatedAt: string;
}
