import { describe, expect, test } from 'vitest';

import { createMeasuredIntakeState, measuredIntakeReducer, type MeasuredIntakeAction, type MeasuredIntakeState } from '@/logic/onboardingStages';

function reduce(state: MeasuredIntakeState, ...actions: MeasuredIntakeAction[]) {
  return actions.reduce(measuredIntakeReducer, state);
}

const set = (field: MeasuredIntakeAction extends infer _ ? string : never, value: unknown) => ({ type: 'SET_FIELD', field, value } as MeasuredIntakeAction);

describe('measured intake stages', () => {
  test('DEXA manual body-fat path is total and immutable', () => {
    const initial = createMeasuredIntakeState('onboarding');
    const state = reduce(initial,
      set('source', 'dexa'), { type: 'NEXT' }, { type: 'NEXT' },
      set('mode', 'manual'), { type: 'NEXT' },
      set('measurementDate', '2026-08-20'), { type: 'CONFIRM' },
      set('weightKg', 70), { type: 'CONFIRM' },
      set('dexaPath', 'body-fat'), { type: 'NEXT' },
      set('bodyFatPct', 22), { type: 'CONFIRM' },
    );
    expect(state.stage).toBe('summary');
    expect(initial.stage).toBe('source-select');
  });

  test('DEXA lean plus BMC and InBody FFM paths visit only their own fields', () => {
    let dexa = reduce(createMeasuredIntakeState('settings'), set('source', 'dexa'), { type: 'NEXT' }, { type: 'NEXT' }, set('mode', 'manual'), { type: 'NEXT' });
    dexa = reduce(dexa, set('measurementDate', '2026-08-20'), { type: 'CONFIRM' }, set('weightKg', 70), { type: 'CONFIRM' }, set('dexaPath', 'lean-bmc'), { type: 'NEXT' }, set('leanTissueKg', 50), { type: 'CONFIRM' }, set('boneMineralContentKg', 3), { type: 'CONFIRM' });
    expect(dexa.stage).toBe('summary');

    let inbody = reduce(createMeasuredIntakeState('onboarding'), set('source', 'inbody'), { type: 'NEXT' }, { type: 'NEXT' }, set('mode', 'manual'), { type: 'NEXT' }, set('measurementDate', '2026-08-20'), { type: 'CONFIRM' }, set('weightKg', 70), { type: 'CONFIRM' }, set('fatFreeMassKg', 55), { type: 'CONFIRM' });
    expect(inbody.stage).toBe('optional-bmr');
    expect(measuredIntakeReducer(inbody, { type: 'NEXT' }).stage).toBe('summary');
  });

  test('scan candidates stay separate and missing fields remain required', () => {
    const state = reduce(createMeasuredIntakeState('settings'), set('source', 'inbody'), { type: 'NEXT' }, { type: 'NEXT' }, set('mode', 'scan'), { type: 'NEXT' }, set('candidates', { weightKg: 70 }), { type: 'CONFIRM' });
    expect(state.stage).toBe('measurement-date');
    expect(state.values.weightKg).toBeNull();
    expect(state.candidates.weightKg).toBe(70);
  });

  test('back preserves values and cancel clears a flow', () => {
    const state = reduce(createMeasuredIntakeState('settings'), set('source', 'dexa'), { type: 'NEXT' }, { type: 'NEXT' }, set('mode', 'manual'), { type: 'NEXT' }, set('measurementDate', '2026-08-20'), { type: 'CONFIRM' }, { type: 'BACK' });
    expect(state.values.measurementDate).toBe('2026-08-20');
    expect(measuredIntakeReducer(state, { type: 'CANCEL' })).toEqual(createMeasuredIntakeState('settings'));
  });

  test('failed save retry rolls back to editable summary', () => {
    let state: MeasuredIntakeState = { ...createMeasuredIntakeState('onboarding'), stage: 'summary' };
    state = measuredIntakeReducer(state, { type: 'CONFIRM' });
    state = measuredIntakeReducer(state, set('saveError', 'disk full'));
    expect(state.saveStatus).toBe('failed');
    expect(measuredIntakeReducer(state, { type: 'RETRY' })).toMatchObject({ stage: 'summary', saveStatus: 'idle', error: null });
  });

  test('unknown or invalid field values are ignored exhaustively', () => {
    const state = createMeasuredIntakeState('onboarding');
    expect(measuredIntakeReducer(state, set('source', 'other'))).toBe(state);
  });
});
