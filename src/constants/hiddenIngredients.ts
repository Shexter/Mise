import data from '../../assets/hidden-ingredients.json';

import type { HiddenIngredient } from '@/types';

/**
 * The quick-pick grid on the review screen: the calories a camera cannot see.
 * Values are typical per-serving figures, rounded to whole calories.
 */
export const HIDDEN_INGREDIENTS: readonly HiddenIngredient[] =
  data as HiddenIngredient[];

/**
 * Matches a model suggestion like "cooking oil" or "butter on the bread" to a
 * quick-pick, so a suggestion chip can be added in one tap.
 */
export function matchSuggestion(
  suggestion: string,
): HiddenIngredient | undefined {
  const needle = suggestion.toLowerCase();
  return HIDDEN_INGREDIENTS.find((ingredient) => {
    const name = ingredient.name.toLowerCase();
    return needle.includes(name) || name.includes(needle);
  });
}
