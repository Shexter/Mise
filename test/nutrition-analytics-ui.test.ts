import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('Today nutrition disclosure boundaries', () => {
  test('keeps Today compact and hands supported metrics to Nutrition Analytics', () => {
    const today = read('app/(tabs)/index.tsx');
    const summary = read('src/components/DailyTargetSummary.tsx');

    expect(today).toContain("pathname: '/analytics'");
    expect(today).toContain('<DailyTargetSummary');
    expect(today).toContain('<MealRow');
    expect(summary).toContain("['protein', 'Protein']");
    expect(summary).toContain("['carbohydrate', 'Carbohydrate']");
    expect(summary).toContain("['fat', 'Fat']");
    expect(summary).toContain("['fibre', 'Fibre']");

    for (const forbidden of ['Chart', 'Report table', 'Nutrition score', 'Food grade', 'Streak']) {
      expect(today).not.toContain(forbidden);
    }
  });

  test('uses large-text-safe wrapping and colour-independent progress copy', () => {
    const summary = read('src/components/DailyTargetSummary.tsx');

    expect(summary).toContain("flexWrap: 'wrap'");
    expect(summary).toContain("accessibilityRole=\"button\"");
    expect(summary).toContain("Incomplete · ${target}");
    expect(summary).toContain('Shows the meals that contributed to this value.');
  });

  test('labels unknown contributor exclusions and contains no score language', () => {
    const analytics = read('app/analytics.tsx');

    expect(analytics).toContain('Logged items with unknown values are excluded from this subtotal.');
    expect(analytics).toContain('Known subtotal · some items excluded');
    expect(analytics).not.toMatch(/score|grade|streak/i);
  });

  test('preserves selected metric and date across the Today handoff and ordinary back navigation', () => {
    const today = read('app/(tabs)/index.tsx');
    const analytics = read('app/analytics.tsx');
    expect(today).toContain("params: { metric, date: selectedDate }");
    expect(today).toContain("params: { metric: 'energy', date: selectedDate }");
    expect(analytics).toContain('params.date');
    expect(analytics).toContain('router.back()');
  });

  test('keeps range reads local and preferences presentation-only', () => {
    const analytics = read('app/analytics.tsx');
    const queries = read('src/db/queries.ts');
    const preference = read('src/constants/nutritionAnalyticsPreference.ts');
    expect(analytics).toContain('getNutritionRangeBuckets');
    expect(queries).toContain('getNutritionDayValues');
    expect(queries).not.toMatch(/fetch\(|axios|https?:\/\//);
    expect(preference).toContain('mise.nutrition-analytics.display');
    expect(preference).not.toMatch(/meal|dailyTarget|nutrition value/i);
  });

  test('uses only semantic theme roles and avoids medical authority claims', () => {
    const chart = read('src/components/NutritionChart.tsx');
    const report = read('src/components/NutritionReport.tsx');
    const palettes = read('src/constants/themePalettes.ts');
    expect(chart).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
    expect(report).not.toMatch(/#[0-9a-f]{3,8}|rgba?\(/i);
    expect(palettes).toContain("'cool-organic'");
    expect(report).toContain('may be incomplete');
    expect(report).toContain('not a diagnosis or treatment recommendation');
    expect(report).not.toMatch(/clinical range|risk flag|prescri|replaces professional/i);
  });
});
