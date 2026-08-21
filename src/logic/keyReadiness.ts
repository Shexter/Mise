export type KeyReadinessPhase = 'checking' | 'present' | 'missing' | 'unavailable';

export interface KeyReadinessState {
  phase: KeyReadinessPhase;
  attempt: number;
  error: unknown | null;
}

export type KeyReadinessAction =
  | { type: 'CHECK' }
  | { type: 'RESOLVED'; present: boolean }
  | { type: 'REJECTED'; error: unknown }
  | { type: 'RETRY' };

export const INITIAL_KEY_READINESS: KeyReadinessState = { phase: 'checking', attempt: 1, error: null };

export function keyReadinessReducer(state: KeyReadinessState, action: KeyReadinessAction): KeyReadinessState {
  switch (action.type) {
    case 'CHECK': return { phase: 'checking', attempt: state.attempt || 1, error: null };
    case 'RETRY': return { phase: 'checking', attempt: state.attempt + 1, error: null };
    case 'RESOLVED': return { ...state, phase: action.present ? 'present' : 'missing', error: null };
    case 'REJECTED': return { ...state, phase: 'unavailable', error: action.error };
  }
}

export function manualEntryAvailable(state: KeyReadinessState): boolean {
  return state.phase !== 'present';
}

export async function checkKeyReadiness(
  state: KeyReadinessState,
  hasKey: () => Promise<boolean>,
): Promise<KeyReadinessState> {
  try {
    return keyReadinessReducer(state, { type: 'RESOLVED', present: await hasKey() });
  } catch (error) {
    return keyReadinessReducer(state, { type: 'REJECTED', error });
  }
}
