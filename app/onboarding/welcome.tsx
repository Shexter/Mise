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
      title="Cook from what you have, tracked as you go."
      detail="Your diary is stored on this phone, with no Mise account or server. Photo analysis sends only the photo you choose to the provider for your API key."
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
