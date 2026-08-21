import { StyleSheet, View } from 'react-native';

import { ChoiceList, type ChoiceOption } from '@/components/Choice';
import { FieldGuidance } from '@/components/onboarding/FieldGuidance';
import { space } from '@/constants/theme';
import type { Sex } from '@/types';

interface Props {
  /** Null until answered — no option is preselected. */
  value: Sex | null;
  onChange: (value: Sex) => void;
}

/**
 * Sex as the Mifflin-St Jeor equation asks for it.
 *
 * The equation carries a different term for each of two cases, and that is
 * the entire reason this question exists. It is not a question about gender
 * identity, so the copy names the formula rather than the person, and nothing
 * is preselected — an inferred answer here would be a guess about someone
 * presented back to them as their own input.
 */
export function FormulaSexControl({ value, onChange }: Props) {
  return (
    <View style={styles.root} accessibilityRole="radiogroup" accessibilityLabel="Sex, for the metabolic rate formula">
      <ChoiceList options={OPTIONS} value={value} onChange={onChange} />
      <FieldGuidance field="formula-sex" />
    </View>
  );
}

const OPTIONS: ChoiceOption<Sex>[] = [
  { value: 'male', label: 'Male', detail: 'For the Mifflin-St Jeor equation' },
  { value: 'female', label: 'Female', detail: 'For the Mifflin-St Jeor equation' },
];

const styles = StyleSheet.create({
  root: { gap: space.base },
});
