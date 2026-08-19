import { describe, expect, test } from 'vitest';

import { metricColor } from '../src/constants/theme';
import { THEME_IDS, themePalettes } from '../src/constants/themePalettes';
import { DAILY_NUTRITION_METRICS } from '../src/logic/dailyNutritionSummary';

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

describe('metricColor', () => {
  test('has exactly the 5 DailyNutritionMetric keys, each a defined hex string', () => {
    expect(Object.keys(metricColor).sort()).toEqual([...DAILY_NUTRITION_METRICS].sort());
    for (const metric of DAILY_NUTRITION_METRICS) {
      expect(metricColor[metric]).toMatch(HEX_PATTERN);
    }
  });

  test('every theme provides a defined, non-empty hex chart slot for every metric', () => {
    const chartSlots = ['chart1', 'chart2', 'chart3', 'chart4', 'chart5'] as const;
    for (const themeId of THEME_IDS) {
      const palette = themePalettes[themeId];
      for (const slot of chartSlots) {
        expect(palette[slot], `${themeId}.${slot}`).toMatch(HEX_PATTERN);
      }
    }
  });
});
