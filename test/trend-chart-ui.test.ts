import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const analytics = readFileSync('app/analytics.tsx', 'utf8');
const chart = readFileSync('src/components/NutritionChart.tsx', 'utf8');
const metrics = readFileSync('src/logic/dailyNutritionSummary.ts', 'utf8');

describe('trend chart dashboard UI', () => {
  test('enables, disables, and reorders the persisted metric list', () => {
    expect(analytics).toContain('getChartPreference');
    expect(analytics).toContain('saveChartPreference');
    expect(analytics).toContain('toggleMetric(option)');
    expect(analytics).toContain('moveMetric(option, -1)');
    expect(analytics).toContain('moveMetric(option, 1)');
    expect(analytics).toContain('enabledMetrics.map((enabledMetric)');
    expect(analytics).toContain('chartBuckets[enabledMetric]');
    expect(analytics).toContain('form="line"');
  });

  test('offers exactly the five metrics with consumed daily data', () => {
    expect(metrics).toContain('export const DAILY_NUTRITION_METRICS');
    for (const metric of ['energy', 'protein', 'carbohydrate', 'fat', 'fibre']) {
      expect(metrics).toContain(`'${metric}'`);
    }
    const availableBlock = metrics.slice(
      metrics.indexOf('export const DAILY_NUTRITION_METRICS'),
      metrics.indexOf('];', metrics.indexOf('export const DAILY_NUTRITION_METRICS')),
    );
    expect(availableBlock).not.toMatch(/weight|vitamin|iron|calcium|folate|potassium/i);
  });

  test('keeps chart controls and data accessible at large text', () => {
    expect(analytics).toContain('accessibilityRole="switch"');
    expect(analytics).toContain('accessibilityState={{ checked: enabled');
    expect(analytics).toContain("flexWrap: 'wrap'");
    expect(chart).toContain('accessibilityLabel={accessibilityLabel}');
    expect(chart).toContain('Shows this period\'s chart value.');
    expect(chart).not.toMatch(/Animated|withTiming|duration|transition/i);
  });

  test('uses theme tokens without raw visual values', () => {
    expect(analytics).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
    expect(chart).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
    expect(chart).toContain('layout.nutritionChartStrokeWidth');
    expect(chart).toContain('layout.nutritionChartPoint');
  });
});
