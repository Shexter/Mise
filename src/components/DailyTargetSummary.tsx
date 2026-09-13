import { Pressable, StyleSheet, View } from 'react-native';

import { Meter } from '@/components/Meter';
import { Caption } from '@/components/Type';
import { color, layout, space } from '@/constants/theme';
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

/**
 * Fibre leads. It is the metric the app is opinionated about and the one every
 * other tracker buries, so it gets the position the eye reaches first rather
 * than the leftover slot after the three macros.
 */
const DISPLAY_METRICS = [
  ['fibre', 'Fibre'],
  ['protein', 'Protein'],
  ['carbohydrate', 'Carbs'],
  ['fat', 'Fat'],
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
      >
        <Meter
          label={label}
          value={value.knownValue === null ? '—' : format(value.knownValue)}
          target={
            value.target === null ? '—' : `${format(value.target)}${value.unit}`
          }
          ratio={ratio}
          percent={`${Math.round(ratio * 100)}%`}
          fill={color.measure}
          incomplete={incomplete}
        />
      </Pressable>
      {canRequest ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Get dinner ideas for the remaining ${format(shortfall)} grams of ${label.toLowerCase()}`}
          onPress={() => onRequest(macro)}
          style={styles.requestAction}
        >
          <Caption style={styles.requestLabel}>Dinner ideas</Caption>
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
  group: {},
  // Ruled rows, not bordered cards: four containers stacked is the pattern that
  // made this screen read as a dashboard rather than as a day.
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.line,
  },
  requestAction: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingBottom: space.sm,
  },
  // It reads as body text otherwise, sitting under a nutrient row with nothing
  // to say it can be tapped.
  requestLabel: { color: color.action },
});
