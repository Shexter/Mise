import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const root = path.resolve(__dirname, '..');
const chart = fs.readFileSync(path.join(root, 'src/components/NutritionChart.tsx'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };

describe('NutritionChart accessibility and truth boundaries', () => {
  test('uses the in-repo React Native primitive without a chart dependency', () => {
    expect(Object.keys(packageJson.dependencies).some((name) => /chart|victory|svg/i.test(name))).toBe(false);
    expect(chart).toContain("form === 'bar'");
    expect(chart).toContain("form === 'line'");
  });

  test('exposes every bucket chronologically to touch and screen readers', () => {
    expect(chart).toContain('buckets.map((bucket)');
    expect(chart).toContain('accessibilityRole="button"');
    expect(chart).toContain('accessibilityLabel={accessibilityLabel}');
    expect(chart).toContain('Shows this period\'s chart value.');
    expect(chart).toContain('width: COLUMN_WIDTH');
    expect(chart).toContain('COLUMN_WIDTH = layout.minTouchTarget');
  });

  test('breaks unknown line intervals and distinguishes every coverage state without colour alone', () => {
    expect(chart).toContain('if (bucket.knownValue === null || next.knownValue === null) return null');
    expect(chart).toContain("bucket.coverage === 'no-meals'");
    expect(chart).toContain("bucket.coverage === 'partial'");
    expect(chart).toContain("bucket.coverage === 'unknown'");
    expect(chart).toContain('borderStyle: \'dashed\'');
    expect(chart).toContain('Known');
    expect(chart).toContain('Partial');
    expect(chart).toContain('Unknown');
    expect(chart).toContain('No meals');
  });

  test('introduces no animation, making reduced-motion output identical', () => {
    expect(chart).not.toMatch(/Animated|withTiming|duration|transition/i);
  });
});
