import { CATEGORY_FALLBACK_TOKENS, type FoodCategory } from "@/media/foodVisuals";
import { FOOD_CLASSES, type FoodClass } from "@/types";

/**
 * A dish is not one of its ingredients, so it cannot borrow one's picture. What
 * a dish *is* — factually, from data already on the device — is the mix of food
 * classes it puts on a plate. So that is what it gets: a plate seen from above,
 * its well divided into wedges coloured by the classes the dish actually uses,
 * in the same colours those classes carry as ingredient badges.
 *
 * The mark states nothing that isn't derived. An unresolved ingredient adds no
 * wedge, and a dish with nothing resolved renders an honestly empty plate
 * rather than inventing a composition.
 */

/** One class's share of the plate. */
export interface DishWedge {
  category: FoodCategory;
  /** Share of the plate, 0..1. Wedges sum to 1. */
  fraction: number;
  color: string;
}

export interface ResolvedDishVisual {
  kind: "photo" | "plate";
  /** Present when `kind` is `photo`. */
  uri?: string;
  /** Present when `kind` is `plate`; empty when no ingredient class is known. */
  wedges: readonly DishWedge[];
  /**
   * Plating angle in degrees. Derived from the dish name so the same dish always
   * plates the same way, and two dishes of identical composition still read as
   * different marks. Carries no meaning of its own.
   */
  rotation: number;
}

export interface ResolveDishVisualInput {
  /** A photo of the finished dish, if the user has one. Always wins. */
  photoUri?: string | null;
  /** The dish name. Used only to derive a stable plating angle. */
  dish?: string | null;
  /** Food class per ingredient. Unresolved ingredients pass `null`. */
  foodClasses?: readonly (FoodClass | null | undefined)[];
}

/** Stable order for ties, so a composition always plates identically. */
const CATEGORY_ORDER: readonly FoodCategory[] = [...FOOD_CLASSES, "other"];

/** FNV-1a. Small, stable, and dependency-free; only ever used for plating angle. */
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function dishPlatingRotation(dish?: string | null): number {
  const name = dish?.trim().toLowerCase();
  if (!name) return 0;
  return stableHash(name) % 360;
}

/**
 * Counts each food class's share of a dish. Ingredients whose class is unknown
 * are left out rather than guessed at, so a partly resolved dish shows the part
 * that is known.
 */
export function buildDishComposition(
  foodClasses: readonly (FoodClass | null | undefined)[] = [],
): readonly DishWedge[] {
  const counts = new Map<FoodClass, number>();
  for (const foodClass of foodClasses) {
    if (!foodClass) continue;
    counts.set(foodClass, (counts.get(foodClass) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return CATEGORY_ORDER.indexOf(left[0]) - CATEGORY_ORDER.indexOf(right[0]);
    })
    .map(([category, count]) => ({
      category,
      fraction: count / total,
      color: CATEGORY_FALLBACK_TOKENS[category].iconColor,
    }));
}

export function resolveDishVisual(input: ResolveDishVisualInput): ResolvedDishVisual {
  const rotation = dishPlatingRotation(input.dish);

  if (input.photoUri && input.photoUri.trim().length > 0) {
    return { kind: "photo", uri: input.photoUri.trim(), wedges: [], rotation };
  }

  return { kind: "plate", wedges: buildDishComposition(input.foodClasses), rotation };
}

/* -------------------------------------------------------------------------- */
/* Plate geometry                                                             */
/* -------------------------------------------------------------------------- */

export interface PlateGeometry {
  /** Overall square canvas edge, in points. */
  size: number;
  center: number;
  /** Outer edge of the rim. */
  rimRadius: number;
  /** Edge of the well, where the food sits. */
  wellRadius: number;
  rimStrokeWidth: number;
}

export function buildPlateGeometry(size: number): PlateGeometry {
  const rimStrokeWidth = Math.max(1, Math.round(size * 0.04));
  const rimRadius = size / 2 - rimStrokeWidth / 2;
  return {
    size,
    center: size / 2,
    rimRadius,
    // A plate reads as a plate because of its rim. A narrower well buys a wider
    // ring of ceramic, which is what stops the mark reading as a pie chart.
    wellRadius: rimRadius * 0.68,
    rimStrokeWidth,
  };
}

export interface PlateWedgePath {
  category: FoodCategory;
  color: string;
  /** SVG path data, or null when the wedge covers the whole well. */
  path: string | null;
}

function pointOnCircle(center: number, radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [center + radius * Math.cos(radians), center + radius * Math.sin(radians)];
}

/**
 * Wedge paths for a plate's well, starting at `rotation`.
 *
 * A single wedge covers the full circle, which no arc can express — sweeping
 * 360° puts the arc's start and end at the same point and renders nothing. Such
 * a wedge returns a `null` path and is drawn as a plain filled circle instead.
 */
export function buildPlateWedgePaths(
  wedges: readonly DishWedge[],
  geometry: PlateGeometry,
  rotation = 0,
): readonly PlateWedgePath[] {
  if (wedges.length === 0) return [];
  const only = wedges.length === 1 ? wedges[0] : undefined;
  if (only) {
    return [{ category: only.category, color: only.color, path: null }];
  }

  const { center, wellRadius } = geometry;
  let angle = rotation;

  return wedges.map((wedge) => {
    const sweep = wedge.fraction * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;

    const [startX, startY] = pointOnCircle(center, wellRadius, start);
    const [endX, endY] = pointOnCircle(center, wellRadius, end);
    const largeArc = sweep > 180 ? 1 : 0;

    return {
      category: wedge.category,
      color: wedge.color,
      path:
        `M ${center} ${center} L ${startX} ${startY} ` +
        `A ${wellRadius} ${wellRadius} 0 ${largeArc} 1 ${endX} ${endY} Z`,
    };
  });
}
