import { useRouter } from 'expo-router';

import { DietaryRuleList } from '@/components/dietary/DietaryRuleList';
import { StepShell } from '@/components/StepShell';
import { useOnboardingStore } from '@/store/onboardingStore';

/**
 * Dietary rules, asked during onboarding and skippable (task 7.1) — someone
 * with a serious allergy should not have to find a settings screen to be
 * asked. Recorded straight to the database as they're added, same as
 * Settings; there is nothing to carry in the onboarding draft.
 */
export default function DietaryStep() {
  const router = useRouter();
  const intents = useOnboardingStore((state) => state.intents);
  const hasCalories = intents.includes('calories');

  const onContinue = () => {
    if (hasCalories) {
      router.push('/onboarding/results');
    } else {
      router.push('/onboarding/appliances');
    }
  };

  return (
    <StepShell
      step="dietary"
      title="Anything you avoid?"
      detail="Allergies and restrictions are filtered out of what Mise suggests. This is optional, and you can change it anytime in Settings."
      primaryLabel="Continue"
      onPrimary={onContinue}
    >
      <DietaryRuleList />
    </StepShell>
  );
}
