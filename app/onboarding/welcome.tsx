import { useRouter } from 'expo-router';

import { StepShell } from '@/components/StepShell';
import { Button } from '@/components/Button';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function Welcome() {
  const router = useRouter();
  const set = useOnboardingStore((state) => state.set);

  return (
    <StepShell
      step="welcome"
      showBack={false}
      title="Photograph a meal, get a calorie estimate."
      detail="Everything stays on this phone. No account, no server, no sync — deleting the app deletes your data."
      primaryLabel="Set up"
      onPrimary={() => {
        set({ targetSource: 'estimated' });
        router.push('/onboarding/sex');
      }}
    >
      <Button label="I have a DEXA scan" variant="secondary" onPress={() => { set({ targetSource: 'dexa' }); router.push('/onboarding/energy'); }} />
      <Button label="I have an InBody result" variant="secondary" onPress={() => { set({ targetSource: 'inbody' }); router.push('/onboarding/energy'); }} />
      <Button label="I know my daily figure" variant="secondary" onPress={() => { set({ targetSource: 'stated' }); router.push('/onboarding/energy'); }} />
    </StepShell>
  );
}
