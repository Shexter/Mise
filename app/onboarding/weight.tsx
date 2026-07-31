import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { StepShell } from '@/components/StepShell';
import { WEIGHT_RANGE_KG, kgToLb, lbToKg } from '@/logic/units';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { Units } from '@/types';

const UNIT_OPTIONS = [
  { value: 'metric' as Units, label: 'kg' },
  { value: 'imperial' as Units, label: 'lb' },
];

export default function WeightStep() {
  const router = useRouter();
  const { weightKg, units, set } = useOnboardingStore();

  const [value, setValue] = useState(() => {
    if (!weightKg) return '';
    return units === 'metric'
      ? String(Math.round(weightKg))
      : String(kgToLb(weightKg));
  });

  const entered = Number.parseFloat(value);
  const kg = Number.isFinite(entered)
    ? units === 'metric'
      ? entered
      : lbToKg(entered)
    : null;
  const valid =
    kg !== null && kg >= WEIGHT_RANGE_KG.min && kg <= WEIGHT_RANGE_KG.max;

  const advance = () => {
    if (!valid || kg === null) return;
    set({ weightKg: kg });
    router.push('/onboarding/activity');
  };

  return (
    <StepShell
      step="weight"
      title="What do you weigh?"
      detail="A rough figure is fine. You can change it in Settings whenever it moves."
      primaryLabel="Continue"
      primaryDisabled={!valid}
      onPrimary={advance}
    >
      <Segmented
        options={UNIT_OPTIONS}
        value={units}
        onChange={(next) => {
          const parsed = Number.parseFloat(value);
          if (Number.isFinite(parsed)) {
            setValue(
              next === 'metric'
                ? String(Math.round(lbToKg(parsed)))
                : String(kgToLb(parsed)),
            );
          }
          set({ units: next });
        }}
      />
      <Field
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder={units === 'metric' ? '72' : '160'}
        suffix={units === 'metric' ? 'kg' : 'lb'}
        numeric
        maxLength={5}
        onSubmitEditing={advance}
      />
    </StepShell>
  );
}
