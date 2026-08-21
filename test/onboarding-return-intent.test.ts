import { beforeEach, describe, expect, test } from 'vitest';

import { resolveApiKeyReturnIntent, useOnboardingStore } from '@/store/onboardingStore';

beforeEach(() => useOnboardingStore.getState().reset());

describe('bounded API-key return intent', () => {
  test('consumes an energy intent exactly once while preserving the scan draft', () => {
    const store = useOnboardingStore.getState();
    store.selectScanPhoto('file:///private-report.jpg');
    store.setReturnIntent({ kind: 'energy-settings', source: 'inbody' });
    expect(useOnboardingStore.getState().consumeReturnIntent()).toEqual({ kind: 'energy-settings', source: 'inbody' });
    expect(useOnboardingStore.getState().consumeReturnIntent()).toEqual({ kind: 'default-onboarding' });
    expect(useOnboardingStore.getState().scanDraft?.photoUri).toBe('file:///private-report.jpg');
  });

  test('invalid values fall back without accepting arbitrary routes', () => {
    expect(resolveApiKeyReturnIntent({ kind: 'energy-settings', source: 'other', route: '/admin' })).toEqual({ kind: 'default-onboarding' });
  });

  test('reset clears origin and intent', () => {
    useOnboardingStore.getState().setMeasuredFlowOrigin('settings');
    useOnboardingStore.getState().setReturnIntent({ kind: 'energy-onboarding', source: 'dexa' });
    useOnboardingStore.getState().reset();
    expect(useOnboardingStore.getState()).toMatchObject({ measuredFlowOrigin: 'onboarding', returnIntent: { kind: 'default-onboarding' } });
  });
});
