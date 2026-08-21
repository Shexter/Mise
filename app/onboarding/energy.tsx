import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { extractBodyComposition } from '@/api/bodyComposition';
import { VisionError, type VisionErrorKind } from '@/api/errors';
import { hasApiKey } from '@/api/keyStore';
import { copyForError } from '@/api/vision';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChoiceList, Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { ApiKeyExplainer } from '@/components/onboarding/ApiKeyExplainer';
import { ProcessingIndicator } from '@/components/ProcessingIndicator';
import { StepShell } from '@/components/StepShell';
import { Body, Caption, SectionLabel } from '@/components/Type';
import { ACTIVITY_LEVELS, GOALS } from '@/constants/activityLevels';
import { color, layout, radius, space } from '@/constants/theme';
import { useDbReadiness } from '@/db/readiness';
import { getBodyMeasurements, saveBodyMeasurement } from '@/db/queries';
import { dexaFatFreeMass, energyInputWarnings, resolveTarget } from '@/logic/bodyComposition';
import type { BodyCompositionExtraction } from '@/logic/bodyCompositionParser';
import { localDateString } from '@/logic/dates';
import { INITIAL_KEY_READINESS, keyReadinessReducer } from '@/logic/keyReadiness';
import { DEFAULT_FIBRE_TARGET_G } from '@/logic/macros';
import { createMeasuredIntakeState, measuredIntakeReducer } from '@/logic/onboardingStages';
import { ONBOARDING_SPLIT, useOnboardingStore } from '@/store/onboardingStore';
import { useProfileStore } from '@/store/profileStore';
import type {
  ActivityLevel,
  BodyMeasurement,
  Goal,
  Profile,
  StatedFigureKind,
  TargetSource,
} from '@/types';

const STATED_OPTIONS = [
  { value: 'resting' as StatedFigureKind, label: 'Resting energy', detail: 'Before normal activity.' },
  { value: 'total' as StatedFigureKind, label: 'Total daily energy', detail: 'Your full day before a goal change.' },
  { value: 'adjusted' as StatedFigureKind, label: 'Already-adjusted target', detail: 'The number you plan to eat.' },
];

const MEASURED_SOURCES = [
  { value: 'dexa' as const, label: 'DEXA' },
  { value: 'inbody' as const, label: 'InBody' },
];

const PROVIDER_LABELS: Record<'dexa' | 'inbody', string> = { dexa: 'DEXA', inbody: 'InBody' };

const CONFIDENCE_NOTE: Record<BodyCompositionExtraction['confidence'], string> = {
  high: 'Every field below was read clearly. Check them anyway.',
  medium: 'Some fields were harder to read. Check each one against your report.',
  low: 'This report was hard to read. Check every field against it before continuing.',
};

/**
 * The measured-input step, reached from the welcome screen's alternatives and
 * from the Settings source chooser.
 *
 * A report is an input aid, never an authority: the picture is previewed
 * before anything is sent, nothing is sent until the person asks, and every
 * extracted number lands in an ordinary editable field that must be confirmed
 * by hand. The saved profile, the active source, and both providers'
 * measurements are untouched until the confirm action at the bottom runs the
 * same code path manual entry has always run.
 */
export default function EnergySourceStep() {
  const router = useRouter();
  const draft = useOnboardingStore();
  const setDraft = useOnboardingStore((state) => state.set);
  const selectScanPhoto = useOnboardingStore((state) => state.selectScanPhoto);
  const startScanExtraction = useOnboardingStore((state) => state.startScanExtraction);
  const receiveScanExtraction = useOnboardingStore((state) => state.receiveScanExtraction);
  const failScanExtraction = useOnboardingStore((state) => state.failScanExtraction);
  const clearScanDraft = useOnboardingStore((state) => state.clearScanDraft);
  const setReturnIntent = useOnboardingStore((state) => state.setReturnIntent);
  const create = useProfileStore((state) => state.create);
  const existingProfile = useProfileStore((state) => state.profile);
  const update = useProfileStore((state) => state.update);
  const dbReadiness = useDbReadiness();

  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [lean, setLean] = useState('');
  const [bmc, setBmc] = useState('');
  const [fatFreeMass, setFatFreeMass] = useState('');
  const [inBodyBmr, setInBodyBmr] = useState('');
  const [useInBodyBmr, setUseInBodyBmr] = useState(false);
  const [stated, setStated] = useState('');
  const [kind, setKind] = useState<StatedFigureKind>('total');
  const [measuredOn, setMeasuredOn] = useState(localDateString());
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [manualOnly, setManualOnly] = useState(false);
  const [keyReadiness, dispatchKeyReadiness] = useReducer(keyReadinessReducer, INITIAL_KEY_READINESS);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(existingProfile?.activityLevel ?? 'moderate');
  const [goal, setGoal] = useState<Goal>(existingProfile?.goal ?? 'maintain');

  const abortRef = useRef<AbortController | null>(null);
  const source = draft.targetSource;
  const scan = draft.scanDraft;
  const measured = source === 'dexa' || source === 'inbody';
  const [measuredFlow, dispatchMeasuredFlow] = useReducer(
    measuredIntakeReducer,
    undefined,
    () => {
      let state = createMeasuredIntakeState(draft.measuredFlowOrigin);
      if (measured) {
        state = measuredIntakeReducer(state, { type: 'SET_FIELD', field: 'source', value: source });
        state = measuredIntakeReducer(state, { type: 'NEXT' });
      }
      return state;
    },
  );

  useEffect(() => {
    if (!measured) return;
    let active = true;
    void hasApiKey()
      .then((present) => {
        if (active) dispatchKeyReadiness({ type: 'RESOLVED', present });
      })
      .catch((error: unknown) => {
        if (active) dispatchKeyReadiness({ type: 'REJECTED', error });
      });
    return () => { active = false; };
  }, [keyReadiness.attempt, measured]);

  // Settings re-entry seeds the fields from the measurement already saved for
  // this provider, so an edit starts from what is stored rather than blank.
  // A scan draft already under way owns the fields instead and is not overwritten.
  const seededFor = useRef<TargetSource | null>(null);
  useEffect(() => {
    if (dbReadiness.phase !== 'ready' || !measured || seededFor.current === source || scan !== null) return;
    seededFor.current = source;
    void getBodyMeasurements().then((saved) => {
      const current = saved.find((item) => item.provider === source);
      if (!current) return;
      setWeight(String(current.weightKg));
      setMeasuredOn(current.measuredAt.slice(0, 10));
      if (source === 'dexa') {
        setBodyFat(current.bodyFatPct === null ? '' : String(current.bodyFatPct));
        setLean(current.leanTissueKg === null ? '' : String(current.leanTissueKg));
        setBmc(current.boneMineralContentKg === null ? '' : String(current.boneMineralContentKg));
      } else {
        setFatFreeMass(String(current.fatFreeMassKg));
      }
    });
  }, [dbReadiness.phase, measured, source, scan]);

  /* ----------------------------- Report intake ---------------------------- */

  const selectImage = async (from: 'library' | 'camera') => {
    setPickerError(null);
    try {
      const result = from === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      // The URI stays where the picker put it. A report is never copied into
      // Mise's own storage, so there is nothing to clean up afterwards.
      selectScanPhoto(asset.uri);
    } catch {
      setPickerError('Mise could not open your photos. You can type the figures in below instead.');
    }
  };

  const analyse = async () => {
    if (!scan) return;
    const controller = new AbortController();
    abortRef.current = controller;
    startScanExtraction();
    try {
      const extraction = await extractBodyComposition(scan.photoUri, controller.signal);
      receiveScanExtraction(extraction);
      prefillFrom(extraction);
    } catch (error) {
      failScanExtraction(error instanceof VisionError ? error.kind : 'malformed');
    } finally {
      abortRef.current = null;
    }
  };

  const cancelAnalysis = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    failScanExtraction('cancelled');
  };

  /**
   * Fills only the fields the chosen source actually uses, and only from
   * candidates the normaliser accepted — an out-of-bounds or
   * contradictory value arrives as null with an issue attached, and is left
   * for the person to type rather than pre-filled and quietly trusted.
   *
   * The measurement date is deliberately blanked: the analysis happened
   * today, the scan did not, and guessing that they are the same would put a
   * wrong date into saved history without anyone choosing it.
   */
  const prefillFrom = (extraction: BodyCompositionExtraction) => {
    const text = (value: number | null) => (value === null ? '' : String(round(value)));
    if (extraction.weightKg !== null) setWeight(text(extraction.weightKg));
    if (source === 'dexa') {
      if (extraction.bodyFatPct !== null) setBodyFat(text(extraction.bodyFatPct));
      if (extraction.leanTissueKg !== null) setLean(text(extraction.leanTissueKg));
      if (extraction.boneMineralContentKg !== null) setBmc(text(extraction.boneMineralContentKg));
    } else {
      if (extraction.fatFreeMassKg !== null) setFatFreeMass(text(extraction.fatFreeMassKg));
      if (extraction.bmrKcal !== null) setInBodyBmr(text(extraction.bmrKcal));
    }
    setMeasuredOn('');
  };

  const discardReport = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    clearScanDraft();
  };

  const changeSource = (next: 'dexa' | 'inbody') => {
    if (next === source) return;
    seededFor.current = null;
    dispatchMeasuredFlow({ type: 'SET_FIELD', field: 'source', value: next });
    setDraft({ targetSource: next });
  };

  const openKeySetup = () => {
    setReturnIntent({
      kind: measuredFlow.origin === 'settings' ? 'energy-settings' : 'energy-onboarding',
      source: source === 'inbody' ? 'inbody' : 'dexa',
    });
    router.push('/onboarding/api-key');
  };

  /* ------------------------------ Calculation ----------------------------- */
  /* Unchanged from manual entry: the same fields, parsed the same way, into
     the same existing derivation and resolver. A scan only changes where the
     characters in these fields came from. */

  const kg = Number.parseFloat(weight);
  const statedCalories = Number.parseInt(stated, 10);
  const printedBmr = Number.parseInt(inBodyBmr, 10);
  const usePrintedBmr = source === 'inbody' && useInBodyBmr && Number.isFinite(printedBmr);
  const activeSource = usePrintedBmr ? 'stated' : source;
  const measuredAt = measuredOn.trim().length > 0 ? `${measuredOn.trim()}T00:00:00.000Z` : null;
  const dateReady = source === 'stated' || (measuredAt !== null && !Number.isNaN(Date.parse(measuredAt)));

  const measurement: BodyMeasurement | null = (() => {
    if (!measured || !Number.isFinite(kg) || measuredAt === null) return null;
    if (source === 'dexa') {
      const value = dexaFatFreeMass({
        weightKg: kg,
        bodyFatPct: numberOrNull(bodyFat),
        leanTissueKg: numberOrNull(lean),
        boneMineralContentKg: numberOrNull(bmc),
      });
      return value === null ? null : {
        provider: 'dexa', weightKg: kg, measuredAt,
        bodyFatPct: numberOrNull(bodyFat),
        leanTissueKg: numberOrNull(lean),
        boneMineralContentKg: numberOrNull(bmc),
        fatFreeMassKg: value,
      };
    }
    const printed = Number.parseFloat(fatFreeMass);
    return Number.isFinite(printed) ? {
      provider: 'inbody', weightKg: kg, measuredAt,
      bodyFatPct: null, leanTissueKg: null, boneMineralContentKg: null,
      fatFreeMassKg: printed,
    } : null;
  })();

  const valid = source === 'stated'
    ? Number.isFinite(statedCalories)
    : dateReady && (measurement !== null || (usePrintedBmr && Number.isFinite(kg)));

  const preview: Profile = {
    sex: existingProfile?.sex ?? null,
    age: existingProfile?.age ?? null,
    heightCm: existingProfile?.heightCm ?? null,
    weightKg: source === 'stated' ? existingProfile?.weightKg ?? 70 : kg,
    activityLevel,
    goal,
    targetCalories: 0,
    targetSource: activeSource,
    statedCalories: source === 'stated' ? statedCalories : usePrintedBmr ? printedBmr : null,
    statedFigureKind: source === 'stated' ? kind : usePrintedBmr ? 'resting' : null,
    proteinPct: existingProfile?.proteinPct ?? ONBOARDING_SPLIT.proteinPct,
    carbsPct: existingProfile?.carbsPct ?? ONBOARDING_SPLIT.carbsPct,
    fatPct: existingProfile?.fatPct ?? ONBOARDING_SPLIT.fatPct,
    fibreTargetG: existingProfile?.fibreTargetG ?? DEFAULT_FIBRE_TARGET_G,
    units: existingProfile?.units ?? 'metric',
    onboardedAt: existingProfile?.onboardedAt ?? new Date().toISOString(),
    targetWeightKg: existingProfile?.targetWeightKg ?? null,
    weightGoalRateKgPerWeek: existingProfile?.weightGoalRateKgPerWeek ?? null,
  };
  const warnings = valid ? energyInputWarnings(preview, measurement ?? undefined) : [];

  const save = useCallback(async () => {
    if (dbReadiness.phase !== 'ready' || !valid || saving) return;
    setSaving(true);
    try {
      const target = resolveTarget(preview, measurement ? [measurement] : []);
      if (target === null) return;
      if (measurement) await saveBodyMeasurement(measurement);
      if (existingProfile) {
        await update({
          weightKg: preview.weightKg,
          activityLevel: preview.activityLevel,
          goal: preview.goal,
          targetSource: preview.targetSource,
          statedCalories: preview.statedCalories,
          statedFigureKind: preview.statedFigureKind,
          targetCalories: target,
        });
        clearScanDraft();
        router.back();
      } else {
        await create({ ...preview, targetCalories: target });
        clearScanDraft();
        router.replace('/(tabs)');
      }
    } finally {
      setSaving(false);
    }
  }, [dbReadiness.phase, valid, saving, preview, measurement, existingProfile, update, create, clearScanDraft, router]);

  const extraction = scan?.extraction ?? null;
  const mismatch = extraction
    && (extraction.provider === 'dexa' || extraction.provider === 'inbody')
    && extraction.provider !== source
    ? extraction.provider
    : null;

  return (
    <StepShell
      step="welcome"
      title={source === 'dexa' ? 'Your DEXA inputs' : source === 'inbody' ? 'Your InBody inputs' : 'Your known figure'}
      detail="These are inputs to a calorie calculation. You can change them in Settings."
      primaryLabel="Use this figure"
      primaryDisabled={dbReadiness.phase !== 'ready' || !valid}
      primaryLoading={saving}
      onPrimary={() => void save()}
    >
      {measured ? (
        <>
          <Segmented options={MEASURED_SOURCES} value={source} onChange={changeSource} />

          {scan === null ? (!manualOnly && keyReadiness.phase !== 'present' ? (
            <ApiKeyExplainer
              status={keyReadiness.phase}
              onSetUpKey={openKeySetup}
              onEnterManually={() => setManualOnly(true)}
              onRetry={() => dispatchKeyReadiness({ type: 'RETRY' })}
            />
          ) : !manualOnly ? (
            <Card>
              <SectionLabel muted>From your report</SectionLabel>
              <Body>Read the figures off a photo of your report instead of typing them.</Body>
              <Caption muted style={styles.note}>
                Nothing is sent when you pick a picture. You choose when to send
                it, and it goes to the provider for your own API key.
              </Caption>
              <View style={styles.actions}>
                <Button label="Choose a photo" variant="secondary" onPress={() => void selectImage('library')} />
                <Button label="Take a photo" variant="secondary" onPress={() => void selectImage('camera')} />
              </View>
              {pickerError ? <Caption style={styles.problem}>{pickerError}</Caption> : null}
            </Card>
          ) : null) : (
            <Card>
              <ReportPreview uri={scan.photoUri} />
              {scan.phase === 'selected' ? (
                <View style={styles.actions}>
                  <Caption muted>
                    Sending this picture to the provider for your API key is the
                    only thing that leaves your phone.
                  </Caption>
                  <Button label="Read this report" onPress={() => void analyse()} />
                  <Button label="Choose a different photo" variant="secondary" onPress={() => void selectImage('library')} />
                  <Button label="Type it in instead" variant="ghost" onPress={discardReport} />
                </View>
              ) : null}

              {scan.phase === 'extracting' ? (
                <View style={styles.actions}>
                  <ProcessingIndicator label="Reading your report…" />
                  <Button label="Stop" variant="ghost" onPress={cancelAnalysis} />
                </View>
              ) : null}

              {scan.phase === 'error' ? (
                <ScanProblem
                  errorKind={scan.errorKind}
                  onRetry={() => void analyse()}
                  onReplace={() => void selectImage('library')}
                  onManual={discardReport}
                  onKeySettings={openKeySetup}
                />
              ) : null}

              {scan.phase === 'review' && extraction ? (
                <View style={styles.actions}>
                  <View style={styles.badge}>
                    <Caption>Detected from scan — check and adjust before continuing</Caption>
                  </View>
                  <Caption muted>{CONFIDENCE_NOTE[extraction.confidence]}</Caption>
                  {extraction.issues.map((issue) => (
                    <Caption key={`${issue.field}-${issue.code}`} style={styles.problem}>{issue.message}</Caption>
                  ))}
                  {mismatch ? (
                    <>
                      <Caption style={styles.problem}>
                        {`This looks like a ${PROVIDER_LABELS[mismatch]} report, but ${PROVIDER_LABELS[source === 'dexa' ? 'dexa' : 'inbody']} is selected. Your choice, not Mise's.`}
                      </Caption>
                      <Button
                        label={`Switch to ${PROVIDER_LABELS[mismatch]}`}
                        variant="secondary"
                        onPress={() => changeSource(mismatch)}
                      />
                      <Caption muted>{`Or keep ${PROVIDER_LABELS[source === 'dexa' ? 'dexa' : 'inbody']} and edit the fields below.`}</Caption>
                    </>
                  ) : null}
                  <Button label="Use a different photo" variant="ghost" onPress={() => void selectImage('library')} />
                </View>
              ) : null}
            </Card>
          )}
        </>
      ) : null}

      {source === 'stated' ? (
        <>
          <Field label="Calories" value={stated} onChangeText={setStated} keyboardType="number-pad" suffix="kcal" numeric />
          <ChoiceList options={STATED_OPTIONS} value={kind} onChange={setKind} />
        </>
      ) : (
        <>
          <Field label="Weight at measurement" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" suffix="kg" numeric />
          {source === 'dexa' ? (
            <>
              <Field label="Body fat percentage" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" suffix="%" numeric hint="Or enter lean tissue and bone mineral content." />
              <Field label="Lean tissue" value={lean} onChangeText={setLean} keyboardType="decimal-pad" suffix="kg" numeric />
              <Field label="Bone mineral content" value={bmc} onChangeText={setBmc} keyboardType="decimal-pad" suffix="kg" numeric />
            </>
          ) : (
            <>
              <Field label="Fat Free Mass" value={fatFreeMass} onChangeText={setFatFreeMass} keyboardType="decimal-pad" suffix="kg" numeric hint="Or use the printed BMR below." />
              <Field label="Printed BMR (optional)" value={inBodyBmr} onChangeText={setInBodyBmr} keyboardType="number-pad" suffix="kcal" numeric hint="This is saved as a stated resting figure, not a measurement." />
              {Number.isFinite(printedBmr) ? (
                <Button
                  label={useInBodyBmr ? 'Using the printed BMR' : 'Use the printed BMR instead'}
                  detail={useInBodyBmr ? 'Saved as a stated resting figure. Tap to go back to Fat Free Mass.' : 'Otherwise Fat Free Mass is used.'}
                  variant="secondary"
                  onPress={() => setUseInBodyBmr((current) => !current)}
                />
              ) : null}
            </>
          )}
          <Field
            label="Date of measurement"
            value={measuredOn}
            onChangeText={setMeasuredOn}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            hint={scan?.phase === 'review' ? 'Copy this from the report. Mise does not read it for you.' : 'When the measurement was taken.'}
            error={measuredOn.trim().length > 0 && !dateReady ? 'Use the form YYYY-MM-DD.' : undefined}
          />
        </>
      )}

      {kind !== 'adjusted' ? <ChoiceList options={ACTIVITY_LEVELS.map((item) => ({ value: item.value, label: item.label, detail: item.detail }))} value={activityLevel} onChange={setActivityLevel} /> : null}
      {kind !== 'adjusted' ? <ChoiceList options={GOALS} value={goal} onChange={setGoal} /> : null}
      {warnings.map((warning) => <Caption key={warning}>{warning}</Caption>)}
    </StepShell>
  );
}

/** The report exactly as it was picked — never tinted, cropped, or softened. */
function ReportPreview({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={styles.preview}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="The report you selected"
    />
  );
}

/**
 * Failure copy comes from the shared vision error contract, so a rate limit
 * or a rejected key reads the same here as it does anywhere else in the app.
 * Only the recovery actions are particular to a report.
 */
function ScanProblem({
  errorKind,
  onRetry,
  onReplace,
  onManual,
  onKeySettings,
}: {
  errorKind: VisionErrorKind | null;
  onRetry: () => void;
  onReplace: () => void;
  onManual: () => void;
  onKeySettings: () => void;
}) {
  const copy = copyForError(errorKind === null ? null : new VisionError(errorKind, ''));
  const cancelled = errorKind === 'cancelled';
  return (
    <View style={styles.actions}>
      <Body accessibilityRole="alert">{cancelled ? 'Stopped' : copy.title}</Body>
      <Caption muted>
        {cancelled
          ? 'Your report is still here. Read it again, or type the figures in below.'
          : 'Your report is still here, and the fields below are still yours to fill in.'}
      </Caption>
      {copy.action === 'settings' ? (
        <Button label="Add an API key" variant="secondary" onPress={onKeySettings} />
      ) : (
        <Button label="Try again" variant="secondary" onPress={onRetry} />
      )}
      <Button label="Choose a different photo" variant="secondary" onPress={onReplace} />
      <Button label="Type it in instead" variant="ghost" onPress={onManual} />
    </View>
  );
}

function numberOrNull(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Two decimals is the most any of these reports prints. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

const styles = StyleSheet.create({
  note: { marginTop: space.xs },
  actions: { gap: space.sm, marginTop: space.md },
  problem: { color: color.paprika },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: color.ground,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  preview: {
    width: '100%',
    height: layout.minRowHeight * 3,
    borderRadius: radius.input,
    backgroundColor: color.ground,
  },
});
