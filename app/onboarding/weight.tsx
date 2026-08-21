import { useRouter } from 'expo-router';
import { useState } from 'react';

import { FieldGuidance } from '@/components/onboarding/FieldGuidance';
import { MeasurementPicker } from '@/components/onboarding/MeasurementPicker';
import { StepShell } from '@/components/StepShell';
import { WEIGHT_ANCHOR_KG, WEIGHT_RANGE_KG } from '@/logic/onboardingDomain';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function WeightStep() {
  const router = useRouter();
  const weightKg = useOnboardingStore((state) => state.weightKg);
  const units = useOnboardingStore((state) => state.units);
  const set = useOnboardingStore((state) => state.set);
  const [confirmed, setConfirmed] = useState<number | null>(weightKg ?? null);

  return (
    <StepShell
      step="weight"
      title="What do you weigh?"
      detail="A rough figure is fine. You can change it in Settings whenever it moves."
      primaryLabel="Continue"
      primaryDisabled={confirmed === null}
      onPrimary={() => {
        if (confirmed === null) return;
        set({ weightKg: confirmed });
        router.push('/onboarding/activity');
      }}
    >
      <MeasurementPicker
        value={weightKg ?? null}
        anchor={WEIGHT_ANCHOR_KG}
        range={WEIGHT_RANGE_KG}
        kind="weight"
        unit={units}
        label="Weight"
        onConfirm={setConfirmed}
        onUnitChange={(next) => set({ units: next })}
      />
      <FieldGuidance field="weight" />
    </StepShell>
  );
}
