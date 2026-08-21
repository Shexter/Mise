import { useRouter } from 'expo-router';

import { FormulaSexControl } from '@/components/onboarding/FormulaSexControl';
import { StepShell } from '@/components/StepShell';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function SexStep() {
  const router = useRouter();
  const sex = useOnboardingStore((state) => state.sex);
  const set = useOnboardingStore((state) => state.set);

  return (
    <StepShell
      step="sex"
      title="Which formula should we use?"
      primaryLabel="Continue"
      primaryDisabled={sex === null}
      onPrimary={() => router.push('/onboarding/age')}
    >
      <FormulaSexControl value={sex} onChange={(value) => set({ sex: value })} />
    </StepShell>
  );
}
