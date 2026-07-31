import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Field } from '@/components/Field';
import { StepShell } from '@/components/StepShell';
import { AGE_RANGE } from '@/constants/activityLevels';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function AgeStep() {
  const router = useRouter();
  const stored = useOnboardingStore((state) => state.age);
  const set = useOnboardingStore((state) => state.set);
  const [value, setValue] = useState(stored ? String(stored) : '');

  const age = Number.parseInt(value, 10);
  const valid =
    Number.isFinite(age) && age >= AGE_RANGE.min && age <= AGE_RANGE.max;
  const showError = value.length > 0 && !valid;

  const advance = () => {
    if (!valid) return;
    set({ age });
    router.push('/onboarding/height');
  };

  return (
    <StepShell
      step="age"
      title="How old are you?"
      primaryLabel="Continue"
      primaryDisabled={!valid}
      onPrimary={advance}
    >
      <Field
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
        placeholder="30"
        suffix="years"
        numeric
        autoFocus
        maxLength={3}
        onSubmitEditing={advance}
        error={
          showError
            ? `Enter an age between ${AGE_RANGE.min} and ${AGE_RANGE.max}.`
            : undefined
        }
      />
    </StepShell>
  );
}
