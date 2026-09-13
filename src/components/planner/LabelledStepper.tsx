import { StyleSheet, View } from 'react-native';

import { Stepper } from '@/components/Stepper';
import { Body, Caption } from '@/components/Type';
import { space } from '@/constants/theme';

interface Props {
  label: string;
  /** One line under the label, for what the number actually controls. */
  detail?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}

/**
 * A stepper with its name visible, not just announced.
 *
 * `Stepper` takes a `label` but spends it entirely on `accessibilityLabel`,
 * which is right where surrounding copy already names the control. The planner
 * stacks two or three steppers in one view — recipe yield, Your portion, Batch
 * makes — and without a visible name they render as identical rows reading
 * "1 portions". A screen reader could tell them apart and a sighted person
 * could not, which is the wrong way round for that trade.
 *
 * The shared component is deliberately left alone: every other caller sits under
 * copy that already names it, and adding a heading there would double the label.
 */
export function LabelledStepper({ label, detail, ...stepper }: Props) {
  return (
    <View style={styles.root}>
      <Body>{label}</Body>
      {detail ? <Caption muted>{detail}</Caption> : null}
      <Stepper {...stepper} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xs },
});
