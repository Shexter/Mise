import Storage from 'expo-sqlite/kv-store';

import type {
  NutritionAggregation,
  NutritionChartForm,
  NutritionPresetRange,
} from '@/logic/nutritionRange';
import type { DailyNutritionMetric } from '@/logic/dailyNutritionSummary';

const STORAGE_KEY = 'mise.nutrition-analytics.display';
const METRICS: readonly DailyNutritionMetric[] = ['energy', 'protein', 'carbohydrate', 'fat', 'fibre'];
const RANGES: readonly NutritionPresetRange[] = ['7-day', '30-day', '90-day'];

export interface NutritionAnalyticsPreference {
  metric: DailyNutritionMetric;
  range: NutritionPresetRange;
  aggregation: NutritionAggregation;
  chartForm: NutritionChartForm;
}

export const DEFAULT_NUTRITION_ANALYTICS_PREFERENCE: NutritionAnalyticsPreference = {
  metric: 'energy', range: '7-day', aggregation: 'daily', chartForm: 'bar',
};

export function readNutritionAnalyticsPreference(): NutritionAnalyticsPreference {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(STORAGE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return DEFAULT_NUTRITION_ANALYTICS_PREFERENCE;
    const candidate = parsed as Partial<NutritionAnalyticsPreference>;
    return {
      metric: METRICS.includes(candidate.metric as DailyNutritionMetric) ? candidate.metric! : 'energy',
      range: RANGES.includes(candidate.range as NutritionPresetRange) ? candidate.range! : '7-day',
      aggregation: candidate.aggregation === 'weekly' ? 'weekly' : 'daily',
      chartForm: candidate.chartForm === 'line' ? 'line' : 'bar',
    };
  } catch {
    return DEFAULT_NUTRITION_ANALYTICS_PREFERENCE;
  }
}

export function writeNutritionAnalyticsPreference(preference: NutritionAnalyticsPreference): void {
  Storage.setItemSync(STORAGE_KEY, JSON.stringify(preference));
}
