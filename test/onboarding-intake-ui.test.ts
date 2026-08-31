import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { energyTargets } from '@/logic/bmr';
import { ONBOARDING_ENTRY_ROUTES, ONBOARDING_STEPS } from '@/store/onboardingStore';

const welcome = readFileSync('app/onboarding/welcome.tsx', 'utf8');
const energy = readFileSync('app/onboarding/energy.tsx', 'utf8');
const store = readFileSync('src/store/onboardingStore.ts', 'utf8');
const queries = readFileSync('src/db/queries.ts', 'utf8');
const exporter = readFileSync('src/logic/export.ts', 'utf8');

/**
 * The welcome rewrite and the scan intake are both copy-and-hierarchy work,
 * and both carry promises that are easy to erode by accident: that the
 * estimated path did not get longer, that a picture is not sent until asked,
 * and that nothing read off a report reaches storage without a person
 * confirming it. These assert those promises against the sources.
 */

describe('the welcome screen offers both starting points', () => {
  test('the two product paths are first-class choices', () => {
    expect(welcome).toContain('Where would you like to start?');
    expect(welcome).toContain('Daily calorie & macro target');
    expect(welcome).toContain('Kitchen & meal prep');
    expect(welcome).toContain('testID={`starting-point-${intent}`}');
  });

  test('each choice tracks its starting point and enters a distinct route', () => {
    expect(welcome).toContain('selectStartingPoint(startingPoint)');
    expect(welcome).toContain("setStartingPoint('calories')");
    expect(welcome).toContain("setStartingPoint('meal_prep')");
    expect(welcome).toContain("router.push('/onboarding/dietary')");
    expect(welcome).toContain('router.push(ONBOARDING_ENTRY_ROUTES[targetSource])');
  });

  test('DEXA, InBody, and known-figure options live in the calorie method sheet', () => {
    expect(welcome).toContain('How should we set your target?');
    expect(welcome).toContain('Scan a body composition report');
    expect(welcome).toContain('detail="DEXA or InBody"');
    expect(welcome).toContain('Enter a known calorie target');
    expect(welcome).toContain('detail="Use an exact daily calorie goal or resting BMR"');
    expect(welcome).not.toContain('Other ways to set a calorie target');
  });

  test('the local-versus-provider boundary is stated precisely', () => {
    expect(welcome).toContain('stays on this phone');
    expect(welcome).toContain('your own API');
    // It must not claim the report never leaves the device.
    expect(welcome.toLowerCase()).not.toContain('never leaves');
  });
});

describe('the estimated path remains direct', () => {
  test('route order, entry routes, and the calculation are identical', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'welcome', 'sex', 'age', 'height', 'weight', 'activity', 'goal', 'api-key', 'dietary', 'results',
    ]);
    expect(ONBOARDING_ENTRY_ROUTES.estimated).toBe('/onboarding/sex');
    expect(energyTargets({ sex: 'female', age: 30, heightCm: 170, weightKg: 70 }, 'moderate', 'maintain'))
      .toEqual({ maintenance: 2250, target: 2250 });
  });

  test('Continue enters the selected route with no extra routing screen', () => {
    expect(welcome).toContain('primaryLabel="Continue"');
    expect(welcome).toContain('onPrimary={continueSetup}');
    expect(welcome).toContain('router.push(ONBOARDING_ENTRY_ROUTES[targetSource])');
    // A chooser screen between welcome and the first question would show up here.
    expect(welcome).not.toContain('router.push(\'/onboarding/source');
  });
});

describe('scan copy neither oversells nor evaluates', () => {
  const forbidden = [
    'artificial intelligence', 'machine learning', 'neural', 'gpt', 'claude',
    'magic', 'smart', 'instantly', 'perfect',
    'guarantee', 'accurate', 'precise', 'healthy', 'diagnos', 'assess',
    'score', 'rank', 'judge', 'fitness', 'progress',
  ];

  test.each(forbidden)('neither screen uses %s', (word) => {
    expect(`${welcome}\n${energy}`.toLowerCase()).not.toContain(word);
  });
});

describe('a report is only sent when the person asks', () => {
  test('picking an image records the draft without extracting', () => {
    expect(energy).toContain('selectScanPhoto(asset.uri)');
    const picked = energy.indexOf('selectScanPhoto(asset.uri)');
    const analysed = energy.indexOf('extractBodyComposition(');
    expect(picked).toBeGreaterThan(-1);
    expect(analysed).toBeGreaterThan(picked);
    // Exactly one call site, and it is the one the "Read this report" button runs.
    expect(energy.match(/extractBodyComposition\(/g)).toHaveLength(1);
    expect(energy).toContain('label="Read this report" onPress={() => void analyse()}');
  });

  test('the request is cancellable and cancellation keeps the report', () => {
    expect(energy).toContain('new AbortController()');
    expect(energy).toContain('extractBodyComposition(scan.photoUri, controller.signal)');
    expect(energy).toContain("failScanExtraction('cancelled')");
    // Cancelling aborts but never clears the draft.
    const cancel = energy.slice(energy.indexOf('const cancelAnalysis'), energy.indexOf('const prefillFrom'));
    expect(cancel).not.toContain('clearScanDraft');
  });

  test('failure copy comes from the shared vision error contract', () => {
    expect(energy).toContain("import { copyForError } from '@/api/vision'");
    expect(energy).toContain('copyForError(');
  });
});

describe('every extracted value is reviewed before it is used', () => {
  test('the review is labelled as suggestions needing a check', () => {
    expect(energy).toContain('Detected from scan — check and adjust before continuing');
  });

  test('extraction fills editable fields and nothing else', () => {
    const prefill = energy.slice(energy.indexOf('const prefillFrom'), energy.indexOf('const discardReport'));
    for (const forbiddenWrite of ['saveBodyMeasurement', 'update(', 'create(']) {
      expect(prefill).not.toContain(forbiddenWrite);
    }
  });

  test('the measurement date is never taken from the analysis time', () => {
    const prefill = energy.slice(energy.indexOf('const prefillFrom'), energy.indexOf('const discardReport'));
    expect(prefill).toContain("setMeasuredOn('')");
    expect(prefill).not.toContain('localDateString()');
  });

  test('confirmation is blocked until the fields and the date are ready', () => {
    expect(energy).toContain("primaryDisabled={dbReadiness.phase !== 'ready' || !valid}");
    expect(energy).toContain('dateReady && (measurement !== null');
  });

  test('a detected provider is disclosed but never switched automatically', () => {
    expect(energy).toContain('extraction.provider !== source');
    expect(energy).toContain('label={`Switch to ${PROVIDER_LABELS[mismatch]}`}');
    // The only source changes are the segmented control and that explicit button.
    expect(energy.match(/setDraft\(\{ targetSource/g)).toHaveLength(1);
  });

  test('an InBody printed BMR needs an explicit choice before it is used', () => {
    expect(energy).toContain('useInBodyBmr && Number.isFinite(printedBmr)');
    expect(energy).toContain('Use the printed BMR instead');
  });

  test('the existing DEXA and InBody derivations are the ones used', () => {
    expect(energy).toContain('dexaFatFreeMass({');
    expect(energy).toContain('resolveTarget(preview, measurement ? [measurement] : [])');
    expect(energy).toContain('energyInputWarnings(preview, measurement ?? undefined)');
  });
});

describe('report evidence stays transient', () => {
  test('the confirmed save clears the draft', () => {
    const save = energy.slice(energy.indexOf('const save = useCallback'), energy.indexOf('const mismatch ='));
    expect(save).toContain('clearScanDraft()');
    expect(save).toContain('saveBodyMeasurement(measurement)');
  });

  test('a chosen InBody BMR becomes the existing stated resting figure, not a measurement field', () => {
    const types = readFileSync('src/types.ts', 'utf8');
    const measurement = types.slice(
      types.indexOf('export interface BodyMeasurement'),
      types.indexOf('}', types.indexOf('export interface BodyMeasurement')),
    );
    // The printed BMR has nowhere to live on a measurement, by design.
    expect(measurement).not.toMatch(/bmr/i);
    expect(energy).toContain("const activeSource = usePrintedBmr ? 'stated' : source");
    expect(energy).toContain("statedFigureKind: source === 'stated' ? kind : usePrintedBmr ? 'resting' : null");
  });

  test('a Settings edit seeds from the saved measurement and writes nothing on the way in', () => {
    const seed = energy.slice(energy.indexOf('const seededFor'), energy.indexOf('/* ----------------------------- Report intake'));
    expect(seed).toContain('getBodyMeasurements()');
    expect(seed).toContain('item.provider === source');
    for (const write of ['saveBodyMeasurement', 'update(', 'create(']) {
      expect(seed).not.toContain(write);
    }
  });

  test('the report is never copied into Mise storage', () => {
    expect(energy).not.toContain('preparePhoto');
    expect(energy).not.toContain('deleteAllPhotos');
  });

  test('the onboarding store is memory-only and carries no raw evidence', () => {
    expect(store).not.toContain('persist(');
    for (const field of ['base64', 'apiKey', 'rawResponse', 'AbortController']) {
      expect(store).not.toContain(field);
    }
  });

  test('no scan field reaches the database or the export', () => {
    for (const source of [queries, exporter]) {
      // `photoUri` is deliberately not checked here: meals and receipts have
      // their own stored images, and the scan draft's field shares the name.
      for (const field of ['scanDraft', 'BodyCompositionExtraction', 'bodyCompositionParser', 'extractBodyComposition']) {
        expect(source).not.toContain(field);
      }
    }
  });
});
