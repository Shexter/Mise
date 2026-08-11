import { useRouter } from 'expo-router';

import { StepShell } from '@/components/StepShell';
import { Caption } from '@/components/Type';
import { Button } from '@/components/Button';
import { ONBOARDING_ENTRY_ROUTES, useOnboardingStore } from '@/store/onboardingStore';

export default function Welcome() {
  const router = useRouter();
  const set = useOnboardingStore((state) => state.set);

  return (
    <StepShell
      step="welcome"
      showBack={false}
      title="Photograph a meal, get a calorie estimate."
      detail="Set up your target from your age, height, weight, usual activity, and goal. Everything stays on this phone."
      primaryLabel="Set up with my details"
      onPrimary={() => {
        set({ targetSource: 'estimated' });
        router.push(ONBOARDING_ENTRY_ROUTES.estimated);
      }}
    >
      <Caption muted>Optional: use an energy figure you already have.</Caption>
      <Button label="I have a DEXA scan" variant="secondary" onPress={() => { set({ targetSource: 'dexa' }); router.push(ONBOARDING_ENTRY_ROUTES.dexa); }} />
      <Button label="I have an InBody result" variant="secondary" onPress={() => { set({ targetSource: 'inbody' }); router.push(ONBOARDING_ENTRY_ROUTES.inbody); }} />
      <Button label="I know my daily figure" variant="secondary" onPress={() => { set({ targetSource: 'stated' }); router.push(ONBOARDING_ENTRY_ROUTES.stated); }} />
    </StepShell>
  );
}
