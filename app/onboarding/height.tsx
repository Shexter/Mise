import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { StepShell } from '@/components/StepShell';
import { space } from '@/constants/theme';
import { HEIGHT_RANGE_CM, cmToFeetInches, feetInchesToCm } from '@/logic/units';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { Units } from '@/types';

const UNIT_OPTIONS = [
  { value: 'metric' as Units, label: 'cm' },
  { value: 'imperial' as Units, label: 'ft / in' },
];

export default function HeightStep() {
  const router = useRouter();
  const { heightCm, units, set } = useOnboardingStore();

  const initial = heightCm ? cmToFeetInches(heightCm) : null;
  const [cm, setCm] = useState(heightCm ? String(Math.round(heightCm)) : '');
  const [feet, setFeet] = useState(initial ? String(initial.feet) : '');
  const [inches, setInches] = useState(initial ? String(initial.inches) : '');

  const resolved = resolveHeight(units, cm, feet, inches);
  const valid =
    resolved !== null &&
    resolved >= HEIGHT_RANGE_CM.min &&
    resolved <= HEIGHT_RANGE_CM.max;

  const advance = () => {
    if (!valid || resolved === null) return;
    set({ heightCm: resolved });
    router.push('/onboarding/weight');
  };

  return (
    <StepShell
      step="height"
      title="How tall are you?"
      primaryLabel="Continue"
      primaryDisabled={!valid}
      onPrimary={advance}
    >
      <Segmented
        options={UNIT_OPTIONS}
        value={units}
        onChange={(value) => set({ units: value })}
      />

      {units === 'metric' ? (
        <Field
          value={cm}
          onChangeText={setCm}
          keyboardType="number-pad"
          placeholder="175"
          suffix="cm"
          numeric
          maxLength={3}
          onSubmitEditing={advance}
        />
      ) : (
        <View style={styles.pair}>
          <Field
            style={styles.half}
            value={feet}
            onChangeText={setFeet}
            keyboardType="number-pad"
            placeholder="5"
            suffix="ft"
            numeric
            maxLength={1}
          />
          <Field
            style={styles.half}
            value={inches}
            onChangeText={setInches}
            keyboardType="number-pad"
            placeholder="9"
            suffix="in"
            numeric
            maxLength={2}
            onSubmitEditing={advance}
          />
        </View>
      )}
    </StepShell>
  );
}

function resolveHeight(
  units: Units,
  cm: string,
  feet: string,
  inches: string,
): number | null {
  if (units === 'metric') {
    const parsed = Number.parseFloat(cm);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsedFeet = Number.parseInt(feet, 10);
  const parsedInches = inches.length === 0 ? 0 : Number.parseInt(inches, 10);
  if (!Number.isFinite(parsedFeet) || !Number.isFinite(parsedInches)) {
    return null;
  }
  return feetInchesToCm({ feet: parsedFeet, inches: parsedInches });
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
