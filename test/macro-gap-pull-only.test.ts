import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = resolve(__dirname, '..');
const macroBars = readFileSync(resolve(root, 'src/components/MacroBars.tsx'), 'utf8');
const today = readFileSync(resolve(root, 'app/(tabs)/index.tsx'), 'utf8');

describe('macro-gap pull-only entry point', () => {
  test('exposes a below-target bar only as an explicit press action', () => {
    expect(macroBars).toContain('disabled={!canRequest}');
    expect(macroBars).toContain('consumed === null ? null');
    expect(macroBars).toContain('onPress={() => onRequest?.(macro)}');
    expect(macroBars).not.toMatch(/notification|toast|alert/i);
  });

  test('routes the chosen macro to the existing dinner review surface', () => {
    expect(today).toContain("router.push({ pathname: '/dinner', params: { macro } })");
  });
});
