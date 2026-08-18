import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import type { NutritionBucket } from '@/logic/nutritionRange';
import { buildTrendChartModel } from '@/logic/trendChart';

const root = path.resolve(__dirname, '..');
const chart = fs.readFileSync(path.join(root, 'src/components/NutritionChart.tsx'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };

describe('NutritionChart accessibility and truth boundaries', () => {
  test('uses only the SVG drawing primitive, not a charting framework', () => {
    expect(packageJson.dependencies['react-native-svg']).toBe('15.12.1');
    expect(Object.keys(packageJson.dependencies).some((name) => /victory|recharts|chart-kit/i.test(name))).toBe(false);
    expect(chart).toContain("from 'react-native-svg'");
    expect(chart).toContain('<Svg');
    expect(chart).toContain('<Line');
    expect(chart).toContain('<Circle');
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
    expect(chart).toContain("bucket.coverage === 'no-meals'");
    expect(chart).toContain("bucket.coverage === 'partial'");
    expect(chart).toContain("bucket.coverage === 'unknown'");
    expect(chart).toContain('strokeDasharray');
    expect(chart).toContain("borderStyle: 'dashed'");
    expect(chart).toContain('Known');
    expect(chart).toContain('Partial');
    expect(chart).toContain('Unknown');
    expect(chart).toContain('No meals');
  });

  test('introduces no animation, making reduced-motion output identical', () => {
    expect(chart).not.toMatch(/Animated|withTiming|duration|transition/i);
  });

  test('handles empty and single-point fixtures without inventing segments', () => {
    expect(buildTrendChartModel([], 100, 100, 10)).toMatchObject({
      points: [], segments: [], maximum: 1,
    });
    const single = buildTrendChartModel([bucket('complete', 20, '2026-08-01')], 100, 100, 10);
    expect(single.points).toHaveLength(1);
    expect(single.points[0]).toMatchObject({ plottable: true, partial: false });
    expect(single.segments).toEqual([]);
  });

  test('mixed coverage draws only honest neighbouring lines and marks partial segments', () => {
    const model = buildTrendChartModel([
      bucket('complete', 20, '2026-08-01'),
      bucket('partial', 10, '2026-08-02'),
      bucket('unknown', null, '2026-08-03'),
      bucket('complete', 15, '2026-08-04'),
      bucket('no-meals', 0, '2026-08-05'),
    ], 220, 100, 10);

    expect(model.points.map((point) => point.plottable)).toEqual([true, true, false, true, false]);
    expect(model.segments).toHaveLength(1);
    expect(model.segments[0]).toMatchObject({ partial: true });
  });
});

function bucket(
  coverage: NutritionBucket['coverage'],
  knownValue: number | null,
  startDate: string,
): NutritionBucket {
  return {
    startDate,
    endDate: startDate,
    knownValue,
    coverage,
    daysWithMeals: coverage === 'no-meals' ? 0 : 1,
    totalDays: 1,
    recordedTarget: null,
    targetChanged: false,
  };
}
