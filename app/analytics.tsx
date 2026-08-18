import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { NutritionChart } from '@/components/NutritionChart';
import { NutritionReport } from '@/components/NutritionReport';
import { Segmented } from '@/components/Choice';
import { Screen } from '@/components/Screen';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import {
  readNutritionAnalyticsPreference,
  writeNutritionAnalyticsPreference,
  type NutritionAnalyticsPreference,
} from '@/constants/nutritionAnalyticsPreference';
import {
  getChartPreference,
  getDailyTarget,
  getMealsForDate,
  getNutritionRangeBuckets,
  saveChartPreference,
} from '@/db/queries';
import { friendlyDate } from '@/logic/dates';
import {
  dailyNutritionSummary,
  DAILY_NUTRITION_METRICS,
  nutritionContributors,
  type DailyNutritionMetric,
} from '@/logic/dailyNutritionSummary';
import type { DailyTarget, MealWithItems } from '@/types';
import { usePantryStore } from '@/store/pantryStore';
import {
  customNutritionPeriod,
  presetNutritionPeriod,
  type NutritionAggregation,
  type NutritionBucket,
  type NutritionPresetRange,
  type NutritionRange,
} from '@/logic/nutritionRange';

const METRICS = DAILY_NUTRITION_METRICS;
const LABELS: Record<DailyNutritionMetric, string> = {
  energy: 'Energy', protein: 'Protein', carbohydrate: 'Carbohydrate', fat: 'Fat', fibre: 'Fibre',
};
const UNITS: Record<DailyNutritionMetric, string> = {
  energy: 'kcal', protein: 'g', carbohydrate: 'g', fat: 'g', fibre: 'g',
};
const RANGE_OPTIONS = [
  { value: '7-day', label: '7 days' },
  { value: '30-day', label: '30 days' },
  { value: '90-day', label: '90 days' },
  { value: 'custom', label: 'Custom' },
] as const;
const AGGREGATION_OPTIONS = [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }] as const;
export default function NutritionAnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ metric?: string; date?: string }>();
  const stored = readNutritionAnalyticsPreference();
  const initialMetric = METRICS.includes(params.metric as DailyNutritionMetric)
    ? params.metric as DailyNutritionMetric
    : stored.metric;
  const localDate = params.date ?? new Date().toISOString().slice(0, 10);
  const [metric, setMetric] = useState(initialMetric);
  const [range, setRange] = useState<NutritionRange>(stored.range);
  const [aggregation, setAggregation] = useState<NutritionAggregation>(stored.aggregation);
  const [customStart, setCustomStart] = useState(localDate);
  const [customEnd, setCustomEnd] = useState(localDate);
  const [dailyBuckets, setDailyBuckets] = useState<NutritionBucket[]>([]);
  const [enabledMetrics, setEnabledMetrics] = useState<DailyNutritionMetric[]>([]);
  const [chartBuckets, setChartBuckets] = useState<Partial<Record<DailyNutritionMetric, NutritionBucket[]>>>({});
  const [chartPreferenceReady, setChartPreferenceReady] = useState(false);
  const [chartPreferenceSaving, setChartPreferenceSaving] = useState(false);
  const [chartPreferenceError, setChartPreferenceError] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState(() => presetNutritionPeriod(stored.range, localDate));
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [meals, setMeals] = useState<MealWithItems[]>([]);
  const [target, setTarget] = useState<DailyTarget | null>(null);
  const pantryRevision = usePantryStore((state) => state.revision);

  useEffect(() => {
    void Promise.all([getMealsForDate(localDate), getDailyTarget(localDate)]).then(([nextMeals, nextTarget]) => {
      setMeals(nextMeals);
      setTarget(nextTarget);
    });
  }, [localDate, pantryRevision]);

  useEffect(() => {
    let active = true;
    void getChartPreference().then((metrics) => {
      if (!active) return;
      setEnabledMetrics(metrics);
      setChartPreferenceReady(true);
    }).catch(() => {
      if (!active) return;
      setChartPreferenceError('Chart preferences could not be loaded.');
      setChartPreferenceReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (range === 'custom' && (!validDate(customStart) || !validDate(customEnd) || customStart > customEnd)) {
      setRangeError('Enter a valid start and end date in YYYY-MM-DD order.');
      setChartBuckets({});
      return;
    }
    setRangeError(null);
    const period = range === 'custom'
      ? customNutritionPeriod(customStart, customEnd)
      : presetNutritionPeriod(range, localDate);
    setActivePeriod(period);
    let active = true;
    void Promise.all([
      getNutritionRangeBuckets(metric, period, 'daily'),
      Promise.all(enabledMetrics.map(async (enabledMetric) => [
        enabledMetric,
        await getNutritionRangeBuckets(enabledMetric, period, aggregation),
      ] as const)),
    ]).then(([nextDailyBuckets, dashboardEntries]) => {
      if (!active) return;
      setDailyBuckets(nextDailyBuckets);
      setChartBuckets(Object.fromEntries(dashboardEntries));
    });
    return () => { active = false; };
  }, [aggregation, customEnd, customStart, enabledMetrics, localDate, metric, range]);

  useEffect(() => {
    if (range === 'custom') return;
    const preference: NutritionAnalyticsPreference = { metric, range, aggregation, chartForm: 'line' };
    writeNutritionAnalyticsPreference(preference);
  }, [aggregation, metric, range]);

  const persistEnabledMetrics = async (next: DailyNutritionMetric[]) => {
    const previous = enabledMetrics;
    setEnabledMetrics(next);
    setChartPreferenceSaving(true);
    setChartPreferenceError(null);
    try {
      await saveChartPreference(next);
    } catch {
      setEnabledMetrics(previous);
      setChartPreferenceError('Chart order could not be saved.');
    } finally {
      setChartPreferenceSaving(false);
    }
  };

  const toggleMetric = (option: DailyNutritionMetric) => {
    const next = enabledMetrics.includes(option)
      ? enabledMetrics.filter((candidate) => candidate !== option)
      : [...enabledMetrics, option];
    void persistEnabledMetrics(next);
  };

  const moveMetric = (option: DailyNutritionMetric, offset: -1 | 1) => {
    const from = enabledMetrics.indexOf(option);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= enabledMetrics.length) return;
    const next = [...enabledMetrics];
    [next[from], next[to]] = [next[to]!, next[from]!];
    void persistEnabledMetrics(next);
  };

  const summary = dailyNutritionSummary(localDate, meals, target).metrics[metric];
  const contributors = nutritionContributors(meals, metric);

  return (
    <Screen scroll footer={<Button label="Back to Today" onPress={() => router.back()} />}>
      <View style={styles.header}>
        <ScreenTitle>Nutrition Analytics</ScreenTitle>
        <Body muted>{friendlyDate(localDate)}</Body>
      </View>

      <View style={styles.metrics} accessibilityLabel="Nutrition metric">
        {METRICS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: option === metric }}
            onPress={() => { setMetric(option); router.setParams({ metric: option, date: localDate }); }}
            style={({ pressed }) => [styles.metric, option === metric && styles.metricSelected, pressed && { opacity: opacity.pressed }]}
          >
            <Caption>{LABELS[option]}</Caption>
          </Pressable>
        ))}
      </View>

      <Card title="Trend configuration">
        <View style={styles.controls}>
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
          {range === 'custom' ? (
            <View style={styles.customDates}>
              <Field label="Start date" value={customStart} onChangeText={setCustomStart} placeholder="YYYY-MM-DD" error={rangeError ?? undefined} />
              <Field label="End date" value={customEnd} onChangeText={setCustomEnd} placeholder="YYYY-MM-DD" />
            </View>
          ) : null}
          <Segmented options={AGGREGATION_OPTIONS} value={aggregation} onChange={(value) => setAggregation(value)} />
        </View>
      </Card>

      <Card title="Charts">
        <View style={styles.chartManager}>
          <Body muted>Choose which consumed metrics appear and the order they use.</Body>
          {METRICS.map((option) => {
            const enabledIndex = enabledMetrics.indexOf(option);
            const enabled = enabledIndex >= 0;
            return (
              <View key={option} style={styles.chartManagerRow}>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel={`${LABELS[option]} chart`}
                  accessibilityState={{ checked: enabled, disabled: chartPreferenceSaving }}
                  disabled={chartPreferenceSaving}
                  onPress={() => toggleMetric(option)}
                  style={({ pressed }) => [styles.chartToggle, pressed && { opacity: opacity.pressed }]}
                >
                  <RowTitle>{LABELS[option]}</RowTitle>
                  <Caption muted>{enabled ? 'Shown' : 'Hidden'}</Caption>
                </Pressable>
                {enabled ? (
                  <View style={styles.reorderControls}>
                    <Button
                      label="Up"
                      variant="ghost"
                      block={false}
                      disabled={chartPreferenceSaving || enabledIndex === 0}
                      accessibilityHint={`Moves ${LABELS[option]} earlier in the dashboard.`}
                      onPress={() => moveMetric(option, -1)}
                    />
                    <Button
                      label="Down"
                      variant="ghost"
                      block={false}
                      disabled={chartPreferenceSaving || enabledIndex === enabledMetrics.length - 1}
                      accessibilityHint={`Moves ${LABELS[option]} later in the dashboard.`}
                      onPress={() => moveMetric(option, 1)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          {chartPreferenceError ? <Caption style={styles.error}>{chartPreferenceError}</Caption> : null}
        </View>
      </Card>

      <View style={styles.dashboard}>
        <RowTitle>Trend dashboard</RowTitle>
        {!chartPreferenceReady ? (
          <Card><Caption muted>Loading chart preferences…</Caption></Card>
        ) : enabledMetrics.length === 0 ? (
          <Card><EmptyState title="No charts enabled" detail="Choose a metric above to add its trend." /></Card>
        ) : enabledMetrics.map((enabledMetric) => (
          <Card key={enabledMetric}>
            <NutritionChart
              buckets={chartBuckets[enabledMetric] ?? []}
              form="line"
              metricLabel={LABELS[enabledMetric]}
              unit={UNITS[enabledMetric]}
            />
          </Card>
        ))}
      </View>

      <NutritionReport period={activePeriod} metricLabel={LABELS[metric]} unit={UNITS[metric]} days={dailyBuckets} />

      <Card>
        <SectionLabel muted>{LABELS[metric]} contributors</SectionLabel>
        <RowTitle numeric>
          {summary.knownValue === null ? 'Unknown' : `${format(summary.knownValue)} ${summary.unit}`}
        </RowTitle>
        <Caption muted>
          {summary.coverage === 'partial' || summary.coverage === 'unknown'
            ? 'Incomplete. Logged items with unknown values are excluded from this subtotal.'
            : 'Ordered by known contribution from meals stored on this device.'}
        </Caption>
      </Card>

      {contributors.length === 0 ? (
        <Card><EmptyState title="No known contributors" detail={`No logged meal has a known ${LABELS[metric].toLowerCase()} value for this day.`} /></Card>
      ) : (
        <Card padded={false}>
          {contributors.map((contributor, index) => (
            <Pressable
              key={contributor.mealId}
              accessibilityRole="button"
              accessibilityLabel={`${contributor.mealName}, ${format(contributor.knownValue)} ${summary.unit}${contributor.coverage === 'partial' ? ', incomplete' : ''}`}
              onPress={() => router.push(`/meal/${contributor.mealId}`)}
              style={({ pressed }) => [styles.contributor, index > 0 && styles.divider, pressed && { opacity: opacity.pressed }]}
            >
              <View style={styles.contributorText}>
                <RowTitle>{contributor.mealName}</RowTitle>
                {contributor.coverage === 'partial' ? <Caption muted>Known subtotal · some items excluded</Caption> : null}
              </View>
              <RowTitle numeric>{format(contributor.knownValue)} {summary.unit}</RowTitle>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function format(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, gap: space.xs },
  controls: { gap: space.md },
  chartManager: { gap: space.md },
  chartManagerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  chartToggle: { flex: 1, minWidth: layout.minRowHeight, paddingVertical: space.sm },
  reorderControls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  dashboard: { gap: space.md },
  error: { color: color.paprika },
  customDates: { gap: space.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: { borderWidth: 1, borderColor: color.line, paddingHorizontal: space.md, paddingVertical: space.sm },
  metricSelected: { backgroundColor: color.surface, borderColor: color.ink },
  contributor: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.base },
  contributorText: { flex: 1, gap: space.xs },
  divider: { borderTopWidth: 1, borderTopColor: color.line },
});
