export type MeasuredFlowOrigin = 'onboarding' | 'settings';
export type MeasuredSource = 'dexa' | 'inbody';
export type IntakeMode = 'scan' | 'manual';
export type DexaPath = 'body-fat' | 'lean-bmc';

export type OnboardingStage =
  | 'source-select'
  | 'key-gate'
  | 'scan-or-manual'
  | 'scan-review'
  | 'measurement-date'
  | 'weight'
  | 'dexa-path'
  | 'body-fat'
  | 'lean-tissue'
  | 'bone-mineral-content'
  | 'fat-free-mass'
  | 'optional-bmr'
  | 'summary'
  | 'save';

export type MeasurementField =
  | 'measurementDate'
  | 'weightKg'
  | 'bodyFatPct'
  | 'leanTissueKg'
  | 'boneMineralContentKg'
  | 'fatFreeMassKg'
  | 'bmrKcal';

export interface MeasuredValues {
  measurementDate: string | null;
  weightKg: number | null;
  bodyFatPct: number | null;
  leanTissueKg: number | null;
  boneMineralContentKg: number | null;
  fatFreeMassKg: number | null;
  bmrKcal: number | null;
}

export interface MeasuredIntakeState {
  origin: MeasuredFlowOrigin;
  stage: OnboardingStage;
  source: MeasuredSource | null;
  mode: IntakeMode | null;
  dexaPath: DexaPath | null;
  values: MeasuredValues;
  confirmed: Readonly<Record<MeasurementField, boolean>>;
  /** Provider output is review evidence only and never becomes confirmed implicitly. */
  candidates: Partial<MeasuredValues>;
  history: readonly OnboardingStage[];
  saveStatus: 'idle' | 'saving' | 'failed';
  error: string | null;
}

export type DeckField = MeasurementField | 'source' | 'mode' | 'dexaPath' | 'candidates' | 'saveError';
export type MeasuredIntakeAction =
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SET_FIELD'; field: DeckField; value: unknown }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'RETRY' };

const EMPTY_VALUES: MeasuredValues = {
  measurementDate: null, weightKg: null, bodyFatPct: null, leanTissueKg: null,
  boneMineralContentKg: null, fatFreeMassKg: null, bmrKcal: null,
};

const EMPTY_CONFIRMED: Record<MeasurementField, boolean> = {
  measurementDate: false, weightKg: false, bodyFatPct: false, leanTissueKg: false,
  boneMineralContentKg: false, fatFreeMassKg: false, bmrKcal: false,
};

export function createMeasuredIntakeState(origin: MeasuredFlowOrigin): MeasuredIntakeState {
  return { origin, stage: 'source-select', source: null, mode: null, dexaPath: null, values: { ...EMPTY_VALUES }, confirmed: { ...EMPTY_CONFIRMED }, candidates: {}, history: [], saveStatus: 'idle', error: null };
}

export function measuredIntakeReducer(state: MeasuredIntakeState, action: MeasuredIntakeAction): MeasuredIntakeState {
  switch (action.type) {
    case 'SET_FIELD':
      return setField(state, action.field, action.value);
    case 'NEXT':
      return advance(state);
    case 'CONFIRM': {
      if (state.stage === 'summary') return { ...push(state, 'save'), saveStatus: 'saving', error: null };
      const field = fieldForStage(state.stage);
      if (!field || state.values[field] === null) return advance(state);
      return advance({ ...state, confirmed: { ...state.confirmed, [field]: true } });
    }
    case 'BACK': {
      const previous = state.history[state.history.length - 1];
      return previous ? { ...state, stage: previous, history: state.history.slice(0, -1), error: null } : state;
    }
    case 'CANCEL':
      return state.stage === 'save'
        ? { ...state, stage: 'summary', history: state.history.slice(0, -1), saveStatus: 'idle', error: null }
        : createMeasuredIntakeState(state.origin);
    case 'RETRY':
      return state.saveStatus === 'failed'
        ? { ...state, stage: 'summary', saveStatus: 'idle', error: null }
        : state.stage === 'key-gate' ? { ...state, error: null } : state;
  }
}

function setField(state: MeasuredIntakeState, field: DeckField, value: unknown): MeasuredIntakeState {
  if (field === 'source' && (value === 'dexa' || value === 'inbody')) return { ...state, source: value };
  if (field === 'mode' && (value === 'scan' || value === 'manual')) return { ...state, mode: value };
  if (field === 'dexaPath' && (value === 'body-fat' || value === 'lean-bmc')) return { ...state, dexaPath: value };
  if (field === 'candidates' && isRecord(value)) return { ...state, candidates: { ...value } as Partial<MeasuredValues> };
  if (field === 'saveError' && typeof value === 'string') return { ...state, saveStatus: 'failed', error: value };
  if (isMeasurementField(field) && (value === null || typeof value === 'number' || typeof value === 'string')) {
    return { ...state, values: { ...state.values, [field]: value }, confirmed: { ...state.confirmed, [field]: false } } as MeasuredIntakeState;
  }
  return state;
}

function advance(state: MeasuredIntakeState): MeasuredIntakeState {
  switch (state.stage) {
    case 'source-select': return state.source ? push(state, 'key-gate') : state;
    case 'key-gate': return push(state, 'scan-or-manual');
    case 'scan-or-manual': return state.mode ? push(state, state.mode === 'scan' ? 'scan-review' : 'measurement-date') : state;
    case 'scan-review': return push(state, nextRequiredStage(state));
    case 'measurement-date': return state.confirmed.measurementDate ? push(state, nextRequiredStage(state)) : state;
    case 'weight': return state.confirmed.weightKg ? push(state, nextRequiredStage(state)) : state;
    case 'dexa-path': return state.dexaPath ? push(state, state.dexaPath === 'body-fat' ? 'body-fat' : 'lean-tissue') : state;
    case 'body-fat': return state.confirmed.bodyFatPct ? push(state, 'summary') : state;
    case 'lean-tissue': return state.confirmed.leanTissueKg ? push(state, 'bone-mineral-content') : state;
    case 'bone-mineral-content': return state.confirmed.boneMineralContentKg ? push(state, 'summary') : state;
    case 'fat-free-mass': return state.confirmed.fatFreeMassKg ? push(state, 'optional-bmr') : state;
    case 'optional-bmr': return push(state, 'summary');
    case 'summary': return state;
    case 'save': return state;
  }
}

function nextRequiredStage(state: MeasuredIntakeState): OnboardingStage {
  if (!state.confirmed.measurementDate) return 'measurement-date';
  if (!state.confirmed.weightKg) return 'weight';
  if (state.source === 'inbody') return state.confirmed.fatFreeMassKg ? 'optional-bmr' : 'fat-free-mass';
  if (!state.dexaPath) return 'dexa-path';
  if (state.dexaPath === 'body-fat') return state.confirmed.bodyFatPct ? 'summary' : 'body-fat';
  return !state.confirmed.leanTissueKg ? 'lean-tissue' : !state.confirmed.boneMineralContentKg ? 'bone-mineral-content' : 'summary';
}

function push(state: MeasuredIntakeState, stage: OnboardingStage): MeasuredIntakeState {
  return stage === state.stage ? state : { ...state, stage, history: [...state.history, state.stage] };
}

function fieldForStage(stage: OnboardingStage): MeasurementField | null {
  const map: Partial<Record<OnboardingStage, MeasurementField>> = {
    'measurement-date': 'measurementDate', weight: 'weightKg', 'body-fat': 'bodyFatPct',
    'lean-tissue': 'leanTissueKg', 'bone-mineral-content': 'boneMineralContentKg',
    'fat-free-mass': 'fatFreeMassKg', 'optional-bmr': 'bmrKcal',
  };
  return map[stage] ?? null;
}

function isMeasurementField(value: string): value is MeasurementField {
  return value in EMPTY_VALUES;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
