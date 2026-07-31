import { useRouter } from 'expo-router';

import { ChoiceList } from '@/components/Choice';
import { StepShell } from '@/components/StepShell';
import { GOALS } from '@/constants/activityLevels';
import { useOnboardingStore } from '@/store/onboardingStore';

const OPTIONS = GOALS.map((goal) => ({
  value: goal.value,
  label: goal.label,
  detail: goal.detail,
}));

export default function GoalStep() {
  const router = useRouter();
  const goal = useOnboardingStore((state) => state.goal);
  const set = useOnboardingStore((state) => state.set);

  return (
    <StepShell
      step="goal"
      title="What are you aiming for?"
      primaryLabel="Continue"
      primaryDisabled={goal === null}
      onPrimary={() => router.push('/onboarding/api-key')}
    >
      <ChoiceList
        options={OPTIONS}
        value={goal}
        onChange={(value) => set({ goal: value })}
      />
    </StepShell>
  );
}
