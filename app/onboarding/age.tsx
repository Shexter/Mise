import { useRouter } from 'expo-router';
import { useState } from 'react';

import { BirthdayPicker } from '@/components/onboarding/BirthdayPicker';
import { FieldGuidance } from '@/components/onboarding/FieldGuidance';
import { StepShell } from '@/components/StepShell';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function AgeStep() {
  const router = useRouter();
  const stored = useOnboardingStore((state) => state.age);
  const set = useOnboardingStore((state) => state.set);
  /**
   * The confirmed age, and only the age. The year/month/day tuple never
   * leaves `BirthdayPicker`'s own state, so unmounting this route is all it
   * takes for the birth date to be gone.
   */
  const [age, setAge] = useState<number | null>(stored ?? null);

  return (
    <StepShell
      step="age"
      title="When were you born?"
      primaryLabel="Continue"
      primaryDisabled={age === null}
      onPrimary={() => {
        if (age === null) return;
        set({ age });
        router.push('/onboarding/height');
      }}
    >
      {/*
        The step's own Continue is the confirming action, so the picker does
        not offer a second one — a supported date on the dials is enough to
        move on. The picker restates the age it arrives at as it changes.
      */}
      <BirthdayPicker onConfirm={setAge} onAgeChange={setAge} showConfirm={false} />
      <FieldGuidance field="birthday" />
    </StepShell>
  );
}
