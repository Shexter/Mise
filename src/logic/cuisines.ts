import { PLANNER_CATALOGUE, type PlannerCatalogueRecipe } from '@/logic/plannerCatalogue';

/**
 * The cuisines the chooser can filter by, and their stable ids.
 *
 * The **recipes** are the source of truth, not the artwork. A cuisine exists in
 * this app because a reviewed recipe carries that label; a painting of a bowl
 * of noodles cannot create Korean coverage the collection does not have. That
 * is why this module reads `PLANNER_CATALOGUE` and the illustration registry
 * reads this, never the other way round.
 *
 * Ids are stable and lowercase so artwork, tests and any stored selection can
 * refer to a cuisine without depending on the display label's spelling. A label
 * outside the approved release vocabulary — a saved recipe's own tag, say —
 * still gets an id, and still gets a filter; what it does not get is artwork.
 */

export interface CuisineFilter {
  /** Stable, lowercase, safe as an asset id. */
  id: string;
  /** Exactly the label the recipes carry. */
  label: string;
  /** How many recipes in scope carry it, so an empty filter can say so. */
  count: number;
}

/**
 * The approved first-release vocabulary, decided 8 September 2026: the cuisines
 * the reviewed collection actually contains. Thai and Vietnamese appear in the
 * visual concept and are deliberately absent here. Korean joined on 13 September
 * 2026, when nine reviewed Korean recipes entered the collection — the list
 * follows the recipes, and a cuisine is added here only after one does.
 */
export const RELEASE_CUISINE_IDS: readonly string[] = [
  'chinese',
  'japanese',
  'korean',
  'italian',
  'mediterranean',
  'international',
];

/** Explicit label-to-id mapping for the release vocabulary. */
const EXPLICIT_CUISINE_IDS: Readonly<Record<string, string>> = {
  Chinese: 'chinese',
  Japanese: 'japanese',
  Korean: 'korean',
  Italian: 'italian',
  Mediterranean: 'mediterranean',
  International: 'international',
};

/**
 * The id for a cuisine label. Mapped explicitly where the release vocabulary
 * defines one, and otherwise slugged, so an unfamiliar label is still a usable
 * filter rather than being dropped from the list.
 */
export function cuisineId(label: string): string {
  const explicit = EXPLICIT_CUISINE_IDS[label.trim()];
  if (explicit) return explicit;
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Whether this cuisine is part of the approved first-release vocabulary. */
export function isReleaseCuisine(id: string): boolean {
  return RELEASE_CUISINE_IDS.includes(id);
}

/**
 * The filters to offer, derived from the recipes in scope.
 *
 * Counting here is what lets the chooser tell someone that Japanese has no
 * breakfast rather than showing them an empty list under a cheerful tile.
 */
export function cuisineFilters(
  recipes: readonly PlannerCatalogueRecipe[] = PLANNER_CATALOGUE,
): readonly CuisineFilter[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const recipe of recipes) {
    for (const label of recipe.cuisines) {
      const id = cuisineId(label);
      const entry = counts.get(id);
      if (entry) entry.count += 1;
      else counts.set(id, { label, count: 1 });
    }
  }

  // Release order first, so the rail opens on the cuisines the collection is
  // strongest in; anything else follows alphabetically.
  return [...counts.entries()]
    .map(([id, entry]) => ({ id, label: entry.label, count: entry.count }))
    .sort((left, right) => {
      const leftRank = RELEASE_CUISINE_IDS.indexOf(left.id);
      const rightRank = RELEASE_CUISINE_IDS.indexOf(right.id);
      if (leftRank !== rightRank) {
        if (leftRank === -1) return 1;
        if (rightRank === -1) return -1;
        return leftRank - rightRank;
      }
      return left.label.localeCompare(right.label);
    });
}

/** Whether a recipe carries this cuisine id. Compared by id, never by title. */
export function recipeHasCuisine(
  recipe: Pick<PlannerCatalogueRecipe, 'cuisines'>,
  id: string,
): boolean {
  return recipe.cuisines.some((label) => cuisineId(label) === id);
}
