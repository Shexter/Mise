import { useRouter } from 'expo-router';

import { StepShell } from '@/components/StepShell';

export default function Welcome() {
  const router = useRouter();

  return (
    <StepShell
      step="welcome"
      showBack={false}
      title="Photograph a meal, get a calorie estimate."
      detail="Everything stays on this phone. No account, no server, no sync — deleting the app deletes your data."
      primaryLabel="Set up"
      onPrimary={() => router.push('/onboarding/sex')}
    />
  );
}
