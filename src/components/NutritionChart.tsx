import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { Caption, SectionLabel } from '@/components/Type';
import { color, fillParent, layout, opacity, radius, space } from '@/constants/theme';
import type { NutritionBucket, NutritionChartForm } from '@/logic/nutritionRange';
import { buildTrendChartModel } from '@/logic/trendChart';

interface Props {
  buckets: readonly NutritionBucket[];
  form: NutritionChartForm;
  metricLabel: string;
  unit: string;
  /** The metric's validated categorical colour (see `metricColor` in `@/constants/theme`). */
  color: string;
  onSelect?: (bucket: NutritionBucket) => void;
}

const PLOT_HEIGHT = layout.nutritionChartHeight - space.xl;
const COLUMN_WIDTH = layout.minTouchTarget;

/**
 * A hand-rolled chart over the low-level SVG primitive, with no animation, so
 * reduced-motion mode needs no alternate timing path. Every bucket is also a
 * chronological touch and screen-reader target; the visual plot never carries
 * information by colour alone.
 */
export function NutritionChart({ buckets, form, metricLabel, unit, color: metricColor, onSelect }: Props) {
  const knownValues = buckets.flatMap((bucket) => bucket.knownValue === null ? [] : [bucket.knownValue]);
  const maximum = Math.max(1, ...knownValues);
  const plotWidth = Math.max(COLUMN_WIDTH, buckets.length * COLUMN_WIDTH);
  const lineModel = buildTrendChartModel(
    buckets,
    plotWidth,
    PLOT_HEIGHT,
    layout.nutritionChartPoint,
  );

  if (buckets.length === 0) {
    return <Caption muted>No dates are available for this period.</Caption>;
  }

  return (
    <View style={styles.frame}>
      <View style={styles.chartHeader}>
        <SectionLabel muted>{metricLabel} trend</SectionLabel>
        <Caption muted>{form === 'bar' ? 'Bar chart' : 'Line chart'}</Caption>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={`${metricLabel} ${form} chart`}>
        <View style={[styles.plot, { width: plotWidth }]}>
          {form === 'line' ? <SvgLinePlot width={plotWidth} model={lineModel} color={metricColor} /> : null}
          <View style={styles.columns}>
            {buckets.map((bucket) => (
              <BucketColumn
                key={`${bucket.startDate}-${bucket.endDate}`}
                bucket={bucket}
                form={form}
                metricLabel={metricLabel}
                unit={unit}
                maximum={maximum}
                color={metricColor}
                onPress={() => onSelect?.(bucket)}
              />
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.legend} accessibilityLabel="Chart legend">
        <LegendMark style={styles.completeMark} label="Known" />
        <LegendMark style={styles.partialMark} label="Partial" />
        <LegendMark style={styles.unknownMark} label="Unknown" />
        <LegendMark style={styles.absentMark} label="No meals" />
      </View>
    </View>
  );
}

function SvgLinePlot({
  width,
  model,
  color: metricColor,
}: {
  width: number;
  model: ReturnType<typeof buildTrendChartModel>;
  color: string;
}) {
  return (
    <Svg
      width={width}
      height={PLOT_HEIGHT}
      style={styles.svg}
      pointerEvents="none"
    >
      {model.segments.map((segment) => (
        <Line
          key={`${segment.from.bucket.startDate}-${segment.to.bucket.startDate}`}
          x1={segment.from.x}
          y1={segment.from.y}
          x2={segment.to.x}
          y2={segment.to.y}
          stroke={metricColor}
          strokeWidth={layout.nutritionChartStrokeWidth}
          strokeDasharray={segment.partial ? `${space.xs} ${space.xs}` : undefined}
        />
      ))}
      {model.points.filter((point) => point.plottable).map((point) => (
        <Circle
          key={point.bucket.startDate}
          cx={point.x}
          cy={point.y}
          r={layout.nutritionChartPoint / 2}
          fill={point.partial ? color.surface : metricColor}
          stroke={metricColor}
          strokeWidth={point.partial ? layout.nutritionChartStrokeWidth : undefined}
          strokeDasharray={point.partial ? `${space.xs} ${space.xs}` : undefined}
        />
      ))}
    </Svg>
  );
}

function BucketColumn({
  bucket,
  form,
  metricLabel,
  unit,
  maximum,
  color: metricColor,
  onPress,
}: {
  bucket: NutritionBucket;
  form: NutritionChartForm;
  metricLabel: string;
  unit: string;
  maximum: number;
  color: string;
  onPress: () => void;
}) {
  const plottable = bucket.knownValue !== null
    && bucket.coverage !== 'unknown'
    && bucket.coverage !== 'no-meals';
  const ratio = plottable ? bucket.knownValue! / maximum : null;
  const label = bucket.startDate === bucket.endDate
    ? bucket.startDate
    : `${bucket.startDate} to ${bucket.endDate}`;
  const value = bucket.knownValue === null ? 'no known value' : `${format(bucket.knownValue)} ${unit}`;
  const accessibilityLabel = `${label}, ${metricLabel}, ${value}, ${coverageLabel(bucket)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Shows this period's chart value."
      onPress={onPress}
      style={({ pressed }) => [styles.column, pressed && { opacity: opacity.pressed }]}
    >
      {ratio === null ? (
        <View style={bucket.coverage === 'no-meals' ? styles.absentPlotMark : styles.unknownPlotMark} />
      ) : form === 'bar' ? (
        <View
          style={[
            styles.bar,
            bucket.coverage === 'partial'
              ? [styles.partialBar, { borderColor: metricColor }]
              : { backgroundColor: metricColor },
            { height: Math.max(layout.nutritionChartPoint, PLOT_HEIGHT * ratio) },
          ]}
        />
      ) : null}
      <Caption muted numberOfLines={1} style={styles.dateLabel}>
        {bucket.startDate.slice(5)}
      </Caption>
    </Pressable>
  );
}

function LegendMark({ style, label }: { style: object; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendMark, style]} /><Caption muted>{label}</Caption></View>;
}

function coverageLabel(bucket: NutritionBucket): string {
  if (bucket.coverage === 'partial') return 'partial coverage';
  if (bucket.coverage === 'unknown') return 'logged meals, value unknown';
  if (bucket.coverage === 'no-meals') return 'no logged meals';
  return 'complete coverage';
}

function format(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const styles = StyleSheet.create({
  frame: { gap: space.md },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  plot: { height: layout.nutritionChartHeight, borderBottomWidth: 1, borderBottomColor: color.line },
  svg: { ...fillParent },
  columns: { flexDirection: 'row', height: '100%' },
  column: { width: COLUMN_WIDTH, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: space.base, borderRadius: radius.input },
  partialBar: { backgroundColor: color.surface, borderWidth: 1, borderStyle: 'dashed' },
  unknownPlotMark: { width: layout.nutritionChartPoint, height: layout.nutritionChartPoint, borderWidth: 1, borderColor: color.ink, transform: [{ rotate: '45deg' }], marginBottom: space.sm },
  absentPlotMark: { width: layout.nutritionChartPoint, height: layout.nutritionChartPoint, borderRadius: radius.full, borderWidth: 1, borderColor: color.line, marginBottom: space.sm },
  dateLabel: { width: COLUMN_WIDTH, textAlign: 'center', marginTop: space.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  legendMark: { width: layout.nutritionChartPoint, height: layout.nutritionChartPoint },
  completeMark: { backgroundColor: color.ink, borderRadius: radius.full },
  partialMark: { borderWidth: 1, borderStyle: 'dashed', borderColor: color.ink, borderRadius: radius.full },
  unknownMark: { borderWidth: 1, borderColor: color.ink, transform: [{ rotate: '45deg' }] },
  absentMark: { borderWidth: 1, borderColor: color.line, borderRadius: radius.full },
});
