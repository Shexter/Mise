import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Body, Caption, RowTitle, SectionLabel } from '@/components/Type';
import { color, space } from '@/constants/theme';
import type { NutritionBucket, NutritionPeriod } from '@/logic/nutritionRange';
import { nutritionReportSummary } from '@/logic/nutritionReport';

interface Props {
  period: NutritionPeriod;
  metricLabel: string;
  unit: string;
  days: readonly NutritionBucket[];
}

/** A factual on-screen report of locally logged values, not a medical report. */
export function NutritionReport({ period, metricLabel, unit, days }: Props) {
  const summary = nutritionReportSummary(days);
  const targetContext = summary.recordedTargets.length === 0
    ? 'No recorded target is available in this period.'
    : summary.recordedTargets.length === 1
      ? `Recorded daily target: ${format(summary.recordedTargets[0]!)} ${unit}.`
      : `Recorded daily target changed during this period: ${summary.recordedTargets.map((target) => `${format(target)} ${unit}`).join(', ')}.`;

  return (
    <View style={styles.report} accessibilityLabel={`${metricLabel} logged-data report`}>
      <View style={styles.heading}>
        <SectionLabel muted>Personal nutrition report</SectionLabel>
        <RowTitle>{metricLabel}</RowTitle>
        <Caption muted>{period.startDate} to {period.endDate} · {unit}</Caption>
      </View>

      <Card>
        <View style={styles.summaryGrid}>
          <SummaryValue label="Known daily average" value={summary.knownAverage} unit={unit} />
          <SummaryValue label="Known minimum" value={summary.minimum} unit={unit} />
          <SummaryValue label="Known maximum" value={summary.maximum} unit={unit} />
        </View>
        <Body>{targetContext}</Body>
        <Caption muted>
          Coverage: {summary.knownDays} days with a known value, {summary.loggedDays} days with logged meals, {summary.totalDays} days in the period.
          {summary.incomplete ? ' Some logged nutrition is incomplete.' : ''}
        </Caption>
        <Caption muted>This summary reflects food logged on this device and may be incomplete. It is not a diagnosis or treatment recommendation.</Caption>
      </Card>

      <View style={styles.table} accessibilityLabel="Chronological nutrition values">
        <View style={styles.tableRow} accessibilityRole="header">
          <SectionLabel muted style={styles.date}>Date</SectionLabel>
          <SectionLabel muted style={styles.value}>Value</SectionLabel>
          <SectionLabel muted style={styles.coverage}>Coverage</SectionLabel>
        </View>
        {days.map((day) => (
          <View
            key={day.startDate}
            accessible
            accessibilityLabel={`${day.startDate}, ${day.knownValue === null ? 'no known value' : `${format(day.knownValue)} ${unit}`}, ${coverageLabel(day)}`}
            style={[styles.tableRow, styles.tableDivider]}
          >
            <Caption style={styles.date}>{day.startDate}</Caption>
            <Caption numeric style={styles.value}>{day.knownValue === null ? '—' : `${format(day.knownValue)} ${unit}`}</Caption>
            <Caption muted style={styles.coverage}>{coverageLabel(day)}</Caption>
          </View>
        ))}
      </View>
    </View>
  );
}

function SummaryValue({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return <View style={styles.summaryValue}><Caption muted>{label}</Caption><RowTitle numeric>{value === null ? '—' : `${format(value)} ${unit}`}</RowTitle></View>;
}

function coverageLabel(day: NutritionBucket): string {
  if (day.coverage === 'complete') return 'Complete';
  if (day.coverage === 'partial') return 'Partial';
  if (day.coverage === 'unknown') return 'Unknown';
  return 'No meals';
}

function format(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const styles = StyleSheet.create({
  report: { gap: space.md },
  heading: { gap: space.xs },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginBottom: space.md },
  summaryValue: { minWidth: 120, flexGrow: 1, gap: space.xs },
  table: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: color.line },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  tableDivider: { borderTopWidth: 1, borderTopColor: color.line },
  date: { flex: 1.2 },
  value: { flex: 1, textAlign: 'right' },
  coverage: { flex: 1, textAlign: 'right' },
});
