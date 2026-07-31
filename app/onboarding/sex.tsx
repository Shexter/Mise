import { useRouter } from 'expo-router';

import { ChoiceList, type ChoiceOption } from '@/components/Choice';
import { StepShell } from '@/components/StepShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { Sex } from '@/types';

const OPTIONS: ChoiceOption<Sex>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export default function SexStep() {
  const router = useRouter();
  const sex = useOnboardingStore((state) => state.sex);
  const set = useOnboardingStore((state) => state.set);

  return (
    <StepShell
      step="sex"
      title="Which formula should we use?"
      detail="Mifflin-St Jeor uses a different constant for each. This is a calculation input, nothing more."
      primaryLabel="Continue"
      primaryDisabled={sex === null}
      onPrimary={() => router.push('/onboarding/age')}
    >
      <ChoiceList
        options={OPTIONS}
        value={sex}
        onChange={(value) => set({ sex: value })}
      />
    </StepShell>
  );
}
