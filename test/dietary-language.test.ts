import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

/**
 * `add-dietary-profile` group 8: the app never claims food is safe, only
 * what it filtered. A guideline nobody would violate on purpose is still
 * worth a test — copy drifts, guidelines don't run in CI, and this is the
 * part most likely to be quietly reworded later by someone being helpful
 * (the section's own reasoning in tasks.md).
 *
 * Source-scanning rather than string-table assertions, since this app has
 * no central strings module — the actual risk is a literal in a .tsx file,
 * so that is what gets read.
 */

const FORBIDDEN = [/\bsafe\b/i, /\bsafely\b/i, /\bunsafe\b/i, /\bsuitable\b/i, /free[\s-]?from/i];

const ROOT = join(__dirname, '..');

const FILES_WITH_DIETARY_STRINGS = [
  'src/components/dietary/DietaryRuleList.tsx',
  'app/dietary-rules.tsx',
  'app/onboarding/dietary.tsx',
];

function userVisibleLines(path: string): string[] {
  const content = readFileSync(join(ROOT, path), 'utf-8');
  // Strip identifiers that legitimately contain "safe" but name no dietary
  // claim, e.g. `useSafeAreaInsets` — a source-scan test has to exclude
  // these explicitly rather than parse JSX string literals properly.
  return content
    .replace(/useSafeAreaInsets/g, '')
    .split('\n');
}

describe('dietary-facing copy never claims food is safe (task 8.1/8.3)', () => {
  for (const file of FILES_WITH_DIETARY_STRINGS) {
    test(`${file} contains none of the forbidden words`, () => {
      const lines = userVisibleLines(file);
      const offenders = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => FORBIDDEN.some((pattern) => pattern.test(line)));

      expect(
        offenders,
        offenders.map((o) => `line ${o.index + 1}: ${o.line.trim()}`).join('\n'),
      ).toHaveLength(0);
    });
  }

  test('the dietary-rules block of the suggest prompt contains none of the forbidden words', () => {
    // Scoped to the added function, not the whole file — `add-dinner-decision`
    // legitimately warns the model against giving "food-safety instructions
    // (safe temperatures...)" elsewhere in this file, an unrelated,
    // pre-existing use of the word this test must not flag.
    const content = readFileSync(join(ROOT, 'src/api/suggestPrompt.ts'), 'utf-8');
    const match = content.match(/function dietaryRulesForPrompt[\s\S]*?\n}\n/);
    expect(match).not.toBeNull();
    const block = match![0];
    for (const pattern of FORBIDDEN) {
      expect(block).not.toMatch(pattern);
    }

    const ruleLine = content
      .split('\n')
      .find((line) => line.includes('If dietary_rules names'));
    expect(ruleLine).toBeDefined();
    for (const pattern of FORBIDDEN) {
      expect(ruleLine!).not.toMatch(pattern);
    }
  });

  test('the droppedForDiet captions in the dinner screen contain none of the forbidden words', () => {
    const content = readFileSync(join(ROOT, 'app/dinner.tsx'), 'utf-8');
    const lines = content
      .split('\n')
      .filter((line) => /droppedForDiet|dietary rules|what you avoid/i.test(line));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      for (const pattern of FORBIDDEN) {
        expect(line).not.toMatch(pattern);
      }
    }
  });
});

describe('the limit is stated where allergens are entered (task 8.2)', () => {
  test('the rule editor tells the user what it cannot do', () => {
    const content = readFileSync(
      join(ROOT, 'src/components/dietary/DietaryRuleList.tsx'),
      'utf-8',
    );
    expect(content).toMatch(/cannot verify/i);
  });
});
