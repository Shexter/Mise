import { describe, expect, test } from 'vitest';

import { parseSuggestResponse } from '../src/api/suggest';
import { MACRO_GAP_FIXTURES } from '../src/logic/__fixtures__/macroGaps';
import { assessMacroGap } from '../src/logic/macroGap';
import type { ExclusionSet } from '../src/logic/dietary';

const EMPTY_EXCLUSION: ExclusionSet = { canonicalIds: new Set(), unresolvedText: new Set() };

describe('macro-gap offline fixture corpus', () => {
  test('every recorded response parses, names a known ingredient, and retains its estimate', () => {
    for (const fixture of MACRO_GAP_FIXTURES) {
      const candidateIds = new Set(fixture.canonicals.map((canonical) => canonical.id));
      const result = parseSuggestResponse(
        fixture.recordedResponse, candidateIds, new Set(), EMPTY_EXCLUSION, false,
      );
      expect(result.suggestions[0]?.dish, fixture.name).toBe(fixture.expectedDish);
      expect(result.suggestions[0]?.uses.every((use) => candidateIds.has(use.canonicalId)), fixture.name)
        .toBe(true);
      expect(result.suggestions[0]?.estimatedNutritionPerServing?.source, fixture.name).toBe('provider');
    }
  });

  test('records both an explicitly unclosable pantry and partial catalogue coverage', () => {
    const unclosable = MACRO_GAP_FIXTURES.find((fixture) => fixture.name === 'unclosable measurable protein gap')!;
    const partial = MACRO_GAP_FIXTURES.find((fixture) => fixture.name === 'unknown nutrition beside measurable protein stock')!;
    const unclosableAssessment = assessMacroGap(
      unclosable.items, new Map(unclosable.canonicals.map((canonical) => [canonical.id, canonical])),
      unclosable.targetMacro, unclosable.today,
    );
    const partialAssessment = assessMacroGap(
      partial.items, new Map(partial.canonicals.map((canonical) => [canonical.id, canonical])),
      partial.targetMacro, partial.today,
    );

    expect(unclosableAssessment.bestAchievableG).toBeLessThan(unclosable.shortfallG);
    expect(partialAssessment.hasUnmeasuredStock).toBe(true);
  });

  test('keeps a higher protein contributor ahead of an earlier-expiring cucumber', () => {
    const fixture = MACRO_GAP_FIXTURES.find(
      (entry) => entry.name === 'expiring non-contributor beside protein stock',
    )!;
    const assessment = assessMacroGap(
      fixture.items,
      new Map(fixture.canonicals.map((canonical) => [canonical.id, canonical])),
      fixture.targetMacro,
      fixture.today,
    );
    expect(assessment.contributors[0]?.canonical.id).toBe('fixture-chicken');
  });
});
