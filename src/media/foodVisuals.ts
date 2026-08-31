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
export const CURATED_FOOD_ILLUSTRATIONS: Record<string, ImageSourcePropType> = {};

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
