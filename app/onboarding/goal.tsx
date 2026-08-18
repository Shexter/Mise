import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ChoiceList, Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { StepShell } from '@/components/StepShell';
import { Button } from '@/components/Button';
import { Caption, SectionLabel } from '@/components/Type';
import { GOALS, WEIGHT_GOAL_RATE_RANGE } from '@/constants/activityLevels';
import { WEIGHT_RANGE_KG, kgToLb, lbToKg } from '@/logic/units';
import { weightGoalForecast } from '@/logic/weightGoalPacing';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { Units } from '@/types';

const OPTIONS = GOALS.map((goal) => ({
  value: goal.value,
  label: goal.label,
  detail: goal.detail,
}));

export default function GoalStep() {
  const router = useRouter();
  const goal = useOnboardingStore((state) => state.goal);
  const weightKg = useOnboardingStore((state) => state.weightKg);
  const draftUnits = useOnboardingStore((state) => state.units);
  const targetWeightKg = useOnboardingStore((state) => state.targetWeightKg);
  const weightGoalRateKgPerWeek = useOnboardingStore((state) => state.weightGoalRateKgPerWeek);
  const set = useOnboardingStore((state) => state.set);

  const [pacing, setPacing] = useState(targetWeightKg !== null && weightGoalRateKgPerWeek !== null);
  const [units, setUnits] = useState<Units>(draftUnits);
  const [targetText, setTargetText] = useState(
    targetWeightKg === null
      ? ''
      : units === 'metric'
        ? String(Math.round(targetWeightKg))
        : String(kgToLb(targetWeightKg)),
  );
  const [rate, setRate] = useState(weightGoalRateKgPerWeek ?? WEIGHT_GOAL_RATE_RANGE.min);

  const entered = Number.parseFloat(targetText);
  const enteredTargetKg = Number.isFinite(entered)
    ? units === 'metric'
      ? entered
      : lbToKg(entered)
    : null;
  const targetValid =
    enteredTargetKg !== null &&
    enteredTargetKg >= WEIGHT_RANGE_KG.min &&
    enteredTargetKg <= WEIGHT_RANGE_KG.max;

  const forecast =
    pacing && targetValid && weightKg !== null
      ? weightGoalForecast(weightKg, enteredTargetKg, rate, new Date())
      : null;

  return (
    <StepShell
      step="goal"
      title="What are you aiming for?"
      primaryLabel="Continue"
      primaryDisabled={goal === null || (pacing && !targetValid)}
      onPrimary={() => {
        set(
          pacing && targetValid
            ? { targetWeightKg: enteredTargetKg, weightGoalRateKgPerWeek: rate }
            : { targetWeightKg: null, weightGoalRateKgPerWeek: null },
        );
        router.push('/onboarding/api-key');
      }}
    >
      <ChoiceList
        options={OPTIONS}
        value={goal}
        onChange={(value) => set({ goal: value })}
      />
      <Button
        label={pacing ? 'Remove target and pace' : 'Set a target and pace'}
        variant="ghost"
        onPress={() => setPacing((current) => !current)}
      />
      {pacing ? (
        <>
          <Segmented
            options={[
              { value: 'metric', label: 'kg' },
              { value: 'imperial', label: 'lb' },
            ]}
            value={units}
            onChange={(next) => {
              const parsed = Number.parseFloat(targetText);
              if (Number.isFinite(parsed)) {
                setTargetText(
                  next === 'metric'
                    ? String(Math.round(lbToKg(parsed)))
                    : String(kgToLb(parsed)),
                );
              }
              setUnits(next);
            }}
          />
          <Field
            label="Target weight"
            value={targetText}
            onChangeText={setTargetText}
            keyboardType="decimal-pad"
            suffix={units === 'metric' ? 'kg' : 'lb'}
            numeric
            maxLength={5}
          />
          <SectionLabel>Weekly pace</SectionLabel>
          <Stepper
            label="Weekly pace"
            value={rate}
            onChange={setRate}
            step={0.1}
            min={WEIGHT_GOAL_RATE_RANGE.min}
            max={WEIGHT_GOAL_RATE_RANGE.max}
            unit="kg / week"
          />
          <Caption muted>
            {forecast
              ? forecast.weeksToGoal === 0
                ? "You're already at this weight."
                : `At this pace, an estimate — around ${format(forecast.forecastDate, 'd MMMM yyyy')}. Moves as your weight and pace change.`
              : 'Enter a target weight to see an estimate.'}
          </Caption>
        </>
      ) : null}
    </StepShell>
  );
}
