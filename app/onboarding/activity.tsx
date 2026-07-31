import { useRouter } from 'expo-router';

import { ChoiceList } from '@/components/Choice';
import { StepShell } from '@/components/StepShell';
import { ACTIVITY_LEVELS } from '@/constants/activityLevels';
import { useOnboardingStore } from '@/store/onboardingStore';

const OPTIONS = ACTIVITY_LEVELS.map((level) => ({
  value: level.value,
  label: level.label,
  detail: level.detail,
}));

export default function ActivityStep() {
  const router = useRouter();
  const activityLevel = useOnboardingStore((state) => state.activityLevel);
  const set = useOnboardingStore((state) => state.set);

  return (
    <StepShell
      step="activity"
      title="How much do you move?"
      detail="Count deliberate exercise, not steps around the house."
      primaryLabel="Continue"
      primaryDisabled={activityLevel === null}
      onPrimary={() => router.push('/onboarding/goal')}
    >
      <ChoiceList
        options={OPTIONS}
        value={activityLevel}
        onChange={(value) => set({ activityLevel: value })}
      />
    </StepShell>
  );
}
