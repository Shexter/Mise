import { normalizeShoppingListCategory } from '@/logic/shoppingList';
import { RECEIPT_EXTRACTION_SOURCES } from '@/types';
import type { CanonicalItem, BodyMeasurement, Confidence, SuggestionBaseIntent, SuggestionPrepSpeed, SavedSuggestionPreference, ConsumptionEvent, ConsumptionKind, DailyTarget, DietaryRule, DietaryRuleKind, ExpirySource, Fast, FoodClass, Fullness, ItemAlias, Location, Shop, LocationKind, MeasureUnit, Meal, MealItem, MealSource, MealType, MealVenue, PantryItem, PendingCapture, PendingCaptureKind, Product, Profile, QuantitySource, QueuedMatch, Receipt, ReceiptExtractionSource, ReceiptLine, ReceiptLineKind, ReceiptType, QuantityKind, Recipe, RecipeIngredient, ReceiptFrame, ReferenceSource, StockStatus, StorageLocation, ShoppingListItem, ShoppingListReceiptMatch, ShoppingListSource, ShoppingListSourceKind, ShoppingListStatus } from '@/types';



/**
 * The transaction handle `withExclusiveTransactionAsync` hands back. Typed
 * structurally so the Node test stand-in satisfies it without importing
 * `expo-sqlite`.
 */
export type BindParams = (string | number | null)[];


export interface TransactionHandle {
  runAsync(sql: string, params: BindParams): Promise<unknown>;
  getFirstAsync<T>(sql: string, params: BindParams): Promise<T | null>;
  getAllAsync<T>(sql: string, params: BindParams): Promise<T[]>;
}


/* -------------------------------------------------------------------------- */
/* Row shapes                                                                  */
/* -------------------------------------------------------------------------- */

export interface ProfileRow {
  sex: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number;
  activity_level: string;
  goal: string;
  target_calories: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
  fibre_target_g: number;
  units: string;
  onboarded_at: string;
  target_source: string;
  stated_calories: number | null;
  stated_figure_kind: string | null;
  target_weight_kg: number | null;
  weight_goal_rate_kg_per_week: number | null;
}


export interface BodyMeasurementRow {
  provider: string;
  weight_kg: number;
  measured_at: string;
  body_fat_pct: number | null;
  lean_tissue_kg: number | null;
  bone_mineral_content_kg: number | null;
  fat_free_mass_kg: number;
}


export interface FastRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  target_duration_minutes: number | null;
  created_at: string;
}


export interface MealRow {
  id: string;
  logged_at: string;
  local_date: string;
  meal_type: string;
  name: string;
  photo_uri: string | null;
  source: string;
  confidence: string | null;
  venue: string;
  servings_mult: number;
  created_at: string;
}


export interface MealItemRow {
  id: string;
  meal_id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  is_manual_addition: number;
  sort_order: number;
  canonical_id: string | null;
}


export interface ShoppingListItemRow {
  id: string;
  canonical_id: string | null;
  display_name: string;
  normalized_name: string;
  status: string;
  requested_qty: number | null;
  requested_unit: string | null;
  note: string | null;
  category: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}


export interface ShoppingListSourceRow {
  id: string;
  shopping_item_id: string;
  kind: string;
  source_id: string | null;
  recipe_id: string | null;
  suggestion_id: string | null;
  created_at: string;
}


export interface ShoppingListReceiptMatchRow {
  id: string;
  shopping_item_id: string;
  receipt_id: string;
  receipt_line_id: string;
  previous_status: string;
  matched_at: string;
  undone_at: string | null;
}


export interface DailyTargetRow {
  local_date: string;
  target_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
}


export interface RecipeRow {
  id: string;
  title: string;
  source_link: string | null;
  steps_json: string;
  image_uri: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}


export interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  canonical_id: string | null;
  sort_order: number;
}


/* -------------------------------------------------------------------------- */
/* Mappers                                                                     */
/* -------------------------------------------------------------------------- */

export function toProfile(row: ProfileRow): Profile {
  return {
    sex: row.sex as Profile['sex'],
    age: row.age,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    activityLevel: row.activity_level as Profile['activityLevel'],
    goal: row.goal as Profile['goal'],
    targetCalories: row.target_calories,
    targetSource: row.target_source as Profile['targetSource'],
    statedCalories: row.stated_calories,
    statedFigureKind: row.stated_figure_kind as Profile['statedFigureKind'],
    proteinPct: row.protein_pct,
    carbsPct: row.carbs_pct,
    fatPct: row.fat_pct,
    fibreTargetG: row.fibre_target_g,
    units: row.units as Profile['units'],
    onboardedAt: row.onboarded_at,
    targetWeightKg: row.target_weight_kg,
    weightGoalRateKgPerWeek: row.weight_goal_rate_kg_per_week,
  };
}


export function toBodyMeasurement(row: BodyMeasurementRow): BodyMeasurement {
  return {
    provider: row.provider as BodyMeasurement['provider'], weightKg: row.weight_kg,
    measuredAt: row.measured_at, bodyFatPct: row.body_fat_pct,
    leanTissueKg: row.lean_tissue_kg, boneMineralContentKg: row.bone_mineral_content_kg,
    fatFreeMassKg: row.fat_free_mass_kg,
  };
}


export function toFast(row: FastRow): Fast {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    targetDurationMinutes: row.target_duration_minutes,
    createdAt: row.created_at,
  };
}


export function toMeal(row: MealRow): Meal {
  return {
    id: row.id,
    loggedAt: row.logged_at,
    localDate: row.local_date,
    mealType: row.meal_type as MealType,
    name: row.name,
    photoUri: row.photo_uri,
    source: row.source as MealSource,
    confidence: row.confidence as Confidence | null,
    venue: row.venue as MealVenue,
    servingsMult: row.servings_mult,
    createdAt: row.created_at,
  };
}


export function toMealItem(row: MealItemRow): MealItem {
  return {
    id: row.id,
    mealId: row.meal_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit as MeasureUnit,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fibreG: row.fibre_g,
    isManualAddition: row.is_manual_addition === 1,
    sortOrder: row.sort_order,
    canonicalId: row.canonical_id,
  };
}


export function toDailyTarget(row: DailyTargetRow): DailyTarget {
  return {
    localDate: row.local_date,
    targetCalories: row.target_calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    fibreG: row.fibre_g,
  };
}


export function toRecipe(row: RecipeRow): Recipe {
  let steps: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.steps_json);
    if (Array.isArray(parsed)) {
      steps = parsed.filter((step): step is string => typeof step === 'string');
    }
  } catch {
    // An older or manually damaged row must remain viewable; the recipe data
    // is still useful even if its optional method cannot be read.
  }
  return {
    id: row.id,
    title: row.title,
    sourceLink: row.source_link,
    steps,
    imageUri: row.image_uri,
    status: row.status === 'awaiting_content' ? 'awaiting_content' : 'ready',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


export function toRecipeIngredient(row: RecipeIngredientRow): RecipeIngredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit as MeasureUnit | null,
    canonicalId: row.canonical_id,
    sortOrder: row.sort_order,
  };
}


export interface DaySummaryRow {
  local_date: string;
  calories: number | null;
  target_calories: number | null;
}


export interface ChartPreferenceRow {
  enabled_metrics: string;
}


/* -------------------------------------------------------------------------- */
/* Ingredient identity: row shapes and mappers                                 */
/* -------------------------------------------------------------------------- */

export interface CanonicalItemRow {
  id: string;
  display_name: string;
  class: string;
  default_location: string;
  shelf_life_days: string;
  early_warning_days: number | null;
  open_life_days: number | null;
  sources: string;
  kcal_per_100: number | null;
  protein_per_100: number | null;
  carbs_per_100: number | null;
  fat_per_100: number | null;
  fibre_per_100: number | null;
  vitamin_c_mg_per_100: number | null;
  iron_mg_per_100: number | null;
  vitamin_b12_mcg_per_100: number | null;
  calcium_mg_per_100: number | null;
  folate_mcg_per_100: number | null;
  vitamin_a_mcg_per_100: number | null;
  potassium_mg_per_100: number | null;
  vitamin_d_mcg_per_100: number | null;
  magnesium_mg_per_100: number | null;
  zinc_mg_per_100: number | null;
  sodium_mg_per_100: number | null;
  vitamin_e_mg_per_100: number | null;
  vitamin_k_mcg_per_100: number | null;
  thiamin_mg_per_100: number | null;
  riboflavin_mg_per_100: number | null;
  typical_use_qty: number | null;
  typical_use_unit: string | null;
  typical_pkg_qty: number | null;
  typical_pkg_unit: string | null;
  density_g_per_ml: number | null;
  is_seed: number;
  created_at: string;
}


export interface ItemAliasRow {
  id: string;
  alias_norm: string;
  alias_raw: string;
  canonical_id: string;
  source: string;
  locale: string | null;
  confidence: number;
  times_confirmed: number;
  created_at: string;
}


export interface ProductRow {
  id: string;
  gtin: string | null;
  brand: string | null;
  name: string;
  pkg_qty: number | null;
  pkg_unit: string | null;
  container_count: number | null;
  canonical_id: string;
  kcal_per_100: number | null;
  protein_per_100: number | null;
  carbs_per_100: number | null;
  fat_per_100: number | null;
  fibre_per_100: number | null;
  source: string;
  fetched_at: string | null;
  last_scanned_at: string | null;
}


export interface QueuedMatchRow {
  id: string;
  raw_text: string;
  source: string;
  context: string | null;
  suggested_id: string | null;
  confidence: number | null;
  created_at: string;
}


export function toCanonicalItem(row: CanonicalItemRow): CanonicalItem {
  return {
    id: row.id,
    displayName: row.display_name,
    foodClass: row.class as FoodClass,
    defaultLocation: row.default_location as StorageLocation,
    shelfLifeDays: JSON.parse(row.shelf_life_days) as CanonicalItem['shelfLifeDays'],
    earlyWarningDays: row.early_warning_days,
    openLifeDays: row.open_life_days,
    sources: JSON.parse(row.sources) as CanonicalItem['sources'],
    kcalPer100: row.kcal_per_100,
    proteinPer100: row.protein_per_100,
    carbsPer100: row.carbs_per_100,
    fatPer100: row.fat_per_100,
    fibrePer100: row.fibre_per_100,
    vitaminCMgPer100: row.vitamin_c_mg_per_100,
    ironMgPer100: row.iron_mg_per_100,
    vitaminB12McgPer100: row.vitamin_b12_mcg_per_100,
    calciumMgPer100: row.calcium_mg_per_100,
    folateMcgPer100: row.folate_mcg_per_100,
    vitaminAMcgPer100: row.vitamin_a_mcg_per_100,
    potassiumMgPer100: row.potassium_mg_per_100,
    vitaminDMcgPer100: row.vitamin_d_mcg_per_100,
    magnesiumMgPer100: row.magnesium_mg_per_100,
    zincMgPer100: row.zinc_mg_per_100,
    sodiumMgPer100: row.sodium_mg_per_100,
    vitaminEMgPer100: row.vitamin_e_mg_per_100,
    vitaminKMcgPer100: row.vitamin_k_mcg_per_100,
    thiaminMgPer100: row.thiamin_mg_per_100,
    riboflavinMgPer100: row.riboflavin_mg_per_100,
    typicalUseQty: row.typical_use_qty,
    typicalUseUnit: row.typical_use_unit as MeasureUnit | null,
    typicalPkgQty: row.typical_pkg_qty,
    typicalPkgUnit: row.typical_pkg_unit as MeasureUnit | null,
    densityGPerMl: row.density_g_per_ml,
    isSeed: row.is_seed === 1,
    createdAt: row.created_at,
  };
}


export function toItemAlias(row: ItemAliasRow): ItemAlias {
  return {
    id: row.id,
    aliasNorm: row.alias_norm,
    aliasRaw: row.alias_raw,
    canonicalId: row.canonical_id,
    source: row.source as ReferenceSource,
    locale: row.locale,
    confidence: row.confidence,
    timesConfirmed: row.times_confirmed,
    createdAt: row.created_at,
  };
}


export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    gtin: row.gtin,
    brand: row.brand,
    name: row.name,
    pkgQty: row.pkg_qty,
    pkgUnit: row.pkg_unit as MeasureUnit | null,
    containerCount: row.container_count,
    canonicalId: row.canonical_id,
    kcalPer100: row.kcal_per_100,
    proteinPer100: row.protein_per_100,
    carbsPer100: row.carbs_per_100,
    fatPer100: row.fat_per_100,
    fibrePer100: row.fibre_per_100,
    source: row.source as ReferenceSource,
    fetchedAt: row.fetched_at,
    lastScannedAt: row.last_scanned_at,
  };
}


export function toQueuedMatch(row: QueuedMatchRow): QueuedMatch {
  return {
    id: row.id,
    rawText: row.raw_text,
    source: row.source as ReferenceSource,
    context: row.context,
    suggestedId: row.suggested_id,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}


/* -------------------------------------------------------------------------- */
/* Pantry: row shapes and mappers                                              */
/* -------------------------------------------------------------------------- */

export interface LocationRow {
  id: string;
  name: string;
  kind: string;
  sort_order: number;
}


export interface PantryItemRow {
  id: string;
  canonical_id: string;
  product_id: string | null;
  location_id: string;
  qty_remaining: number | null;
  qty_unit: string | null;
  qty_source: string | null;
  fullness: string | null;
  uses_count: number;
  purchased_at: string;
  opened_at: string | null;
  expires_at: string | null;
  expiry_source: string | null;
  price_cents: number | null;
  photo_uri: string | null;
  status: string;
  estimated_decrements_since_anchor: number;
  last_anchor_at: string | null;
  replacement_asked: number;
  created_at: string;
  updated_at: string;
}


export function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as LocationKind,
    sortOrder: row.sort_order,
  };
}


export function toPantryItem(row: PantryItemRow): PantryItem {
  return {
    id: row.id,
    canonicalId: row.canonical_id,
    productId: row.product_id,
    locationId: row.location_id,
    qtyRemaining: row.qty_remaining,
    qtyUnit: row.qty_unit as MeasureUnit | null,
    qtySource: row.qty_source as QuantitySource | null,
    fullness: row.fullness as Fullness | null,
    usesCount: row.uses_count,
    purchasedAt: row.purchased_at,
    openedAt: row.opened_at,
    expiresAt: row.expires_at,
    expirySource: row.expiry_source as ExpirySource | null,
    priceCents: row.price_cents,
    photoUri: row.photo_uri,
    status: row.status as StockStatus,
    estimatedDecrementsSinceAnchor: row.estimated_decrements_since_anchor,
    lastAnchorAt: row.last_anchor_at,
    replacementAsked: row.replacement_asked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


export interface ConsumptionEventRow {
  id: string;
  pantry_item_id: string | null;
  canonical_id: string;
  meal_id: string | null;
  qty: number | null;
  unit: string | null;
  uses: number;
  servings_mult: number;
  kind: string;
  created_at: string;
}


export function toConsumptionEvent(row: ConsumptionEventRow): ConsumptionEvent {
  return {
    id: row.id,
    pantryItemId: row.pantry_item_id,
    canonicalId: row.canonical_id,
    mealId: row.meal_id,
    qty: row.qty,
    unit: row.unit as MeasureUnit | null,
    uses: row.uses,
    servingsMult: row.servings_mult,
    kind: row.kind as ConsumptionKind,
    createdAt: row.created_at,
  };
}


export function toShoppingListItem(row: ShoppingListItemRow, sources: ShoppingListSource[]): ShoppingListItem {
  return {
    id: row.id,
    canonicalId: row.canonical_id,
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    status: row.status as ShoppingListStatus,
    requestedQty: row.requested_qty,
    requestedUnit: row.requested_unit as MeasureUnit | null,
    note: row.note,
    category: normalizeShoppingListCategory(row.category),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    sources,
  };
}


export function toShoppingListSource(row: ShoppingListSourceRow): ShoppingListSource {
  return {
    id: row.id,
    shoppingItemId: row.shopping_item_id,
    kind: row.kind as ShoppingListSourceKind,
    sourceId: row.source_id,
    recipeId: row.recipe_id,
    suggestionId: row.suggestion_id,
    createdAt: row.created_at,
  };
}


export function toShoppingListReceiptMatch(row: ShoppingListReceiptMatchRow): ShoppingListReceiptMatch {
  return {
    id: row.id,
    shoppingItemId: row.shopping_item_id,
    receiptId: row.receipt_id,
    receiptLineId: row.receipt_line_id,
    previousStatus: row.previous_status as ShoppingListStatus,
    matchedAt: row.matched_at,
    undoneAt: row.undone_at,
  };
}


/* -------------------------------------------------------------------------- */
/* Dinner decision: suggestion cache                                          */
/* -------------------------------------------------------------------------- */

export interface SuggestionCacheRow {
  id: string;
  local_date: string;
  mode: string;
  target_macro: string | null;
  template_id: string | null;
  prep_speed: string | null;
  fingerprint: string;
  payload: string;
  created_at: string;
}


export interface SuggestionPreferenceRow {
  base_intent: string;
  prep_speed: string;
  updated_at: string;
}


export function toSavedSuggestionPreference(row: SuggestionPreferenceRow): SavedSuggestionPreference {
  return {
    baseIntent: row.base_intent as SuggestionBaseIntent,
    prepSpeed: row.prep_speed as SuggestionPrepSpeed,
    updatedAt: row.updated_at,
  };
}


/* -------------------------------------------------------------------------- */
/* Receipts                                                                    */
/* -------------------------------------------------------------------------- */

export interface ReceiptRow {
  id: string;
  type: string;
  store: string | null;
  purchased_at: string;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  image_uri: string;
  status: string;
  frame_edits_locked: number;
  created_at: string;
}


export interface ReceiptLineRow {
  id: string;
  receipt_id: string;
  raw_text: string;
  kind: string;
  qty: number | null;
  unit: string | null;
  quantity_kind: string | null;
  line_total_cents: number | null;
  unit_price_cents: number | null;
  canonical_id: string | null;
  applies_to_line_id: string | null;
  pantry_item_id: string | null;
  excluded: number;
  ocr_confidence: number | null;
  created_at: string;
}


export interface ReceiptFrameRow {
  id: string;
  receipt_id: string;
  image_uri: string;
  sort_order: number;
  status: string;
  last_error_kind: string | null;
  store: string | null;
  purchased_at: string | null;
  receipt_type: string | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  extraction_source: string | null;
  created_at: string;
  extracted_at: string | null;
}


export interface ReceiptFrameLineRow {
  frame_id: string;
  frame_position: number;
  raw_text: string;
  kind: string;
  qty: number | null;
  unit: string | null;
  quantity_kind: string | null;
  line_total_cents: number | null;
  unit_price_cents: number | null;
  applies_to_text: string | null;
  ocr_confidence: number | null;
}


export interface PendingCaptureRow {
  id: string;
  image_uri: string;
  detected_kind: string | null;
  status: string;
  retry_count: number;
  last_error_kind: string | null;
  created_at: string;
  updated_at: string;
}


export function toPendingCapture(row: PendingCaptureRow): PendingCapture {
  return {
    id: row.id,
    imageUri: row.image_uri,
    detectedKind: row.detected_kind as PendingCaptureKind | null,
    status: row.status as PendingCapture['status'],
    retryCount: row.retry_count,
    lastErrorKind: row.last_error_kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


export function toReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    type: row.type as ReceiptType,
    store: row.store,
    purchasedAt: row.purchased_at,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    imageUri: row.image_uri,
    status: row.status as Receipt['status'],
    frameEditsLocked: row.frame_edits_locked === 1,
    createdAt: row.created_at,
  };
}


export function toReceiptLine(row: ReceiptLineRow): ReceiptLine {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    rawText: row.raw_text,
    kind: row.kind as ReceiptLineKind,
    qty: row.qty,
    unit: row.unit as MeasureUnit | null,
    quantityKind: row.quantity_kind as QuantityKind | null,
    lineTotalCents: row.line_total_cents,
    unitPriceCents: row.unit_price_cents,
    canonicalId: row.canonical_id,
    appliesToLineId: row.applies_to_line_id,
    pantryItemId: row.pantry_item_id,
    excluded: row.excluded === 1,
    ocrConfidence: row.ocr_confidence,
    createdAt: row.created_at,
  };
}


export function toReceiptFrame(row: ReceiptFrameRow): ReceiptFrame {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    imageUri: row.image_uri,
    sortOrder: row.sort_order,
    status: row.status as ReceiptFrame['status'],
    lastErrorKind: row.last_error_kind,
    extractionSource: asExtractionSource(row.extraction_source),
    createdAt: row.created_at,
    extractedAt: row.extracted_at,
  };
}


/** An unrecognised or pre-provenance value reads as "not recorded", never as a guess. */
export function asExtractionSource(value: string | null): ReceiptExtractionSource | null {
  return RECEIPT_EXTRACTION_SOURCES.includes(value as ReceiptExtractionSource)
    ? (value as ReceiptExtractionSource)
    : null;
}


/* -------------------------------------------------------------------------- */
/* Dietary profile                                                            */
/* -------------------------------------------------------------------------- */

export interface DietaryRuleRow {
  id: string;
  kind: string;
  canonical_id: string | null;
  text: string;
  normalised_text: string;
  created_at: string;
}


export function toDietaryRule(row: DietaryRuleRow): DietaryRule {
  return {
    id: row.id,
    kind: row.kind as DietaryRuleKind,
    canonicalId: row.canonical_id,
    text: row.text,
    normalisedText: row.normalised_text,
    createdAt: row.created_at,
  };
}


// ---------------------------------------------------------------------------
// Shops
//
// Five columns and no timestamps, by design — see the `shops` migration. Every
// query below reads or writes shop positions; none of them records a visit,
// and there is deliberately no "touch" helper here of the kind the pantry has.
// ---------------------------------------------------------------------------

export interface ShopRow {
  id: string;
  name: string;
  store_name: string;
  latitude: number;
  longitude: number;
}


export function toShop(row: ShopRow): Shop {
  return {
    id: row.id,
    name: row.name,
    storeName: row.store_name,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}
