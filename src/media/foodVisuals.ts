import type { ImageSourcePropType } from "react-native";
import { color, radius } from "@/constants/theme";
import type { FoodClass } from "@/types";

/**
 * The categories a food visual can fall back to. This is the app's real
 * ingredient taxonomy (`FoodClass`) plus `other` for anything unclassified —
 * deliberately not a second, parallel taxonomy.
 */
export type FoodCategory = FoodClass | "other";

/**
 * Tolerance for the few surfaces that hand us free text (product data, model
 * output) rather than a typed `FoodClass`. Every alias resolves to one of the
 * canonical categories above; none of them introduces a new one.
 */
const CATEGORY_ALIASES: Record<string, FoodCategory> = {
  staples: "staple",
  grain: "staple",
  grains: "staple",
  produces: "produce",
  vegetable: "produce",
  vegetables: "produce",
  fruit: "produce",
  fruits: "produce",
  proteins: "protein",
  meat: "protein",
  seafood: "protein",
  seasonings: "seasoning",
  spice: "seasoning",
  spices: "seasoning",
  condiments: "condiment",
  sauce: "condiment",
  sauces: "condiment",
  beverages: "beverage",
  drink: "beverage",
  drinks: "beverage",
};

export interface CategoryFallbackToken {
  category: FoodCategory;
  label: string;
  iconName: string;
  backgroundColor: string;
  iconColor: string;
}

export const DEFAULT_CATEGORY_FALLBACK_TOKEN: CategoryFallbackToken = {
  category: "other",
  label: "Food",
  iconName: "package",
  backgroundColor: color.surface,
  iconColor: color.muted,
};

export const CATEGORY_FALLBACK_TOKENS: Record<FoodCategory, CategoryFallbackToken> = {
  staple: {
    category: "staple",
    label: "Staple",
    iconName: "layers",
    backgroundColor: color.surface,
    iconColor: color.wheat,
  },
  produce: {
    category: "produce",
    label: "Produce",
    iconName: "sun",
    backgroundColor: color.surface,
    iconColor: color.olive,
  },
  protein: {
    category: "protein",
    label: "Protein",
    iconName: "activity",
    backgroundColor: color.surface,
    iconColor: color.paprika,
  },
  dairy: {
    category: "dairy",
    label: "Dairy",
    iconName: "droplet",
    backgroundColor: color.surface,
    iconColor: color.chart5,
  },
  seasoning: {
    category: "seasoning",
    label: "Seasoning",
    iconName: "zap",
    backgroundColor: color.surface,
    iconColor: color.chart4,
  },
  condiment: {
    category: "condiment",
    label: "Condiment",
    iconName: "droplet",
    backgroundColor: color.surface,
    iconColor: color.chart1,
  },
  frozen: {
    category: "frozen",
    label: "Frozen",
    iconName: "cloud",
    backgroundColor: color.surface,
    iconColor: color.chart2,
  },
  beverage: {
    category: "beverage",
    label: "Beverage",
    iconName: "coffee",
    backgroundColor: color.surface,
    iconColor: color.chart3,
  },
  other: DEFAULT_CATEGORY_FALLBACK_TOKEN,
};

export function getCategoryFallbackToken(category?: string | null): CategoryFallbackToken {
  if (!category) return DEFAULT_CATEGORY_FALLBACK_TOKEN;
  const normalized = category.toLowerCase().trim();
  const resolved = CATEGORY_ALIASES[normalized] ?? (normalized as FoodCategory);
  return CATEGORY_FALLBACK_TOKENS[resolved] ?? DEFAULT_CATEGORY_FALLBACK_TOKEN;
}

export type FoodVisualSize = "sm" | "md" | "lg" | "hero" | number;

export interface SizeDimensions {
  dimension: number;
  iconSize: number;
  borderRadius: number;
}

export const FOOD_VISUAL_SIZES: Record<"sm" | "md" | "lg" | "hero", SizeDimensions> = {
  sm: { dimension: 32, iconSize: 16, borderRadius: radius.input },
  md: { dimension: 44, iconSize: 22, borderRadius: radius.input + 2 },
  lg: { dimension: 64, iconSize: 32, borderRadius: radius.card },
  hero: { dimension: 120, iconSize: 56, borderRadius: radius.card + 4 },
};

export function resolveSizeDimensions(size: FoodVisualSize = "md"): SizeDimensions {
  if (typeof size === "number") {
    return {
      dimension: size,
      iconSize: Math.max(12, Math.round(size * 0.5)),
      borderRadius: Math.max(4, Math.round(size * 0.22)),
    };
  }
  return FOOD_VISUAL_SIZES[size] ?? FOOD_VISUAL_SIZES.md;
}

/** Canonical ids are lowercase kebab-case; tolerate casing and stray whitespace. */
export function normalizeCanonicalId(canonicalId?: string | null): string | null {
  if (!canonicalId) return null;
  const normalized = canonicalId.toLowerCase().trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Curated static illustration registry (tier 3).
 *
 * Empty by design. The `visual-food-identity-system` spec gates production art
 * on owner acceptance of the implemented UI through native visual review, so
 * every ingredient currently resolves to its reviewed category badge (tier 4) —
 * an intentional state, not a missing one.
 *
 * Metro can only bundle images through static `require()` calls, so this map is
 * hand-maintained rather than derived from `manifest.json`. `test/food-visuals.test.ts`
 * asserts the two match exactly in both directions, so they cannot drift.
 * See `assets/food/README.md` before adding an entry.
 */
export const CURATED_FOOD_ILLUSTRATIONS: Record<string, ImageSourcePropType> = {
  "active-dry-yeast": require("../../assets/food/active-dry-yeast.webp"),
  "all-purpose-flour": require("../../assets/food/all-purpose-flour.webp"),
  "apple": require("../../assets/food/apple.webp"),
  "avocado": require("../../assets/food/avocado.webp"),
  "bacon": require("../../assets/food/bacon.webp"),
  "baking-powder": require("../../assets/food/baking-powder.webp"),
  "baking-soda": require("../../assets/food/baking-soda.webp"),
  "banana": require("../../assets/food/banana.webp"),
  "beef-steak": require("../../assets/food/beef-steak.webp"),
  "belacan": require("../../assets/food/belacan.webp"),
  "bell-pepper": require("../../assets/food/bell-pepper.webp"),
  "black-pepper": require("../../assets/food/black-pepper.webp"),
  "bok-choy": require("../../assets/food/bok-choy.webp"),
  "bread": require("../../assets/food/bread.webp"),
  "broccoli": require("../../assets/food/broccoli.webp"),
  "brown-rice": require("../../assets/food/brown-rice.webp"),
  "brown-sugar": require("../../assets/food/brown-sugar.webp"),
  "butter": require("../../assets/food/butter.webp"),
  "cabbage": require("../../assets/food/cabbage.webp"),
  "canned-black-beans": require("../../assets/food/canned-black-beans.webp"),
  "canned-chickpeas": require("../../assets/food/canned-chickpeas.webp"),
  "canned-tomatoes": require("../../assets/food/canned-tomatoes.webp"),
  "canned-tuna": require("../../assets/food/canned-tuna.webp"),
  "carrot": require("../../assets/food/carrot.webp"),
  "cauliflower": require("../../assets/food/cauliflower.webp"),
  "celery": require("../../assets/food/celery.webp"),
  "cheddar-cheese": require("../../assets/food/cheddar-cheese.webp"),
  "chicken-breast": require("../../assets/food/chicken-breast.webp"),
  "chicken-stock": require("../../assets/food/chicken-stock.webp"),
  "chicken-thigh": require("../../assets/food/chicken-thigh.webp"),
  "cilantro": require("../../assets/food/cilantro.webp"),
  "cocoa-powder": require("../../assets/food/cocoa-powder.webp"),
  "coffee-beans": require("../../assets/food/coffee-beans.webp"),
  "cooking-spray": require("../../assets/food/cooking-spray.webp"),
  "cornstarch": require("../../assets/food/cornstarch.webp"),
  "cream-cheese": require("../../assets/food/cream-cheese.webp"),
  "cucumber": require("../../assets/food/cucumber.webp"),
  "daikon": require("../../assets/food/daikon.webp"),
  "dijon-mustard": require("../../assets/food/dijon-mustard.webp"),
  "doubanjiang": require("../../assets/food/doubanjiang.webp"),
  "dried-pasta": require("../../assets/food/dried-pasta.webp"),
  "eggs": require("../../assets/food/eggs.webp"),
  "fish": require("../../assets/food/fish.webp"),
  "fish-sauce": require("../../assets/food/fish-sauce.webp"),
  "five-spice": require("../../assets/food/five-spice.webp"),
  "frozen-dumplings": require("../../assets/food/frozen-dumplings.webp"),
  "frozen-peas": require("../../assets/food/frozen-peas.webp"),
  "garlic": require("../../assets/food/garlic.webp"),
  "ghee": require("../../assets/food/ghee.webp"),
  "ginger": require("../../assets/food/ginger.webp"),
  "gochugaru": require("../../assets/food/gochugaru.webp"),
  "gochujang": require("../../assets/food/gochujang.webp"),
  "greek-yogurt": require("../../assets/food/greek-yogurt.webp"),
  "green-onion": require("../../assets/food/green-onion.webp"),
  "ground-beef": require("../../assets/food/ground-beef.webp"),
  "ground-pork": require("../../assets/food/ground-pork.webp"),
  "heavy-cream": require("../../assets/food/heavy-cream.webp"),
  "hoisin-sauce": require("../../assets/food/hoisin-sauce.webp"),
  "honey": require("../../assets/food/honey.webp"),
  "jasmine-rice": require("../../assets/food/jasmine-rice.webp"),
  "kecap-manis": require("../../assets/food/kecap-manis.webp"),
  "ketchup": require("../../assets/food/ketchup.webp"),
  "lemon": require("../../assets/food/lemon.webp"),
  "lettuce": require("../../assets/food/lettuce.webp"),
  "lime": require("../../assets/food/lime.webp"),
  "mayonnaise": require("../../assets/food/mayonnaise.webp"),
  "milk": require("../../assets/food/milk.webp"),
  "mirin": require("../../assets/food/mirin.webp"),
  "miso": require("../../assets/food/miso.webp"),
  "mozzarella": require("../../assets/food/mozzarella.webp"),
  "mushroom": require("../../assets/food/mushroom.webp"),
  "napa-cabbage": require("../../assets/food/napa-cabbage.webp"),
  "oats": require("../../assets/food/oats.webp"),
  "olive-oil": require("../../assets/food/olive-oil.webp"),
  "orange": require("../../assets/food/orange.webp"),
  "oyster-sauce": require("../../assets/food/oyster-sauce.webp"),
  "parmesan": require("../../assets/food/parmesan.webp"),
  "peanut": require("../../assets/food/peanut.webp"),
  "peanut-butter": require("../../assets/food/peanut-butter.webp"),
  "plain-yogurt": require("../../assets/food/plain-yogurt.webp"),
  "pork-belly": require("../../assets/food/pork-belly.webp"),
  "potato": require("../../assets/food/potato.webp"),
  "red-lentils": require("../../assets/food/red-lentils.webp"),
  "rice-vinegar": require("../../assets/food/rice-vinegar.webp"),
  "salad-dressing": require("../../assets/food/salad-dressing.webp"),
  "salmon": require("../../assets/food/salmon.webp"),
  "salt": require("../../assets/food/salt.webp"),
  "sesame": require("../../assets/food/sesame.webp"),
  "sesame-oil": require("../../assets/food/sesame-oil.webp"),
  "shaoxing-wine": require("../../assets/food/shaoxing-wine.webp"),
  "shellfish": require("../../assets/food/shellfish.webp"),
  "shiitake-mushroom": require("../../assets/food/shiitake-mushroom.webp"),
  "shrimp": require("../../assets/food/shrimp.webp"),
  "sour-cream": require("../../assets/food/sour-cream.webp"),
  "soy": require("../../assets/food/soy.webp"),
  "soy-sauce-dark": require("../../assets/food/soy-sauce-dark.webp"),
  "soy-sauce-light": require("../../assets/food/soy-sauce-light.webp"),
  "spinach": require("../../assets/food/spinach.webp"),
  "sriracha": require("../../assets/food/sriracha.webp"),
  "sugar": require("../../assets/food/sugar.webp"),
  "sweet-potato": require("../../assets/food/sweet-potato.webp"),
  "tahini": require("../../assets/food/tahini.webp"),
  "tamari": require("../../assets/food/tamari.webp"),
  "tamarind-paste": require("../../assets/food/tamarind-paste.webp"),
  "tofu-firm": require("../../assets/food/tofu-firm.webp"),
  "tomato": require("../../assets/food/tomato.webp"),
  "tomato-paste": require("../../assets/food/tomato-paste.webp"),
  "tortilla": require("../../assets/food/tortilla.webp"),
  "tree-nut": require("../../assets/food/tree-nut.webp"),
  "vanilla-extract": require("../../assets/food/vanilla-extract.webp"),
  "vegetable-oil": require("../../assets/food/vegetable-oil.webp"),
  "wheat": require("../../assets/food/wheat.webp"),
  "white-pepper": require("../../assets/food/white-pepper.webp"),
  "white-rice": require("../../assets/food/white-rice.webp"),
  "xo-sauce": require("../../assets/food/xo-sauce.webp"),
  "yellow-onion": require("../../assets/food/yellow-onion.webp"),
};

export interface ResolveFoodVisualInput {
  photoUri?: string | null;
  productImageUrl?: string | null;
  canonicalId?: string | null;
  category?: FoodCategory | FoodClass | string | null;
}

export interface ResolvedFoodVisual {
  kind: "photo" | "product" | "illustration" | "category";
  uri?: string;
  source?: ImageSourcePropType;
  canonicalId?: string;
  category?: FoodCategory;
  iconName?: string;
  label?: string;
  backgroundColor?: string;
  iconColor?: string;
}

/**
 * Resolves food visual using 4-tier precedence:
 * 1. User Retained Photo (photoUri)
 * 2. Product Package Image (productImageUrl)
 * 3. Curated Canonical Illustration (canonicalId in CURATED_FOOD_ILLUSTRATIONS)
 * 4. Category Fallback Badge (category or default token)
 */
export function resolveFoodVisual(item: ResolveFoodVisualInput): ResolvedFoodVisual {
  // Tier 1: User Retained Photo
  if (item.photoUri && item.photoUri.trim().length > 0) {
    return {
      kind: "photo",
      uri: item.photoUri.trim(),
    };
  }

  // Tier 2: Product Package Photo
  if (item.productImageUrl && item.productImageUrl.trim().length > 0) {
    return {
      kind: "product",
      uri: item.productImageUrl.trim(),
    };
  }

  // Tier 3: Curated Canonical Illustration
  const canonicalId = normalizeCanonicalId(item.canonicalId);
  if (canonicalId) {
    const illustration = CURATED_FOOD_ILLUSTRATIONS[canonicalId];
    if (illustration !== undefined) {
      return {
        kind: "illustration",
        source: illustration,
        canonicalId,
      };
    }
  }

  // Tier 4: Category Fallback Badge
  const token = getCategoryFallbackToken(item.category);
  return {
    kind: "category",
    category: token.category,
    iconName: token.iconName,
    label: token.label,
    backgroundColor: token.backgroundColor,
    iconColor: token.iconColor,
  };
}

/**
 * Identity of whatever image a resolution would load, or `null` for the badge
 * tier, which loads nothing and so can never fail.
 *
 * `<FoodVisual />` remembers which identity failed rather than a bare boolean,
 * so a new photo on the same row is attempted instead of inheriting the old
 * one's failure.
 */
export function foodVisualImageKey(resolved: ResolvedFoodVisual): string | null {
  if (resolved.kind === "photo" || resolved.kind === "product") {
    return resolved.uri ? `${resolved.kind}:${resolved.uri}` : null;
  }
  if (resolved.kind === "illustration") {
    return resolved.canonicalId ? `illustration:${resolved.canonicalId}` : null;
  }
  return null;
}

/**
 * What a surface should render, given every image identity that has already
 * failed to load for it.
 *
 * A failed photo still deserves the item's own illustration before dropping to
 * the category badge, so each failure re-resolves from the next tier down.
 * Failures are tracked per identity rather than as a single flag: keeping the
 * whole set stops two broken tiers from handing the image back and forth, and
 * lets a replacement photo be attempted instead of inheriting the old one's
 * failure.
 */
export function resolveFoodVisualWithFailures(
  item: ResolveFoodVisualInput,
  failedKeys: readonly string[] = [],
): ResolvedFoodVisual {
  const resolved = resolveFoodVisual(item);
  const key = foodVisualImageKey(resolved);
  if (key === null || !failedKeys.includes(key)) {
    return resolved;
  }

  if (resolved.kind === "photo") {
    return resolveFoodVisualWithFailures({ ...item, photoUri: null }, failedKeys);
  }
  if (resolved.kind === "product") {
    return resolveFoodVisualWithFailures({ ...item, productImageUrl: null }, failedKeys);
  }
  return resolveFoodVisualWithFailures({ ...item, canonicalId: null }, failedKeys);
}

export interface FoodVisualAccessibility {
  /** True when the visual is announced; false when it is hidden as decorative. */
  announced: boolean;
  label?: string;
}

/**
 * A food visual always sits beside the food's name — in an adjacent text node,
 * or on an already-labelled pressable parent. Announcing it too would read the
 * name twice, so the visual is decorative unless a caller passes an explicit
 * `alt` that says something the surrounding text does not.
 */
export function resolveFoodVisualAccessibility(alt?: string | null): FoodVisualAccessibility {
  const trimmed = alt?.trim();
  if (!trimmed) return { announced: false };
  return { announced: true, label: trimmed };
}
