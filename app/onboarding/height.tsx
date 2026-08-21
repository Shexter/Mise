import { useRouter } from 'expo-router';
import { useState } from 'react';

import { FieldGuidance } from '@/components/onboarding/FieldGuidance';
import { MeasurementPicker } from '@/components/onboarding/MeasurementPicker';
import { StepShell } from '@/components/StepShell';
import { HEIGHT_ANCHOR_CM, HEIGHT_RANGE_CM } from '@/logic/onboardingDomain';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function HeightStep() {
  const router = useRouter();
  const heightCm = useOnboardingStore((state) => state.heightCm);
  const units = useOnboardingStore((state) => state.units);
  const set = useOnboardingStore((state) => state.set);
  const [confirmed, setConfirmed] = useState<number | null>(heightCm ?? null);

  return (
    <StepShell
      step="height"
      title="How tall are you?"
      primaryLabel="Continue"
      primaryDisabled={confirmed === null}
      onPrimary={() => {
        if (confirmed === null) return;
        set({ heightCm: confirmed });
        router.push('/onboarding/weight');
      }}
    >
      <MeasurementPicker
        value={heightCm ?? null}
        anchor={HEIGHT_ANCHOR_CM}
        range={HEIGHT_RANGE_CM}
        kind="height"
        unit={units}
        label="Height"
        onConfirm={setConfirmed}
        onUnitChange={(next) => set({ units: next })}
      />
      <FieldGuidance field="height" />
    </StepShell>
  );
}
