import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/Type';
import { color, radius, space } from '@/constants/theme';
import { FIELD_GUIDANCE, type GuidanceField } from '@/copy/fieldGuidance';

interface Props {
  field: GuidanceField;
}

/**
 * The quiet explanation beside a focused input: what it is for, what will be
 * accepted, and — where the field mirrors a printed report line — the exact
 * words to look for on the page. The copy itself lives in
 * `src/copy/fieldGuidance.ts`; this only renders it.
 */
export function FieldGuidance({ field }: Props) {
  const copy = FIELD_GUIDANCE[field];

  return (
    <View style={styles.root} accessible accessibilityRole="summary">
      <Caption muted>{copy.purpose}</Caption>
      <Caption muted>{copy.accepted}</Caption>
      {copy.vocabulary ? <Caption muted style={styles.vocabulary}>{copy.vocabulary}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.input,
    borderLeftWidth: space.xs / 2,
    borderLeftColor: color.line,
    backgroundColor: color.surface,
  },
  vocabulary: { paddingTop: space.xs },
});
