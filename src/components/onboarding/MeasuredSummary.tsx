import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Body, Caption, RowTitle, SectionLabel } from '@/components/Type';
import { color, opacity, radius, space } from '@/constants/theme';
import { formatWeight } from '@/logic/units';
import type {
  DexaPath,
  MeasuredSource,
  MeasuredValues,
  OnboardingStage,
} from '@/logic/onboardingStages';
import type { Units } from '@/types';

interface Props {
  source: MeasuredSource;
  values: MeasuredValues;
  dexaPath: DexaPath | null;
  units: Units;
  saving: boolean;
  /** Set when the save itself failed, so nothing has been written. */
  error: string | null;
  onEdit: (stage: OnboardingStage) => void;
  onSave: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

interface Row {
  stage: OnboardingStage;
  label: string;
  value: string;
}

/**
 * The last stop before anything is written.
 *
 * It lists only the figures this source actually asked for — no empty rows
 * for fields the other provider uses — and every row is a way back to the
 * stage that set it. Nothing here has touched the profile, the stored
 * measurement, the active source, or the calorie target: that happens once,
 * on Save, and a failure leaves all four exactly as they were.
 */
export function MeasuredSummary({
  source,
  values,
  dexaPath,
  units,
  saving,
  error,
  onEdit,
  onSave,
  onRetry,
  onCancel,
}: Props) {
  const rows = rowsFor(source, values, dexaPath, units);

  return (
    <View style={styles.root}>
      <SectionLabel muted>Check these before saving</SectionLabel>

      <Card>
        {rows.map((row) => (
          <Pressable
            key={row.stage}
            onPress={() => onEdit(row.stage)}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}: ${row.value}. Edit`}
            hitSlop={space.xs}
            style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
          >
            <View style={styles.rowText}>
              <Caption muted>{row.label}</Caption>
              <RowTitle>{row.value}</RowTitle>
            </View>
            <Caption muted>Edit</Caption>
          </Pressable>
        ))}
      </Card>

      {error === null ? null : (
        <Card>
          <RowTitle>That did not save</RowTitle>
          <Body muted>{error}</Body>
          <Caption muted>
            Nothing was changed — your saved measurement and calorie target are as
            they were.
          </Caption>
          <Button label="Try again" variant="secondary" onPress={onRetry} />
        </Card>
      )}

      <Button label="Save" loading={saving} onPress={onSave} />
      <Button label="Cancel" variant="ghost" onPress={onCancel} />
    </View>
  );
}

/** Only the fields this source prints. The other provider's rows never appear. */
function rowsFor(
  source: MeasuredSource,
  values: MeasuredValues,
  dexaPath: DexaPath | null,
  units: Units,
): Row[] {
  const rows: Row[] = [];
  if (values.measurementDate !== null) {
    rows.push({ stage: 'measurement-date', label: 'Measured on', value: values.measurementDate });
  }
  if (values.weightKg !== null) {
    rows.push({ stage: 'weight', label: 'Weight', value: formatWeight(values.weightKg, units) });
  }

  if (source === 'inbody') {
    if (values.fatFreeMassKg !== null) {
      rows.push({
        stage: 'fat-free-mass',
        label: 'Fat Free Mass',
        value: formatWeight(values.fatFreeMassKg, units),
      });
    }
    rows.push({
      stage: 'optional-bmr',
      label: 'Printed BMR',
      value: values.bmrKcal === null ? 'Not provided' : `${Math.round(values.bmrKcal)} kcal`,
    });
    return rows;
  }

  if (dexaPath === 'body-fat' && values.bodyFatPct !== null) {
    rows.push({ stage: 'body-fat', label: 'Body fat', value: `${values.bodyFatPct}%` });
  }
  if (dexaPath === 'lean-bmc') {
    if (values.leanTissueKg !== null) {
      rows.push({
        stage: 'lean-tissue',
        label: 'Lean tissue',
        value: formatWeight(values.leanTissueKg, units),
      });
    }
    if (values.boneMineralContentKg !== null) {
      rows.push({
        stage: 'bone-mineral-content',
        label: 'Bone mineral content',
        value: formatWeight(values.boneMineralContentKg, units),
      });
    }
  }
  return rows;
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.input,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  rowText: { gap: space.xs, flexShrink: 1 },
});
