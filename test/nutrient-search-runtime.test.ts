import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

const ROOT = join(__dirname, '..');
const SCREEN = readFileSync(join(ROOT, 'app/nutrient-search.tsx'), 'utf8');

/**
 * `app/nutrient-search.tsx` (Oracle-style nutrient search,
 * `add-nutrient-directed-search`) must stay pull-only and local: no
 * provider call, no suggestion engine, no cook-this action. This codebase
 * has no component-render test infrastructure anywhere (see the sibling
 * `add-micronutrient-tracking`/`add-weight-goal-pacing` changes' notes),
 * so — matching the existing structural-boundary pattern in
 * `catalogue-runtime.test.ts` — these properties are verified by scanning
 * the screen's own source rather than rendering it.
 */
describe('nutrient search surface stays pull-only and offline-capable', () => {
  test('does not import the suggestion engine, a provider API, or fetch', () => {
    expect(SCREEN).not.toMatch(/suggestionService/);
    expect(SCREEN).not.toMatch(/getOrGenerateSuggestions/);
    expect(SCREEN).not.toMatch(/@\/api\//);
    expect(SCREEN).not.toMatch(/\bfetch\(/);
  });

  test('calls assessMacroGap directly against locally-read pantry and canonical data', () => {
    expect(SCREEN).toContain('assessMacroGap');
    expect(SCREEN).toContain('listPantryItems');
    expect(SCREEN).toContain('getAllCanonicals');
  });

  test('presents no dish, recipe, or cook-this affordance', () => {
    // Checked against code constructs (components, handlers, routes), not
    // prose — this file's own explanatory comments legitimately discuss
    // what it deliberately excludes.
    expect(SCREEN).not.toMatch(/SuggestionCard|DishCard|RecipeCard/);
    expect(SCREEN).not.toMatch(/cookThis|onCook|CookThis/);
    expect(SCREEN).not.toMatch(/router\.push\(['"]\/recipe/);
  });

  test('surfaces measured coverage and unmeasured stock plainly, matching the macro-gap surface', () => {
    expect(SCREEN).toContain('hasUnmeasuredStock');
    expect(SCREEN).toContain('hasMeasuredCoverage');
  });

  test('handles a failed pantry/catalogue load instead of spinning forever', () => {
    // Bug found in review: the initial load had no .catch(), so a rejected
    // listPantryItems()/getAllCanonicals() left the screen on "Loading your
    // pantry…" with no way out.
    expect(SCREEN).toMatch(/\.catch\(/);
    expect(SCREEN).toContain('loadError');
  });
});
