import { describe, expect, test } from 'vitest';

import { checkKeyReadiness, INITIAL_KEY_READINESS, keyReadinessReducer, manualEntryAvailable } from '@/logic/keyReadiness';

describe('key readiness controller', () => {
  test('starts checking and detects present or missing keys', async () => {
    expect(INITIAL_KEY_READINESS.phase).toBe('checking');
    expect((await checkKeyReadiness(INITIAL_KEY_READINESS, async () => true)).phase).toBe('present');
    expect((await checkKeyReadiness(INITIAL_KEY_READINESS, async () => false)).phase).toBe('missing');
  });

  test('secure-store rejection is unavailable, not missing', async () => {
    const state = await checkKeyReadiness(INITIAL_KEY_READINESS, async () => { throw new Error('keychain locked'); });
    expect(state).toMatchObject({ phase: 'unavailable', error: expect.any(Error) });
  });

  test('Retry increments attempt and returns to checking', () => {
    const unavailable = keyReadinessReducer(INITIAL_KEY_READINESS, { type: 'REJECTED', error: 'x' });
    expect(keyReadinessReducer(unavailable, { type: 'RETRY' })).toEqual({ phase: 'checking', attempt: 2, error: null });
  });

  test('manual entry remains available in every non-present state', () => {
    for (const phase of ['checking', 'missing', 'unavailable'] as const) {
      expect(manualEntryAvailable({ phase, attempt: 1, error: null })).toBe(true);
    }
    expect(manualEntryAvailable({ phase: 'present', attempt: 1, error: null })).toBe(false);
  });
});
