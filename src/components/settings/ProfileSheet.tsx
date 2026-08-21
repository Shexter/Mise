import { format } from 'date-fns';
import { useState } from 'react';

import { ChoiceList, Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { BirthdayPicker } from '@/components/onboarding/BirthdayPicker';
import { FieldGuidance } from '@/components/onboarding/FieldGuidance';
import { FormulaSexControl } from '@/components/onboarding/FormulaSexControl';
import { MeasurementPicker } from '@/components/onboarding/MeasurementPicker';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Stepper } from '@/components/Stepper';
import { Caption, SectionLabel } from '@/components/Type';
import {
  ACTIVITY_LEVELS,
  GOALS,
  WEIGHT_GOAL_RATE_RANGE,
} from '@/constants/activityLevels';
import {
  HEIGHT_ANCHOR_CM,
  HEIGHT_RANGE_CM,
  WEIGHT_ANCHOR_KG,
  WEIGHT_RANGE_KG,
} from '@/logic/onboardingDomain';
import { kgToLb, lbToKg } from '@/logic/units';
import { weightGoalForecast } from '@/logic/weightGoalPacing';
import type { ActivityLevel, Goal, Profile, Sex, Units } from '@/types';

type Editable =
  | 'formula'
  | 'sex'
  | 'age'
  | 'height'
  | 'weight'
  | 'activity'
  | 'goal'
  | 'fibre';

interface Props {
  visible: boolean;
  field: Editable | null;
  profile: Profile;
  onClose: () => void;
  onSave: (patch: Partial<Profile>) => void;
}

/**
 * Single-field editor for the profile card. Each field opens the sheet with only
 * its own control, so an edit stays one focused decision — the same spirit as
 * onboarding.
 */
export function ProfileSheet({ visible, field, profile, onClose, onSave }: Props) {
  if (!field) return null;

  return (
    <Sheet visible={visible} onClose={onClose} title={TITLES[field]}>
      {field === 'sex' ? (
        <SexEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : field === 'formula' ? (
        <FormulaEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : field === 'age' ? (
        <AgeEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : field === 'height' ? (
        <HeightEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : field === 'weight' ? (
        <WeightEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : field === 'activity' ? (
        <ActivityEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : field === 'fibre' ? (
        <FibreTargetEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : (
        <GoalEditor profile={profile} onSave={onSave} onClose={onClose} />
      )}
    </Sheet>
  );
}

const TITLES: Record<Editable, string> = {
  formula: 'Formula details',
  sex: 'Formula',
  age: 'Age',
  height: 'Height',
  weight: 'Weight',
  activity: 'Activity',
  goal: 'Goal',
  fibre: 'Daily fibre target',
};

interface EditorProps {
  profile: Profile;
  onSave: (patch: Partial<Profile>) => void;
  onClose: () => void;
}

/**
 * Settings seeds every control from what is actually saved, never from an
 * onboarding anchor, and writes nothing until Save. Closing the sheet leaves
 * the stored profile exactly as it was.
 *
 * Age is the exception worth explaining: Mise stores the integer age and
 * discards the birth date, so there is no date to put back into the picker.
 * Rather than reconstruct one — which would invent a birthday the person
 * never gave — the editor shows the saved age and asks for the birthday again
 * only if they want to change it.
 */
function FormulaEditor({ profile, onSave, onClose }: EditorProps) {
  const [sex, setSex] = useState<Sex | null>(profile.sex);
  const [age, setAge] = useState<number | null>(profile.age);
  const [heightCm, setHeightCm] = useState<number | null>(profile.heightCm);
  const valid = sex !== null && age !== null && heightCm !== null;

  return (
    <>
      <SectionLabel muted>Formula constant</SectionLabel>
      <FormulaSexControl value={sex} onChange={setSex} />

      <SectionLabel muted>Age</SectionLabel>
      <AgeRestatement age={age} />
      <BirthdayPicker onConfirm={setAge} />

      <SectionLabel muted>Height</SectionLabel>
      <MeasurementPicker
        value={profile.heightCm}
        anchor={HEIGHT_ANCHOR_CM}
        range={HEIGHT_RANGE_CM}
        kind="height"
        unit={profile.units}
        label="Height"
        onConfirm={setHeightCm}
      />

      <Button
        label="Use formula"
        disabled={!valid}
        onPress={() => {
          if (!valid) return;
          onSave({ sex, age, heightCm });
          onClose();
        }}
      />
    </>
  );
}

function SexEditor({ profile, onSave, onClose }: EditorProps) {
  const [sex, setSex] = useState<Sex | null>(profile.sex);
  return (
    <>
      <FormulaSexControl value={sex} onChange={setSex} />
      <Button
        label="Save"
        disabled={sex === null}
        onPress={() => {
          if (sex === null) return;
          onSave({ sex });
          onClose();
        }}
      />
    </>
  );
}

function AgeEditor({ profile, onSave, onClose }: EditorProps) {
  const [age, setAge] = useState<number | null>(profile.age);
  const changed = age !== null && age !== profile.age;
  return (
    <>
      <AgeRestatement age={profile.age} />
      <BirthdayPicker onConfirm={setAge} />
      <FieldGuidance field="birthday" />
      <Button
        label="Save"
        disabled={!changed}
        onPress={() => {
          if (age === null) return;
          onSave({ age });
          onClose();
        }}
      />
    </>
  );
}

/** Says plainly why the picker cannot open on the person's own birthday. */
function AgeRestatement({ age }: { age: number | null }) {
  return (
    <Caption muted>
      {age === null
        ? 'No age saved yet.'
        : `Currently ${age}. Mise keeps the age and not the date, so pick your birthday again to change it.`}
    </Caption>
  );
}

function HeightEditor({ profile, onSave, onClose }: EditorProps) {
  const [units, setUnits] = useState<Units>(profile.units);
  const [heightCm, setHeightCm] = useState<number | null>(profile.heightCm);
  return (
    <>
      <MeasurementPicker
        value={profile.heightCm}
        anchor={HEIGHT_ANCHOR_CM}
        range={HEIGHT_RANGE_CM}
        kind="height"
        unit={units}
        label="Height"
        onConfirm={setHeightCm}
        onUnitChange={setUnits}
      />
      <FieldGuidance field="height" />
      <Button
        label="Save"
        disabled={heightCm === null}
        onPress={() => {
          if (heightCm === null) return;
          onSave({ heightCm });
          onClose();
        }}
      />
    </>
  );
}

function WeightEditor({ profile, onSave, onClose }: EditorProps) {
  const [units, setUnits] = useState<Units>(profile.units);
  const [weightKg, setWeightKg] = useState<number | null>(profile.weightKg);
  return (
    <>
      <MeasurementPicker
        value={profile.weightKg}
        anchor={WEIGHT_ANCHOR_KG}
        range={WEIGHT_RANGE_KG}
        kind="weight"
        unit={units}
        label="Weight"
        onConfirm={setWeightKg}
        onUnitChange={setUnits}
      />
      <FieldGuidance field="weight" />
      <Button
        label="Save"
        disabled={weightKg === null}
        onPress={() => {
          if (weightKg === null) return;
          onSave({ weightKg });
          onClose();
        }}
      />
    </>
  );
}

function ActivityEditor({ profile, onSave, onClose }: EditorProps) {
  const [level, setLevel] = useState<ActivityLevel>(profile.activityLevel);
  return (
    <>
      <ChoiceList
        options={ACTIVITY_LEVELS.map((option) => ({
          value: option.value,
          label: option.label,
          detail: option.detail,
        }))}
        value={level}
        onChange={setLevel}
      />
      <Button
        label="Save"
        onPress={() => {
          onSave({ activityLevel: level });
          onClose();
        }}
      />
    </>
  );
}

function GoalEditor({ profile, onSave, onClose }: EditorProps) {
  const [goal, setGoal] = useState<Goal>(profile.goal);
  const [pacing, setPacing] = useState(
    profile.targetWeightKg !== null && profile.weightGoalRateKgPerWeek !== null,
  );
  const [units, setUnits] = useState<Units>(profile.units);
  const [targetText, setTargetText] = useState(
    profile.targetWeightKg === null
      ? ''
      : units === 'metric'
        ? String(Math.round(profile.targetWeightKg))
        : String(kgToLb(profile.targetWeightKg)),
  );
  const [rate, setRate] = useState(profile.weightGoalRateKgPerWeek ?? WEIGHT_GOAL_RATE_RANGE.min);

  const entered = Number.parseFloat(targetText);
  const targetWeightKg = Number.isFinite(entered)
    ? units === 'metric'
      ? entered
      : lbToKg(entered)
    : null;
  const targetValid =
    targetWeightKg !== null &&
    targetWeightKg >= WEIGHT_RANGE_KG.min &&
    targetWeightKg <= WEIGHT_RANGE_KG.max;

  const forecast =
    pacing && targetValid
      ? weightGoalForecast(profile.weightKg, targetWeightKg, rate, new Date())
      : null;

  return (
    <>
      <ChoiceList
        options={GOALS.map((option) => ({
          value: option.value,
          label: option.label,
          detail: option.detail,
        }))}
        value={goal}
        onChange={setGoal}
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
      <Button
        label="Save"
        disabled={pacing && !targetValid}
        onPress={() => {
          onSave(
            pacing && targetValid
              ? { goal, targetWeightKg, weightGoalRateKgPerWeek: rate }
              : { goal, targetWeightKg: null, weightGoalRateKgPerWeek: null },
          );
          onClose();
        }}
      />
    </>
  );
}

function FibreTargetEditor({ profile, onSave, onClose }: EditorProps) {
  const [value, setValue] = useState(String(profile.fibreTargetG));
  const target = Number.parseFloat(value);
  const valid = Number.isFinite(target) && target > 0;
  return (
    <>
      <Field label="Fibre target" value={value} onChangeText={setValue} keyboardType="decimal-pad" suffix="g" numeric autoFocus />
      <Caption muted>This is your own daily target. It does not change your calorie target.</Caption>
      <Button label="Save" disabled={!valid} onPress={() => { onSave({ fibreTargetG: target }); onClose(); }} />
    </>
  );
}
