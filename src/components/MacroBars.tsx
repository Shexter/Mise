import { StyleSheet, View } from 'react-native';

import { Caption, SectionLabel } from '@/components/Type';
import { color, macroColor, radius, space } from '@/constants/theme';
import { formatGrams } from '@/logic/scaling';
import type { Macros } from '@/types';

interface Props {
  consumed: Macros;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
}

export function MacroBars({
  consumed,
  targetProteinG,
  targetCarbsG,
  targetFatG,
}: Props) {
  return (
    <View style={styles.group}>
      <MacroBar
        label="Protein"
        consumed={consumed.proteinG}
        target={targetProteinG}
        fill={macroColor.protein}
      />
      <MacroBar
        label="Carbs"
        consumed={consumed.carbsG}
        target={targetCarbsG}
        fill={macroColor.carbs}
      />
      <MacroBar
        label="Fat"
        consumed={consumed.fatG}
        target={targetFatG}
        fill={macroColor.fat}
      />
    </View>
  );
}

interface BarProps {
  label: string;
  consumed: number;
  target: number;
  fill: string;
}

function MacroBar({ label, consumed, target, fill }: BarProps) {
  const ratio = target > 0 ? Math.min(1, consumed / target) : 0;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}, ${formatGrams(consumed)} of ${formatGrams(
        target,
      )} grams`}
    >
      <View style={styles.header}>
        <SectionLabel muted>{label}</SectionLabel>
        <Caption muted numeric>
          {formatGrams(consumed)} / {formatGrams(target)} g
        </Caption>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${ratio * 100}%`, backgroundColor: fill },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.xs,
  },
  track: {
    height: space.sm,
    borderRadius: radius.input,
    backgroundColor: color.ground,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
});
