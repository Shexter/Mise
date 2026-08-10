import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, test } from 'vitest';

const ROOT = join(__dirname, '..');

function runtimeFiles(directory: 'app' | 'src'): string[] {
  return readdirSync(join(ROOT, directory), { recursive: true })
    .filter((entry): entry is string =>
      typeof entry === 'string' && ['.ts', '.tsx'].includes(extname(entry)),
    )
    .map((entry) => join(ROOT, directory, entry));
}

describe('open catalogue runtime boundary', () => {
  test('the running app contains no open-dataset endpoint', () => {
    const endpoints = /api\.nal\.usda\.gov|fdc\.nal\.usda\.gov|foodkeeper\.json|assets\.publishing\.service\.gov\.uk/i;
    const offenders = [...runtimeFiles('app'), ...runtimeFiles('src')].filter((path) =>
      endpoints.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  test('manual entry explains wholly unavailable nutrition without masking partial data', () => {
    const manual = readFileSync(join(ROOT, 'app/manual.tsx'), 'utf8');
    expect(manual).toContain('CATALOGUE_NUTRITION_UNAVAILABLE');
    expect(manual).toContain('!hasCatalogueNutrition(canonical)');
    expect(manual).toContain('displayedNutrition');
  });
});
