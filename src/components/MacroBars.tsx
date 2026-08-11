import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, SectionLabel } from '@/components/Type';
import { color, macroColor, radius, space } from '@/constants/theme';
import { formatGrams } from '@/logic/scaling';
import type { Macros, SuggestionTargetMacro } from '@/types';

interface Props {
  consumed: Macros;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  targetFibreG: number;
  onRequest?: (macro: SuggestionTargetMacro | undefined) => void;
}

export function MacroBars({
  consumed,
  targetProteinG,
  targetCarbsG,
  targetFatG,
  targetFibreG,
  onRequest,
}: Props) {
  return (
    <View style={styles.group}>
      <MacroBar
        label="Protein"
        consumed={consumed.proteinG}
        target={targetProteinG}
        fill={macroColor.protein}
        macro="protein"
        onRequest={onRequest}
      />
      <MacroBar
        label="Fibre"
        consumed={consumed.fibreG}
        target={targetFibreG}
        fill={macroColor.fibre}
        unknownDetail="Fibre isn't fully known for today."
      />
      <MacroBar
        label="Carbs"
        consumed={consumed.carbsG}
        target={targetCarbsG}
        fill={macroColor.carbs}
        macro="carbs"
        onRequest={onRequest}
      />
      <MacroBar
        label="Fat"
        consumed={consumed.fatG}
        target={targetFatG}
        fill={macroColor.fat}
        macro="fat"
        onRequest={onRequest}
      />
    </View>
  );
}

interface BarProps {
  label: string;
  consumed: number | null;
  target: number;
  fill: string;
  macro?: SuggestionTargetMacro;
  onRequest?: (macro: SuggestionTargetMacro | undefined) => void;
  unknownDetail?: string;
}

function MacroBar({ label, consumed, target, fill, macro, onRequest, unknownDetail }: BarProps) {
  const ratio = consumed === null || target <= 0 ? 0 : Math.min(1, consumed / target);
  const shortfall = consumed === null ? null : Math.max(0, target - consumed);
  const canRequest = macro !== undefined && onRequest && shortfall !== null && shortfall > 0;

  return (
    <Pressable
      disabled={!canRequest}
      onPress={() => onRequest?.(macro)}
      accessible
      accessibilityRole={canRequest ? 'button' : 'progressbar'}
      accessibilityLabel={consumed === null
        ? `${label} is unavailable because one or more meal values are unknown.`
        : `${label}, ${formatGrams(consumed)} of ${formatGrams(target)} grams${canRequest ? `, get ideas for ${formatGrams(shortfall)} grams remaining` : ''}`}
    >
      <View style={styles.header}>
        <SectionLabel muted>{label}</SectionLabel>
        <Caption muted numeric>
          {consumed === null ? `Incomplete / ${formatGrams(target)} g` : `${formatGrams(consumed)} / ${formatGrams(target)} g`}
        </Caption>
      </View>
      {consumed === null ? <><View style={styles.incompleteTrack} />{unknownDetail ? <Caption muted style={styles.incompleteDetail}>{unknownDetail}</Caption> : null}</> : <View style={styles.track}><View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fill }]} /></View>}
    </Pressable>
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
  incompleteTrack: { height: space.sm, borderRadius: radius.input, borderWidth: 1, borderColor: color.line, borderStyle: 'dashed' },
  incompleteDetail: { marginTop: space.xs },
});
