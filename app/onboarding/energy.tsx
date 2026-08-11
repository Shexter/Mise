import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ChoiceList } from '@/components/Choice';
import { Field } from '@/components/Field';
import { StepShell } from '@/components/StepShell';
import { Caption } from '@/components/Type';
import { dexaFatFreeMass, energyInputWarnings, resolveTarget } from '@/logic/bodyComposition';
import { saveBodyMeasurement } from '@/db/queries';
import { DEFAULT_FIBRE_TARGET_G } from '@/logic/macros';
import { ACTIVITY_LEVELS, GOALS } from '@/constants/activityLevels';
import { ONBOARDING_SPLIT, useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import type { ActivityLevel, BodyMeasurement, Goal, Profile, StatedFigureKind } from '@/types';

const STATED_OPTIONS = [
  { value: 'resting' as StatedFigureKind, label: 'Resting energy', detail: 'Before normal activity.' },
  { value: 'total' as StatedFigureKind, label: 'Total daily energy', detail: 'Your full day before a goal change.' },
  { value: 'adjusted' as StatedFigureKind, label: 'Already-adjusted target', detail: 'The number you plan to eat.' },
];

export default function EnergySourceStep() {
  const router = useRouter();
  const draft = useOnboardingStore();
  const create = useProfileStore((state) => state.create);
  const existingProfile = useProfileStore((state) => state.profile);
  const update = useProfileStore((state) => state.update);
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [lean, setLean] = useState('');
  const [bmc, setBmc] = useState('');
  const [fatFreeMass, setFatFreeMass] = useState('');
  const [inBodyBmr, setInBodyBmr] = useState('');
  const [stated, setStated] = useState('');
  const [kind, setKind] = useState<StatedFigureKind>('total');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(existingProfile?.activityLevel ?? 'moderate');
  const [goal, setGoal] = useState<Goal>(existingProfile?.goal ?? 'maintain');
  const source = draft.targetSource;
  const kg = Number.parseFloat(weight);
  const statedCalories = Number.parseInt(stated, 10);
  const printedBmr = Number.parseInt(inBodyBmr, 10);
  const usePrintedBmr = source === 'inbody' && Number.isFinite(printedBmr);
  const activeSource = usePrintedBmr ? 'stated' : source;
  const measurement: BodyMeasurement | null = source === 'dexa' && Number.isFinite(kg)
    ? (() => { const value = dexaFatFreeMass({ weightKg: kg, bodyFatPct: numberOrNull(bodyFat), leanTissueKg: numberOrNull(lean), boneMineralContentKg: numberOrNull(bmc) }); return value === null ? null : { provider: 'dexa', weightKg: kg, measuredAt: new Date().toISOString(), bodyFatPct: numberOrNull(bodyFat), leanTissueKg: numberOrNull(lean), boneMineralContentKg: numberOrNull(bmc), fatFreeMassKg: value }; })()
    : source === 'inbody' && Number.isFinite(kg) && Number.isFinite(Number.parseFloat(fatFreeMass))
      ? { provider: 'inbody', weightKg: kg, measuredAt: new Date().toISOString(), bodyFatPct: null, leanTissueKg: null, boneMineralContentKg: null, fatFreeMassKg: Number.parseFloat(fatFreeMass) }
      : null;
  const valid = source === 'stated'
    ? Number.isFinite(statedCalories)
    : measurement !== null || (usePrintedBmr && Number.isFinite(kg));
  const preview: Profile = {
    sex: existingProfile?.sex ?? null,
    age: existingProfile?.age ?? null,
    heightCm: existingProfile?.heightCm ?? null,
    weightKg: source === 'stated' ? existingProfile?.weightKg ?? 70 : kg,
    activityLevel,
    goal,
    targetCalories: 0,
    targetSource: activeSource,
    statedCalories: source === 'stated' ? statedCalories : usePrintedBmr ? printedBmr : null,
    statedFigureKind: source === 'stated' ? kind : usePrintedBmr ? 'resting' : null,
    proteinPct: existingProfile?.proteinPct ?? ONBOARDING_SPLIT.proteinPct,
    carbsPct: existingProfile?.carbsPct ?? ONBOARDING_SPLIT.carbsPct,
    fatPct: existingProfile?.fatPct ?? ONBOARDING_SPLIT.fatPct,
    fibreTargetG: existingProfile?.fibreTargetG ?? DEFAULT_FIBRE_TARGET_G,
    units: existingProfile?.units ?? 'metric',
    onboardedAt: existingProfile?.onboardedAt ?? new Date().toISOString(),
  };
  const warnings = valid ? energyInputWarnings(preview, measurement ?? undefined) : [];
  const save = async () => {
    if (!valid) return;
    const target = resolveTarget(preview, measurement ? [measurement] : []);
    if (target === null) return;
    if (measurement) await saveBodyMeasurement(measurement);
    if (existingProfile) {
      await update({
        weightKg: preview.weightKg,
        activityLevel: preview.activityLevel,
        goal: preview.goal,
        targetSource: preview.targetSource,
        statedCalories: preview.statedCalories,
        statedFigureKind: preview.statedFigureKind,
        targetCalories: target,
      });
      router.back();
    } else {
      await create({ ...preview, targetCalories: target });
      router.replace('/(tabs)');
    }
  };
  return <StepShell step="welcome" title={source === 'dexa' ? 'Your DEXA inputs' : source === 'inbody' ? 'Your InBody inputs' : 'Your known figure'} detail="These are inputs to a calorie calculation. You can change them in Settings." primaryLabel="Use this figure" primaryDisabled={!valid} onPrimary={() => void save()}>
    {source === 'stated' ? <><Field label="Calories" value={stated} onChangeText={setStated} keyboardType="number-pad" suffix="kcal" numeric /><ChoiceList options={STATED_OPTIONS} value={kind} onChange={setKind} /></> : <><Field label="Weight at measurement" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix="kg" numeric />{source === 'dexa' ? <><Field label="Body fat percentage" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" suffix="%" numeric hint="Or enter lean tissue and bone mineral content." /><Field label="Lean tissue" value={lean} onChangeText={setLean} keyboardType="decimal-pad" suffix="kg" numeric /><Field label="Bone mineral content" value={bmc} onChangeText={setBmc} keyboardType="decimal-pad" suffix="kg" numeric /></> : <><Field label="Fat Free Mass" value={fatFreeMass} onChangeText={setFatFreeMass} keyboardType="decimal-pad" suffix="kg" numeric hint="Or use the printed BMR below." /><Field label="Printed BMR (optional)" value={inBodyBmr} onChangeText={setInBodyBmr} keyboardType="number-pad" suffix="kcal" numeric hint="This is saved as a stated resting figure, not a measurement." /></>}</>}
    {kind !== 'adjusted' ? <ChoiceList options={ACTIVITY_LEVELS.map((item) => ({ value: item.value, label: item.label, detail: item.detail }))} value={activityLevel} onChange={setActivityLevel} /> : null}
    {kind !== 'adjusted' ? <ChoiceList options={GOALS} value={goal} onChange={setGoal} /> : null}
    {warnings.map((warning) => <Caption key={warning}>{warning}</Caption>)}
  </StepShell>;
}

function numberOrNull(value: string): number | null { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : null; }
