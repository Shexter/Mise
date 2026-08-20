import { beforeEach, describe, expect, test } from 'vitest';

import type { BodyCompositionExtraction } from '@/logic/bodyCompositionParser';
import { useOnboardingStore } from '@/store/onboardingStore';

const dexaExtraction = (patch: Partial<BodyCompositionExtraction> = {}): BodyCompositionExtraction => ({
  provider: 'dexa',
  weightKg: 72,
  bodyFatPct: 18,
  leanTissueKg: null,
  boneMineralContentKg: null,
  fatFreeMassKg: null,
  bmrKcal: null,
  confidence: 'high',
  issues: [],
  ...patch,
});

beforeEach(() => {
  useOnboardingStore.getState().reset();
});

describe('onboarding body-composition scan draft', () => {
  test('selects and replaces a photo with a clean transient draft', () => {
    useOnboardingStore.getState().selectScanPhoto('file:///first.jpg');
    expect(useOnboardingStore.getState().scanDraft).toEqual({
      phase: 'selected',
      photoUri: 'file:///first.jpg',
      extraction: null,
      confidence: null,
      issues: [],
      errorKind: null,
    });

    useOnboardingStore.getState().startScanExtraction();
    useOnboardingStore.getState().failScanExtraction('network');
    useOnboardingStore.getState().selectScanPhoto('file:///replacement.jpg');
    expect(useOnboardingStore.getState().scanDraft).toEqual({
      phase: 'selected',
      photoUri: 'file:///replacement.jpg',
      extraction: null,
      confidence: null,
      issues: [],
      errorKind: null,
    });
  });

  test('moves through extracting and review without changing onboarding inputs', () => {
    useOnboardingStore.getState().set({
      targetSource: 'dexa', activityLevel: 'moderate', goal: 'maintain',
    });
    useOnboardingStore.getState().selectScanPhoto('file:///dexa.jpg');
    useOnboardingStore.getState().startScanExtraction();
    expect(useOnboardingStore.getState().scanDraft?.phase).toBe('extracting');

    const extraction = dexaExtraction({
      confidence: 'low',
      issues: [{
        field: 'bodyFatPct', code: 'outside_prefill_bounds',
        message: 'Check it.', receivedValue: 2,
      }],
    });
    useOnboardingStore.getState().receiveScanExtraction(extraction);
    const state = useOnboardingStore.getState();
    expect(state.scanDraft).toMatchObject({
      phase: 'review', extraction, confidence: 'low', issues: extraction.issues,
      errorKind: null,
    });
    expect(state.weightKg).toBeNull();
    expect(state.targetSource).toBe('dexa');
    expect(state.activityLevel).toBe('moderate');
    expect(state.goal).toBe('maintain');
  });

  test('retains the URI and candidates across recoverable failure and cancellation', () => {
    useOnboardingStore.getState().selectScanPhoto('file:///report.jpg');
    useOnboardingStore.getState().receiveScanExtraction(dexaExtraction());
    useOnboardingStore.getState().startScanExtraction();
    useOnboardingStore.getState().failScanExtraction('rate_limited');
    expect(useOnboardingStore.getState().scanDraft).toMatchObject({
      phase: 'error', photoUri: 'file:///report.jpg',
      extraction: expect.objectContaining({ provider: 'dexa' }),
      errorKind: 'rate_limited',
    });

    useOnboardingStore.getState().startScanExtraction();
    useOnboardingStore.getState().failScanExtraction('cancelled');
    expect(useOnboardingStore.getState().scanDraft).toMatchObject({
      phase: 'error', photoUri: 'file:///report.jpg', errorKind: 'cancelled',
    });
  });

  test('clears on explicit discard and full reset', () => {
    useOnboardingStore.getState().selectScanPhoto('file:///report.jpg');
    useOnboardingStore.getState().clearScanDraft();
    expect(useOnboardingStore.getState().scanDraft).toBeNull();

    useOnboardingStore.getState().set({ age: 42, targetSource: 'inbody' });
    useOnboardingStore.getState().selectScanPhoto('file:///inbody.jpg');
    useOnboardingStore.getState().reset();
    expect(useOnboardingStore.getState().scanDraft).toBeNull();
    expect(useOnboardingStore.getState().age).toBeNull();
    expect(useOnboardingStore.getState().targetSource).toBe('estimated');
  });

  test('clears a reviewed draft when changing away from its provider', () => {
    useOnboardingStore.getState().set({ targetSource: 'dexa' });
    useOnboardingStore.getState().selectScanPhoto('file:///dexa.jpg');
    useOnboardingStore.getState().receiveScanExtraction(dexaExtraction());
    useOnboardingStore.getState().set({ targetSource: 'inbody' });
    expect(useOnboardingStore.getState().scanDraft).toBeNull();
  });

  test('keeps a mismatched review when an explicit source change matches the detected provider', () => {
    useOnboardingStore.getState().set({ targetSource: 'dexa' });
    useOnboardingStore.getState().selectScanPhoto('file:///mismatch.jpg');
    useOnboardingStore.getState().receiveScanExtraction(dexaExtraction({ provider: 'inbody' }));
    useOnboardingStore.getState().set({ targetSource: 'inbody' });
    expect(useOnboardingStore.getState().scanDraft).toMatchObject({
      phase: 'review', photoUri: 'file:///mismatch.jpg',
      extraction: expect.objectContaining({ provider: 'inbody' }),
    });
  });

  test('keeps the in-memory draft through unrelated Settings-style state access', () => {
    useOnboardingStore.getState().set({ targetSource: 'inbody' });
    useOnboardingStore.getState().selectScanPhoto('file:///inbody.jpg');
    useOnboardingStore.getState().receiveScanExtraction(dexaExtraction({ provider: 'inbody' }));
    useOnboardingStore.getState().set({ units: 'imperial' });

    const revisited = useOnboardingStore.getState();
    expect(revisited.scanDraft?.photoUri).toBe('file:///inbody.jpg');
    expect(revisited.scanDraft?.extraction?.provider).toBe('inbody');
    expect(revisited.units).toBe('imperial');
  });

  test('stores no controller, Error, raw response, base64, key, or timestamp fields', () => {
    useOnboardingStore.getState().selectScanPhoto('file:///report.jpg');
    useOnboardingStore.getState().receiveScanExtraction(dexaExtraction());
    const draft = useOnboardingStore.getState().scanDraft;
    expect(Object.keys(draft ?? {}).sort()).toEqual([
      'confidence', 'errorKind', 'extraction', 'issues', 'phase', 'photoUri',
    ]);
    const serialised = JSON.stringify(draft);
    expect(serialised).not.toMatch(/apiKey|base64|rawResponse|AbortController|measuredAt|timestamp/i);
  });

  test('transition actions are no-ops before a photo is selected', () => {
    useOnboardingStore.getState().startScanExtraction();
    useOnboardingStore.getState().receiveScanExtraction(dexaExtraction());
    useOnboardingStore.getState().failScanExtraction('network');
    expect(useOnboardingStore.getState().scanDraft).toBeNull();
  });
});
