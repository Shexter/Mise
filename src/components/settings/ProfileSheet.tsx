import { useState } from 'react';

import { ChoiceList, Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import {
  ACTIVITY_LEVELS,
  AGE_RANGE,
  GOALS,
} from '@/constants/activityLevels';
import {
  HEIGHT_RANGE_CM,
  WEIGHT_RANGE_KG,
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
} from '@/logic/units';
import type { ActivityLevel, Goal, Profile, Sex, Units } from '@/types';

type Editable =
  | 'sex'
  | 'age'
  | 'height'
  | 'weight'
  | 'activity'
  | 'goal';

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
      ) : field === 'age' ? (
        <AgeEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : field === 'height' ? (
        <HeightEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : field === 'weight' ? (
        <WeightEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : field === 'activity' ? (
        <ActivityEditor profile={profile} onSave={onSave} onClose={onClose} />
      ) : (
        <GoalEditor profile={profile} onSave={onSave} onClose={onClose} />
      )}
    </Sheet>
  );
}

const TITLES: Record<Editable, string> = {
  sex: 'Formula',
  age: 'Age',
  height: 'Height',
  weight: 'Weight',
  activity: 'Activity',
  goal: 'Goal',
};

interface EditorProps {
  profile: Profile;
  onSave: (patch: Partial<Profile>) => void;
  onClose: () => void;
}

function SexEditor({ profile, onSave, onClose }: EditorProps) {
  const [sex, setSex] = useState<Sex>(profile.sex);
  return (
    <>
      <ChoiceList
        options={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ]}
        value={sex}
        onChange={setSex}
      />
      <Button
        label="Save"
        onPress={() => {
          onSave({ sex });
          onClose();
        }}
      />
    </>
  );
}

function AgeEditor({ profile, onSave, onClose }: EditorProps) {
  const [value, setValue] = useState(String(profile.age));
  const age = Number.parseInt(value, 10);
  const valid =
    Number.isFinite(age) && age >= AGE_RANGE.min && age <= AGE_RANGE.max;
  return (
    <>
      <Field
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
        suffix="years"
        numeric
        autoFocus
        maxLength={3}
      />
      <Button
        label="Save"
        disabled={!valid}
        onPress={() => {
          onSave({ age });
          onClose();
        }}
      />
    </>
  );
}

function HeightEditor({ profile, onSave, onClose }: EditorProps) {
  const [units, setUnits] = useState<Units>(profile.units);
  const start = cmToFeetInches(profile.heightCm);
  const [cm, setCm] = useState(String(Math.round(profile.heightCm)));
  const [feet, setFeet] = useState(String(start.feet));
  const [inches, setInches] = useState(String(start.inches));

  const resolved =
    units === 'metric'
      ? Number.parseFloat(cm)
      : feetInchesToCm({
          feet: Number.parseInt(feet, 10) || 0,
          inches: Number.parseInt(inches, 10) || 0,
        });
  const valid =
    Number.isFinite(resolved) &&
    resolved >= HEIGHT_RANGE_CM.min &&
    resolved <= HEIGHT_RANGE_CM.max;

  return (
    <>
      <Segmented
        options={[
          { value: 'metric', label: 'cm' },
          { value: 'imperial', label: 'ft / in' },
        ]}
        value={units}
        onChange={setUnits}
      />
      {units === 'metric' ? (
        <Field value={cm} onChangeText={setCm} keyboardType="number-pad" suffix="cm" numeric maxLength={3} />
      ) : (
        <>
          <Field value={feet} onChangeText={setFeet} keyboardType="number-pad" suffix="ft" numeric maxLength={1} />
          <Field value={inches} onChangeText={setInches} keyboardType="number-pad" suffix="in" numeric maxLength={2} />
        </>
      )}
      <Button
        label="Save"
        disabled={!valid}
        onPress={() => {
          onSave({ heightCm: resolved });
          onClose();
        }}
      />
    </>
  );
}

function WeightEditor({ profile, onSave, onClose }: EditorProps) {
  const [units, setUnits] = useState<Units>(profile.units);
  const [value, setValue] = useState(
    units === 'metric'
      ? String(Math.round(profile.weightKg))
      : String(kgToLb(profile.weightKg)),
  );

  const entered = Number.parseFloat(value);
  const kg = Number.isFinite(entered)
    ? units === 'metric'
      ? entered
      : lbToKg(entered)
    : NaN;
  const valid = kg >= WEIGHT_RANGE_KG.min && kg <= WEIGHT_RANGE_KG.max;

  return (
    <>
      <Segmented
        options={[
          { value: 'metric', label: 'kg' },
          { value: 'imperial', label: 'lb' },
        ]}
        value={units}
        onChange={(next) => {
          const parsed = Number.parseFloat(value);
          if (Number.isFinite(parsed)) {
            setValue(
              next === 'metric'
                ? String(Math.round(lbToKg(parsed)))
                : String(kgToLb(parsed)),
            );
          }
          setUnits(next);
        }}
      />
      <Field
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        suffix={units === 'metric' ? 'kg' : 'lb'}
        numeric
        maxLength={5}
      />
      <Button
        label="Save"
        disabled={!valid}
        onPress={() => {
          onSave({ weightKg: kg });
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
        label="Save"
        onPress={() => {
          onSave({ goal });
          onClose();
        }}
      />
    </>
  );
}
