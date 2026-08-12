import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, RowTitle, SectionLabel } from '@/components/Type';
import { color, layout, radius, space } from '@/constants/theme';
import type {
  DailyNutritionMetric,
  DailyNutritionMetricSummary,
  DailyNutritionSummary,
} from '@/logic/dailyNutritionSummary';
import type { SuggestionTargetMacro } from '@/types';

interface Props {
  summary: DailyNutritionSummary;
  onSelect?: (metric: DailyNutritionMetric) => void;
  onRequest?: (macro: SuggestionTargetMacro) => void;
}

const DISPLAY_METRICS = [
  ['protein', 'Protein'],
  ['carbohydrate', 'Carbohydrate'],
  ['fat', 'Fat'],
  ['fibre', 'Fibre'],
] as const satisfies readonly [DailyNutritionMetric, string][];

/** Compact, colour-independent daily nutrient targets for the Today overview. */
export function DailyTargetSummary({ summary, onSelect, onRequest }: Props) {
  return (
    <View style={styles.group} accessibilityLabel="Daily nutrition targets">
      {DISPLAY_METRICS.map(([key, label]) => (
        <MetricRow
          key={key}
          label={label}
          value={summary.metrics[key]}
          onPress={() => onSelect?.(key)}
          onRequest={onRequest}
        />
      ))}
    </View>
  );
}

function MetricRow({
  label,
  value,
  onPress,
  onRequest,
}: {
  label: string;
  value: DailyNutritionMetricSummary;
  onPress: () => void;
  onRequest?: (macro: SuggestionTargetMacro) => void;
}) {
  const target = value.target === null ? 'No recorded target' : `${format(value.target)} ${value.unit} target`;
  const known = value.knownValue === null ? 'Unknown' : `${format(value.knownValue)} ${value.unit}`;
  const incomplete = value.coverage === 'partial' || value.coverage === 'unknown';
  const ratio = value.knownValue === null || value.target === null || value.target <= 0
    ? 0
    : Math.min(1, value.knownValue / value.target);
  const accessibilityLabel = `${label}, ${known}, ${target}${incomplete ? ', incomplete because some logged values are unknown' : ''}`;
  const macro = suggestionMacro(value.metric);
  const shortfall = value.knownValue === null || value.target === null
    ? null
    : Math.max(0, value.target - value.knownValue);
  const canRequest = macro !== null && onRequest !== undefined && shortfall !== null && shortfall > 0;

  return (
    <View style={styles.row}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Shows the meals that contributed to this value."
        onPress={onPress}
        style={styles.metricAction}
      >
        <View style={styles.header}>
          <SectionLabel muted style={styles.label}>{label}</SectionLabel>
          <RowTitle numeric style={styles.value}>{known}</RowTitle>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
        <Caption muted>
          {incomplete ? `Incomplete · ${target}` : target}
        </Caption>
      </Pressable>
      {canRequest ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Get dinner ideas for the remaining ${format(shortfall)} grams of ${label.toLowerCase()}`}
          onPress={() => onRequest(macro)}
          style={styles.requestAction}
        >
          <Caption>Dinner ideas</Caption>
        </Pressable>
      ) : null}
    </View>
  );
}

function suggestionMacro(metric: DailyNutritionMetric): SuggestionTargetMacro | null {
  if (metric === 'protein') return 'protein';
  if (metric === 'carbohydrate') return 'carbs';
  if (metric === 'fat') return 'fat';
  return null;
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const styles = StyleSheet.create({
  group: {
    gap: space.sm,
  },
  row: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.input,
    padding: space.md,
    gap: space.sm,
  },
  metricAction: { gap: space.xs },
  requestAction: { minHeight: layout.minTouchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: space.sm,
  },
  label: {
    flexShrink: 1,
  },
  value: {
    flexShrink: 0,
  },
  track: {
    height: space.sm,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: color.ink,
  },
});
