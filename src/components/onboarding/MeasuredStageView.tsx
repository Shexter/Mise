import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ChoiceList } from '@/components/Choice';
import { Field } from '@/components/Field';
import { FieldGuidance } from '@/components/onboarding/FieldGuidance';
import { MeasurementDateField } from '@/components/onboarding/MeasurementDateField';
import { MeasurementPicker } from '@/components/onboarding/MeasurementPicker';
import { Caption, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import type { GuidanceField } from '@/copy/fieldGuidance';
import { parseDecimalString } from '@/logic/measurements';
import {
  BMR_RANGE_KCAL,
  BODY_FAT_ANCHOR_PCT,
  BODY_FAT_RANGE,
  BONE_MINERAL_CONTENT_RANGE_KG,
  FAT_FREE_MASS_RANGE_KG,
  LEAN_TISSUE_RANGE_KG,
  WEIGHT_ANCHOR_KG,
  WEIGHT_RANGE_KG,
} from '@/logic/onboardingDomain';
import type {
  DexaPath,
  MeasuredSource,
  MeasuredValues,
  MeasurementField,
  OnboardingStage,
} from '@/logic/onboardingStages';
import type { Sex, Units } from '@/types';

interface Props {
  stage: OnboardingStage;
  source: MeasuredSource;
  values: MeasuredValues;
  /** Read off the report and awaiting review. Seeds a control, confirms nothing. */
  candidates: Partial<MeasuredValues>;
  dexaPath: DexaPath | null;
  units: Units;
  /** Only used to choose the body-fat cursor position, and only if confirmed. */
  formulaSex: Sex | null;
  onSetField: (field: MeasurementField, value: number | string | null) => void;
  onSetDexaPath: (path: DexaPath) => void;
  onConfirm: () => void;
  onUnitChange?: (unit: Units) => void;
  /** Body fat only: a typed value outside 3-60% needs the warn-and-confirm path. */
  onOutOfRange?: (field: MeasurementField, value: number) => void;
}

const TITLES: Partial<Record<OnboardingStage, string>> = {
  'measurement-date': 'When was the scan taken?',
  weight: 'What weight does the report show?',
  'dexa-path': 'Which figures does your report give?',
  'body-fat': 'What body fat percentage does it show?',
  'lean-tissue': 'What is the lean tissue total?',
  'bone-mineral-content': 'What is the bone mineral content?',
  'fat-free-mass': 'What is the Fat Free Mass?',
  'optional-bmr': 'Does the sheet print a BMR?',
};

const GUIDANCE: Partial<Record<OnboardingStage, Record<MeasuredSource, GuidanceField>>> = {
  'measurement-date': { dexa: 'dexa-measurement-date', inbody: 'inbody-measurement-date' },
  weight: { dexa: 'weight', inbody: 'weight' },
  'body-fat': { dexa: 'body-fat', inbody: 'body-fat' },
  'lean-tissue': { dexa: 'dexa-lean-tissue', inbody: 'dexa-lean-tissue' },
  'bone-mineral-content': { dexa: 'dexa-bone-mineral-content', inbody: 'dexa-bone-mineral-content' },
  'fat-free-mass': { dexa: 'inbody-fat-free-mass', inbody: 'inbody-fat-free-mass' },
  'optional-bmr': { dexa: 'inbody-bmr', inbody: 'inbody-bmr' },
};

const DEXA_PATHS = [
  {
    value: 'body-fat' as DexaPath,
    label: 'A body fat percentage',
    detail: 'Printed as "Body Fat %" or "% Fat"',
  },
  {
    value: 'lean-bmc' as DexaPath,
    label: 'Lean tissue and bone mineral content',
    detail: 'Two totals in kilograms, printed as "Lean Tissue" and "BMC"',
  },
];

/**
 * One stage, one question.
 *
 * Every numeric stage asks for exactly the figure its source actually prints
 * and nothing else — a DEXA flow is never asked for Fat Free Mass, an InBody
 * flow is never asked for lean tissue or a body fat percentage, and neither is
 * asked for formula sex, age, or height, which belong to the estimated path.
 *
 * A value read off a report seeds its control as an unconfirmed candidate, so
 * it is visible and editable but still has to be confirmed by a person before
 * the reducer records it.
 */
export function MeasuredStageView({
  stage,
  source,
  values,
  candidates,
  dexaPath,
  units,
  formulaSex,
  onSetField,
  onSetDexaPath,
  onConfirm,
  onUnitChange,
  onOutOfRange,
}: Props) {
  const title = TITLES[stage];
  const guidance = GUIDANCE[stage]?.[source];
  if (!title) return null;

  return (
    <View style={styles.root}>
      <ScreenTitle>{title}</ScreenTitle>
      {candidateFor(stage, candidates) !== null ? (
        <Caption accessibilityLiveRegion="polite">
          Read from your report — check it and adjust before continuing.
        </Caption>
      ) : null}

      {stage === 'measurement-date' ? (
        <MeasurementDateField
          value={typeof values.measurementDate === 'string' ? values.measurementDate : null}
          onConfirm={(isoDate) => {
            onSetField('measurementDate', isoDate);
            onConfirm();
          }}
        />
      ) : null}

      {stage === 'dexa-path' ? (
        <ChoiceList options={DEXA_PATHS} value={dexaPath} onChange={onSetDexaPath} />
      ) : null}

      {stage === 'weight' ? (
        <NumericStage
          field="weightKg"
          seed={values.weightKg ?? candidates.weightKg ?? null}
          extracted={candidates.weightKg !== undefined}
          anchor={WEIGHT_ANCHOR_KG}
          range={WEIGHT_RANGE_KG}
          kind="weight"
          label="Weight"
          units={units}
          onSetField={onSetField}
          onConfirm={onConfirm}
          onUnitChange={onUnitChange}
        />
      ) : null}

      {stage === 'body-fat' ? (
        <NumericStage
          field="bodyFatPct"
          seed={values.bodyFatPct ?? candidates.bodyFatPct ?? null}
          extracted={candidates.bodyFatPct !== undefined}
          anchor={bodyFatAnchorFor(formulaSex)}
          range={BODY_FAT_RANGE}
          kind="percentage"
          label="Body fat percentage"
          units={units}
          allowOutOfRange
          onSetField={onSetField}
          onConfirm={onConfirm}
          onOutOfRange={onOutOfRange}
        />
      ) : null}

      {stage === 'lean-tissue' ? (
        <NumericStage
          field="leanTissueKg"
          seed={values.leanTissueKg ?? candidates.leanTissueKg ?? null}
          extracted={candidates.leanTissueKg !== undefined}
          anchor={WEIGHT_ANCHOR_KG}
          range={LEAN_TISSUE_RANGE_KG}
          kind="weight"
          label="Lean tissue"
          units={units}
          onSetField={onSetField}
          onConfirm={onConfirm}
          onUnitChange={onUnitChange}
        />
      ) : null}

      {stage === 'bone-mineral-content' ? (
        <NumericStage
          field="boneMineralContentKg"
          seed={values.boneMineralContentKg ?? candidates.boneMineralContentKg ?? null}
          extracted={candidates.boneMineralContentKg !== undefined}
          anchor={BONE_MINERAL_CONTENT_RANGE_KG.min + 2}
          range={BONE_MINERAL_CONTENT_RANGE_KG}
          kind="weight"
          label="Bone mineral content"
          units="metric"
          onSetField={onSetField}
          onConfirm={onConfirm}
        />
      ) : null}

      {stage === 'fat-free-mass' ? (
        <NumericStage
          field="fatFreeMassKg"
          seed={values.fatFreeMassKg ?? candidates.fatFreeMassKg ?? null}
          extracted={candidates.fatFreeMassKg !== undefined}
          anchor={WEIGHT_ANCHOR_KG}
          range={FAT_FREE_MASS_RANGE_KG}
          kind="weight"
          label="Fat Free Mass"
          units={units}
          onSetField={onSetField}
          onConfirm={onConfirm}
          onUnitChange={onUnitChange}
        />
      ) : null}

      {stage === 'optional-bmr' ? (
        <OptionalBmrStage
          seed={values.bmrKcal ?? candidates.bmrKcal ?? null}
          onSetField={onSetField}
          onConfirm={onConfirm}
        />
      ) : null}

      {guidance ? <FieldGuidance field={guidance} /> : null}

      {stage === 'dexa-path' ? (
        <Button label="Continue" disabled={dexaPath === null} onPress={onConfirm} />
      ) : null}
    </View>
  );
}

interface NumericStageProps {
  field: MeasurementField;
  seed: number | null;
  extracted: boolean;
  anchor: number;
  range: { min: number; max: number };
  kind: 'weight' | 'percentage';
  label: string;
  units: Units;
  allowOutOfRange?: boolean;
  onSetField: (field: MeasurementField, value: number) => void;
  onConfirm: () => void;
  onUnitChange?: (unit: Units) => void;
  onOutOfRange?: (field: MeasurementField, value: number) => void;
}

function NumericStage({
  field,
  seed,
  extracted,
  anchor,
  range,
  kind,
  label,
  units,
  allowOutOfRange = false,
  onSetField,
  onConfirm,
  onUnitChange,
  onOutOfRange,
}: NumericStageProps) {
  const [answered, setAnswered] = useState(seed !== null && !extracted);

  return (
    <View style={styles.stage}>
      <MeasurementPicker
        value={seed}
        anchor={anchor}
        range={range}
        kind={kind}
        unit={kind === 'percentage' ? 'metric' : units}
        label={label}
        /* An extracted number is evidence, not an answer, so it starts unconfirmed. */
        origin={extracted ? 'extracted' : 'saved'}
        allowOutOfRange={allowOutOfRange}
        onUnitChange={onUnitChange}
        onConfirm={(value, outOfRange) => {
          onSetField(field, value);
          setAnswered(true);
          if (outOfRange) onOutOfRange?.(field, value);
        }}
      />
      <Button label="Continue" disabled={!answered} onPress={onConfirm} />
    </View>
  );
}

/** The one stage a person is meant to be able to walk straight past. */
function OptionalBmrStage({
  seed,
  onSetField,
  onConfirm,
}: {
  seed: number | null;
  onSetField: (field: MeasurementField, value: number | null) => void;
  onConfirm: () => void;
}) {
  const [text, setText] = useState(seed === null ? '' : String(seed));
  const parsed = parseDecimalString(text, BMR_RANGE_KCAL);
  const empty = text.trim().length === 0;

  return (
    <View style={styles.stage}>
      <Field
        label="Printed BMR"
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        suffix="kcal"
        numeric
        maxLength={5}
        error={!empty && !parsed.ok ? `Enter a value between ${BMR_RANGE_KCAL.min} and ${BMR_RANGE_KCAL.max} kcal.` : undefined}
      />
      <Button
        label="Use this figure"
        disabled={!parsed.ok}
        onPress={() => {
          if (!parsed.ok) return;
          onSetField('bmrKcal', parsed.value);
          onConfirm();
        }}
      />
      <Button
        label="Skip — my sheet does not print one"
        variant="secondary"
        onPress={() => {
          onSetField('bmrKcal', null);
          onConfirm();
        }}
      />
    </View>
  );
}

function bodyFatAnchorFor(sex: Sex | null): number {
  if (sex === 'male') return BODY_FAT_ANCHOR_PCT.male;
  if (sex === 'female') return BODY_FAT_ANCHOR_PCT.female;
  return BODY_FAT_ANCHOR_PCT.unavailable;
}

function candidateFor(
  stage: OnboardingStage,
  candidates: Partial<MeasuredValues>,
): number | string | null {
  const map: Partial<Record<OnboardingStage, keyof MeasuredValues>> = {
    'measurement-date': 'measurementDate',
    weight: 'weightKg',
    'body-fat': 'bodyFatPct',
    'lean-tissue': 'leanTissueKg',
    'bone-mineral-content': 'boneMineralContentKg',
    'fat-free-mass': 'fatFreeMassKg',
    'optional-bmr': 'bmrKcal',
  };
  const key = map[stage];
  return key ? candidates[key] ?? null : null;
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  stage: { gap: space.base },
});
