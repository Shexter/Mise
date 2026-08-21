import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { FIELD_GUIDANCE } from '@/copy/fieldGuidance';
import {
  createMeasuredIntakeState,
  measuredIntakeReducer,
  type MeasuredIntakeAction,
  type MeasuredIntakeState,
} from '@/logic/onboardingStages';

const stageView = readFileSync('src/components/onboarding/MeasuredStageView.tsx', 'utf8');
const summary = readFileSync('src/components/onboarding/MeasuredSummary.tsx', 'utf8');
const dateField = readFileSync('src/components/onboarding/MeasurementDateField.tsx', 'utf8');

function run(state: MeasuredIntakeState, actions: MeasuredIntakeAction[]): MeasuredIntakeState {
  return actions.reduce(measuredIntakeReducer, state);
}

function manualFlow(source: 'dexa' | 'inbody'): MeasuredIntakeState {
  return run(createMeasuredIntakeState('onboarding'), [
    { type: 'SET_FIELD', field: 'source', value: source },
    { type: 'NEXT' },
    { type: 'NEXT' },
    { type: 'SET_FIELD', field: 'mode', value: 'manual' },
    { type: 'NEXT' },
  ]);
}

describe('each source asks only for what it prints', () => {
  test('a manual DEXA flow walks date, weight, then an explicit path choice', () => {
    let state = manualFlow('dexa');
    expect(state.stage).toBe('measurement-date');
    state = run(state, [
      { type: 'SET_FIELD', field: 'measurementDate', value: '2026-02-01' },
      { type: 'CONFIRM' },
    ]);
    expect(state.stage).toBe('weight');
    state = run(state, [{ type: 'SET_FIELD', field: 'weightKg', value: 72 }, { type: 'CONFIRM' }]);
    expect(state.stage).toBe('dexa-path');
  });

  test('a manual InBody flow reaches Fat Free Mass and then the optional BMR', () => {
    let state = manualFlow('inbody');
    state = run(state, [
      { type: 'SET_FIELD', field: 'measurementDate', value: '2026-02-01' },
      { type: 'CONFIRM' },
      { type: 'SET_FIELD', field: 'weightKg', value: 72 },
      { type: 'CONFIRM' },
    ]);
    expect(state.stage).toBe('fat-free-mass');
    state = run(state, [{ type: 'SET_FIELD', field: 'fatFreeMassKg', value: 58 }, { type: 'CONFIRM' }]);
    expect(state.stage).toBe('optional-bmr');
  });

  test('neither flow ever asks for the other provider fields', () => {
    // The stage view renders a field only when its own stage is active.
    for (const [stage, field] of [
      ['fat-free-mass', 'fatFreeMassKg'],
      ['lean-tissue', 'leanTissueKg'],
      ['body-fat', 'bodyFatPct'],
    ] as const) {
      expect(stageView).toContain(`{stage === '${stage}' ? (`);
      expect(stageView).toContain(`field="${field}"`);
    }
  });

  test('no measured stage asks for formula sex, age, or height', () => {
    expect(stageView).not.toMatch(/FormulaSexControl|BirthdayPicker/);
    expect(stageView).not.toMatch(/heightCm|HEIGHT_RANGE_CM/);
    // Formula sex enters only as a cursor position for the body-fat anchor.
    expect(stageView).toContain('Only used to choose the body-fat cursor position');
  });
});

describe('report vocabulary is the report own', () => {
  test('InBody is asked for Fat Free Mass, exactly as printed', () => {
    expect(stageView).toContain("'fat-free-mass': 'What is the Fat Free Mass?'");
    expect(stageView).toContain('label="Fat Free Mass"');
    expect(summary).toContain("label: 'Fat Free Mass'");
    expect(FIELD_GUIDANCE['inbody-fat-free-mass'].vocabulary).toContain('Fat Free Mass');
  });

  test('the guidance warns Fat Free Mass is not Skeletal Muscle Mass', () => {
    expect(FIELD_GUIDANCE['inbody-fat-free-mass'].vocabulary).toContain('Skeletal Muscle Mass');
  });

  test('the DEXA branch names both printed options', () => {
    expect(stageView).toContain('Printed as "Body Fat %" or "% Fat"');
    expect(stageView).toContain('printed as "Lean Tissue" and "BMC"');
  });

  test('every numeric stage carries its guidance', () => {
    for (const stage of ['measurement-date', 'weight', 'body-fat', 'lean-tissue', 'bone-mineral-content', 'fat-free-mass', 'optional-bmr']) {
      const key = /^[a-z]+$/.test(stage) ? `${stage}: {` : `'${stage}': {`;
      expect(stageView, stage).toContain(key);
    }
    expect(stageView).toContain('{guidance ? <FieldGuidance field={guidance} /> : null}');
  });
});

describe('extracted values stay evidence until reviewed', () => {
  test('a candidate seeds the control but arrives unconfirmed', () => {
    expect(stageView).toContain("origin={extracted ? 'extracted' : 'saved'}");
    expect(stageView).toContain('An extracted number is evidence, not an answer');
  });

  test('the reviewed banner appears only where a candidate exists', () => {
    expect(stageView).toContain('candidateFor(stage, candidates) !== null');
    expect(stageView).toContain('Read from your report — check it and adjust before continuing.');
  });

  test('the reducer refuses to advance a stage whose field is unconfirmed', () => {
    const state = manualFlow('dexa');
    const nudged = measuredIntakeReducer(state, { type: 'NEXT' });
    expect(nudged.stage).toBe('measurement-date');
  });

  test('setting a field clears its confirmation, so an edit must be re-confirmed', () => {
    let state = manualFlow('dexa');
    state = run(state, [
      { type: 'SET_FIELD', field: 'measurementDate', value: '2026-02-01' },
      { type: 'CONFIRM' },
    ]);
    expect(state.confirmed.measurementDate).toBe(true);
    state = measuredIntakeReducer(state, { type: 'SET_FIELD', field: 'measurementDate', value: '2026-03-01' });
    expect(state.confirmed.measurementDate).toBe(false);
  });
});

describe('body fat is adjustable without being graded', () => {
  test('the anchor follows a confirmed formula sex and falls back when absent', () => {
    expect(stageView).toContain('anchor={bodyFatAnchorFor(formulaSex)}');
    expect(stageView).toContain('BODY_FAT_ANCHOR_PCT.unavailable');
  });

  test('a typed outlier is reported for the warn-and-confirm path, not clamped', () => {
    expect(stageView).toContain('allowOutOfRange\n');
    expect(stageView).toContain('if (outOfRange) onOutOfRange?.(field, value);');
    expect(stageView).toContain('needs the warn-and-confirm path');
  });
});

describe('the optional BMR is genuinely optional', () => {
  test('skipping is a first-class action that records nothing', () => {
    expect(stageView).toContain('label="Skip — my sheet does not print one"');
    expect(stageView).toContain("onSetField('bmrKcal', null);");
  });

  test('the summary says plainly when none was given', () => {
    expect(summary).toContain("values.bmrKcal === null ? 'Not provided'");
  });
});

describe('the summary writes nothing until Save', () => {
  test('it shows only source-relevant rows', () => {
    expect(summary).toContain("if (source === 'inbody')");
    expect(summary).toContain("dexaPath === 'body-fat' && values.bodyFatPct !== null");
    expect(summary).toContain("dexaPath === 'lean-bmc'");
    expect(summary).toContain("The other provider's rows never appear");
  });

  test('every row routes back to the stage that set it', () => {
    expect(summary).toContain('onPress={() => onEdit(row.stage)}');
    expect(summary).toContain('accessibilityLabel={`${row.label}: ${row.value}. Edit`}');
  });

  test('it performs no write of its own', () => {
    for (const term of ['saveBodyMeasurement', 'resolveTarget', 'useProfileStore', 'profileStore', '@/db/queries']) {
      expect(summary, term).not.toContain(term);
    }
    // The only `create` in the file is StyleSheet's.
    expect(summary.match(/\bcreate\(/g) ?? []).toHaveLength(1);
    expect(summary).toContain('StyleSheet.create({');
  });

  test('a failed save says nothing was changed and offers a retry', () => {
    expect(summary).toContain('your saved measurement and calorie target are as');
    expect(summary).toContain('onPress={onRetry}');
  });

  test('cancelling from the save stage returns to the summary, not to the start', () => {
    let state = manualFlow('inbody');
    state = run(state, [
      { type: 'SET_FIELD', field: 'measurementDate', value: '2026-02-01' },
      { type: 'CONFIRM' },
      { type: 'SET_FIELD', field: 'weightKg', value: 72 },
      { type: 'CONFIRM' },
      { type: 'SET_FIELD', field: 'fatFreeMassKg', value: 58 },
      { type: 'CONFIRM' },
      { type: 'CONFIRM' },
      { type: 'CONFIRM' },
    ]);
    expect(state.stage).toBe('save');
    expect(measuredIntakeReducer(state, { type: 'CANCEL' }).stage).toBe('summary');
  });
});

describe('the measurement date is a real stored date', () => {
  test('a future date cannot be confirmed', () => {
    expect(dateField).toContain('const inFuture =');
    expect(dateField).toContain('disabled={inFuture}');
    expect(dateField).toContain('That date has not happened yet');
  });

  test('it asks for the date on the report, not the date of entry', () => {
    expect(FIELD_GUIDANCE['dexa-measurement-date'].accepted).toContain('not the date you are entering it');
    expect(FIELD_GUIDANCE['inbody-measurement-date'].accepted).toContain('not the date you are entering it');
  });

  test('it emits an ISO date and seeds from one', () => {
    expect(dateField).toContain('onConfirm: (isoDate: string) => void');
    expect(dateField).toContain('/^(\\d{4})-(\\d{2})-(\\d{2})$/');
  });
});
