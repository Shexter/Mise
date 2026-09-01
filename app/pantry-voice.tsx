import { Feather } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { VisionError } from '@/api/errors';
import { getConfiguredProvider, PROVIDERS } from '@/api/keyStore';
import { getSelectedVoiceProviderIdentity } from '@/api/voiceIntake';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MicButton } from '@/components/MicButton';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { SpeechModelsSheet } from '@/components/settings/SpeechModelsSheet';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, radius, space, type } from '@/constants/theme';
import { buildVoiceDraftWithTranscriptParsing } from '@/logic/voiceTranscriptParsing';
import {
  KEYBOARD_START_HINT,
  RECOGNITION_LANGUAGES,
  announcementFor,
  deleteAudio,
  describeDownload,
  elapsedLabel,
  failureLabel,
  hasSalvageableTranscript,
  initialVoiceSession,
  isDriven,
  keyboardDictationAdapter,
  languageName,
  chosenModelForLanguage,
  modelsForLanguage,
  owesAudioDeletion,
  purgeAllAudio,
  recoveryActions,
  refreshInstalledModels,
  resolveTranscriptionRoute,
  statusLabel,
  voiceSessionReducer,
  SpeechPermissionDeniedError,
  NativeSpeechRecognitionError,
  getAndroidOfflineLanguageStatus,
  installAndroidOfflineLanguage,
  readSpeechPreferences,
  updateSpeechPreferences,
  type OfflineLanguageInstallResult,
  type OfflineLanguageStatus,
  type SpeechPreferences,
  type TranscriptionAdapter,
  type TranscriptionRoute,
} from '@/media/speech';
import { useVoiceInterruptions } from '@/media/speech/interruptions';
import { usePantryStore } from '@/store/pantryStore';
import { useVoiceIntakeStore } from '@/store/voiceIntakeStore';

const TICK_MS = 250;

/** Joins two transcript segments, tolerating either half being empty. */
function joinTranscript(before: string, after: string): string {
  const a = before.trim();
  const b = after.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}

function offlineInstallCopy(result: OfflineLanguageInstallResult): string {
  switch (result.status) {
    case 'installed': return 'Android already has this offline language.';
    case 'completed': return 'Android reported the download complete. Rechecking availability.';
    case 'dialog_opened': return 'Android opened its language download. Finish there, then Recheck.';
    case 'cancelled': return 'The Android language download was cancelled. You can retry or choose a model.';
    case 'unsupported':
    case 'failed': return result.message;
  }
}

/**
 * The sweep: one explicit session that produces a transcript and nothing else.
 *
 * Nothing on this screen writes to the pantry. It ends by handing a draft to
 * the review screen, which is the only place the final action lives — a
 * separation worth the extra route, because it makes "no stock is created
 * without review" a property of the navigation rather than of a flag.
 *
 * Which microphone is used is decided by `resolveTranscriptionRoute` rather
 * than by this screen. On a build without the native recogniser that resolves
 * to the keyboard's own microphone, which is why the primary control below is
 * sometimes a Start button and sometimes a text field with a hint — the chrome
 * follows what the chosen adapter can actually do rather than pretending it can
 * do more.
 */
export default function PantryVoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ locationId?: string }>();
  const locations = usePantryStore((state) => state.locations);
  const refreshPantry = usePantryStore((state) => state.refresh);
  const setDraft = useVoiceIntakeStore((store) => store.setDraft);

  const [language, setLanguage] = useState('en-GB');
  const [route, setRoute] = useState<TranscriptionRoute | null>(null);
  /** Bumped whenever the installed-model set changes, to re-resolve the route. */
  const [installedStamp, setInstalledStamp] = useState(0);
  const [sessionLocationId, setSessionLocationId] = useState<string | null>(
    params.locationId ?? null,
  );
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [typedDirectly, setTypedDirectly] = useState(false);
  const [speechModelsOpen, setSpeechModelsOpen] = useState(false);
  const [speechPreferences, setSpeechPreferences] = useState<SpeechPreferences>(
    readSpeechPreferences,
  );
  const preferredModelId = speechPreferences.preferredModelId;
  const [offlineLanguageStatus, setOfflineLanguageStatus] =
    useState<OfflineLanguageStatus | null>(null);
  const [offlineInstallResult, setOfflineInstallResult] =
    useState<OfflineLanguageInstallResult | null>(null);
  const [installingOfflineLanguage, setInstallingOfflineLanguage] = useState(false);
  const parseAbort = useRef<AbortController | null>(null);
  const transcriptRef = useRef('');
  const lastSubmittedTranscript = useRef<string | null>(null);
  /**
   * Set by the "Use the keyboard microphone" recovery action. The keyboard is
   * always available, so once the user picks it explicitly there is no
   * reason to keep offering a path that just failed them.
   */
  const [forcedKeyboard, setForcedKeyboard] = useState(false);

  const [session, dispatch] = useReducer(
    voiceSessionReducer,
    initialVoiceSession('keyboard', 'en-GB'),
  );
  const previous = useRef(session);
  const inputRef = useRef<TextInput>(null);
  /**
   * The transcript as of the most recent Resume, so a fresh capture segment's
   * live partials can be appended onto what came before rather than replacing
   * it. Set once, right before `adapter.start()` is called again.
   */
  const resumeBaseline = useRef('');

  useEffect(() => {
    transcriptRef.current = session.transcript;
  }, [session.transcript]);

  const activeAdapter = forcedKeyboard ? keyboardDictationAdapter : route?.chosen ?? null;
  const driven = activeAdapter != null && isDriven(activeAdapter);
  /**
   * The downloaded models are offline recognisers, not streaming ones, so they
   * produce nothing until Finish. Saying so beats an empty box that reads as a
   * dead microphone.
   */
  const livePartials = activeAdapter?.providesLiveTranscript ?? true;
  const sessionLocation = locations.find((entry) => entry.id === sessionLocationId) ?? null;
  const explanation = forcedKeyboard ? keyboardDictationAdapter.privacyLine : route?.explanation;

  /* -- setup ------------------------------------------------------------- */

  useEffect(() => {
    // Anything left by a session that died mid-recording. Runs on open because
    // a killed process never got to run its own cleanup.
    purgeAllAudio();
    void refreshPantry();
    // The routing ladder reads installed models synchronously, so the list has
    // to be warmed before the first route resolves.
    void refreshInstalledModels().then(() => setInstalledStamp((n) => n + 1));
  }, [refreshPantry]);

  useEffect(() => {
    let cancelled = false;
    void resolveTranscriptionRoute(
      language,
      languageName(language),
      undefined,
      preferredModelId,
      speechPreferences.recognition,
    ).then((resolved) => {
      if (cancelled) return;
      setRoute(resolved);
      if (resolved.mode) dispatch({ type: 'SET_MODE', mode: resolved.mode });
    });
    return () => {
      cancelled = true;
    };
  }, [language, installedStamp, preferredModelId, speechPreferences.recognition]);

  useEffect(() => {
    let cancelled = false;
    if (speechPreferences.recognition !== 'offline') {
      setOfflineLanguageStatus(null);
      setOfflineInstallResult(null);
      return undefined;
    }
    void getAndroidOfflineLanguageStatus(language).then((status) => {
      if (!cancelled) setOfflineLanguageStatus(status);
    });
    return () => { cancelled = true; };
  }, [language, installedStamp, speechPreferences.recognition]);

  useEffect(() => {
    if (!sessionLocationId && locations.length > 0) {
      setSessionLocationId(locations[0]!.id);
    }
  }, [locations, sessionLocationId]);

  /* -- announcements ----------------------------------------------------- */

  useEffect(() => {
    const message = announcementFor(previous.current, session);
    previous.current = session;
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [session]);

  /* -- clock ------------------------------------------------------------- */

  useEffect(() => {
    if (session.status !== 'listening') return undefined;
    const timer = setInterval(() => dispatch({ type: 'TICK', ms: TICK_MS }), TICK_MS);
    return () => clearInterval(timer);
  }, [session.status]);

  /* -- interruptions ----------------------------------------------------- */

  const onInterrupt = useCallback(
    (kind: Parameters<typeof useVoiceInterruptions>[1] extends (k: infer K) => void ? K : never) => {
      dispatch({ type: 'INTERRUPT', kind });
      if (activeAdapter && isDriven(activeAdapter)) void activeAdapter.cancel();
    },
    [activeAdapter],
  );
  // Armed while paused too: the reducer's own INTERRUPT case already accepts
  // 'paused' as a valid source status (session.ts) — a call arriving while
  // the screen shows "Paused" still deserves to be flagged as an
  // interruption, not silently ignored because the listener wasn't armed.
  useVoiceInterruptions(['listening', 'paused'].includes(session.status), onInterrupt);

  /* -- audio hygiene ----------------------------------------------------- */

  useEffect(() => {
    if (!owesAudioDeletion(session)) return;
    if (['ready', 'failed', 'cancelled'].includes(session.status)) {
      deleteAudio(session.audioUri);
      dispatch({ type: 'AUDIO_DELETED' });
    }
  }, [session]);

  useEffect(
    () => () => {
      // Leaving by any route — back gesture included — takes the audio with it.
      deleteAudio(useVoiceIntakeStore.getState().draft ? null : session.audioUri);
      purgeAllAudio();
    },
    [session.audioUri],
  );

  useEffect(() => () => parseAbort.current?.abort(), []);

  /* -- controls ---------------------------------------------------------- */

  const beginListening = async () => {
    const adapter = activeAdapter;
    if (!adapter) return;
    dispatch({ type: 'START' });
    if (!isDriven(adapter)) {
      // The keyboard path: the user drives it. Focusing the field is the only
      // thing Mise can do to help, and it brings up the keyboard whose
      // microphone key does the actual work.
      dispatch({ type: 'PERMISSION_GRANTED' });
      setTypedDirectly(false);
      inputRef.current?.focus();
      return;
    }
    try {
      const { audioUri } = await adapter.start({
        language,
        onPartial: (text) => dispatch({ type: 'TRANSCRIPT', text }),
        // A failure the native side reports mid-session (not one thrown by
        // start()/stop() themselves) — surfaced immediately rather than left
        // to make the screen look stuck on "Listening" with a dead microphone.
        onError: (kind, partial) => {
          if (partial?.trim()) dispatch({ type: 'TRANSCRIPT', text: partial });
          dispatch({ type: 'FAIL', kind });
        },
      });
      dispatch({ type: 'PERMISSION_GRANTED' });
      dispatch({ type: 'AUDIO_STARTED', audioUri });
    } catch (error) {
      // Only a genuine permission refusal is reported as permission_denied —
      // anything else (a missing module, a native error thrown from start())
      // sent someone to check a Settings toggle that was never the problem.
      if (error instanceof SpeechPermissionDeniedError) {
        dispatch({ type: 'PERMISSION_DENIED' });
      } else {
        dispatch({ type: 'FAIL', kind: 'microphone_unavailable' });
      }
    }
  };

  const chooseRecognition = (recognition: SpeechPreferences['recognition']) => {
    if (['listening', 'finishing', 'transcribing'].includes(session.status)) return;
    setForcedKeyboard(false);
    setTypedDirectly(false);
    setSpeechPreferences(updateSpeechPreferences({ recognition }));
    setOfflineInstallResult(null);
    dispatch({ type: 'RESET' });
  };

  const startListening = async () => {
    if (
      speechPreferences.recognition === 'phone' &&
      !forcedKeyboard &&
      !speechPreferences.phoneSpeechDisclosureAccepted
    ) {
      Alert.alert(
        'Use Phone speech?',
        'Your phone speech provider turns audio into text and may process it off-device. Mise receives the transcript, not a recording. Offline only stays available.',
        [
          { text: 'Offline only', onPress: () => chooseRecognition('offline') },
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Use Phone speech',
            onPress: () => {
              setSpeechPreferences(updateSpeechPreferences({
                phoneSpeechDisclosureAccepted: true,
              }));
              void beginListening();
            },
          },
        ],
      );
      return;
    }
    await beginListening();
  };

  const installOfflineLanguage = async () => {
    if (installingOfflineLanguage) return;
    setInstallingOfflineLanguage(true);
    const result = await installAndroidOfflineLanguage(language);
    setOfflineInstallResult(result);
    if (result.recheck) {
      const status = await getAndroidOfflineLanguageStatus(language);
      setOfflineLanguageStatus(status);
      setInstalledStamp((value) => value + 1);
    }
    setInstallingOfflineLanguage(false);
  };

  /**
   * Stops the adapter for real. Pause used to only change the label on
   * screen — the native recogniser or the local-model's PCM stream kept
   * running underneath, so anything said while the screen read "Paused" was
   * silently folded into the transcript on Resume or Finish. Now the
   * microphone genuinely stops here.
   *
   * The native path already has an accurate transcript in `session.transcript`
   * (its `onPartial` streams the cumulative text live), so it only needs
   * `cancel()` — immediate, no result to wait for. The local-model path never
   * transcribes until `stop()` is called, so whatever was captured since the
   * last Resume has not been turned into text yet; `stop()` does that work
   * and the result is merged in via `MERGE_TRANSCRIPT`, the one event the
   * reducer accepts from `'paused'` rather than `'listening'`.
   */
  const pause = async () => {
    const adapter = activeAdapter;
    dispatch({ type: 'PAUSE' });
    if (!adapter || !isDriven(adapter)) return;
    if (adapter.providesLiveTranscript) {
      void adapter.cancel();
      return;
    }
    try {
      const result = await adapter.stop();
      dispatch({ type: 'MERGE_TRANSCRIPT', text: joinTranscript(session.transcript, result.text) });
    } catch {
      // Nothing captured since the last Resume — the transcript already on
      // screen is everything there is.
    }
  };

  /** Starts a fresh capture segment, appended onto what Pause already kept. */
  const resume = async () => {
    const adapter = activeAdapter;
    dispatch({ type: 'RESUME' });
    if (!adapter || !isDriven(adapter)) return;
    resumeBaseline.current = session.transcript;
    try {
      const { audioUri } = await adapter.start({
        language,
        onPartial: (text) =>
          dispatch({ type: 'TRANSCRIPT', text: joinTranscript(resumeBaseline.current, text) }),
        onError: (kind, partial) => {
          if (partial?.trim()) {
            dispatch({
              type: 'TRANSCRIPT',
              text: joinTranscript(resumeBaseline.current, partial),
            });
          }
          dispatch({ type: 'FAIL', kind });
        },
      });
      dispatch({ type: 'AUDIO_STARTED', audioUri });
    } catch (error) {
      if (error instanceof SpeechPermissionDeniedError) {
        dispatch({ type: 'PERMISSION_DENIED' });
      } else {
        dispatch({ type: 'FAIL', kind: 'microphone_unavailable' });
      }
    }
  };

  const buildReviewDraft = async (transcript: string, useAi: boolean) => {
    const controller = new AbortController();
    parseAbort.current?.abort();
    parseAbort.current = controller;
    lastSubmittedTranscript.current = transcript;
    setProcessing(true);
    setParseStatus(useAi ? 'Parsing the transcript with your selected AI provider…' : 'Parsing locally on this device…');

    let startingIdentity: Awaited<ReturnType<typeof getSelectedVoiceProviderIdentity>> | null = null;
    if (useAi) {
      try {
        startingIdentity = await getSelectedVoiceProviderIdentity(controller.signal);
      } catch {
        // A key removed between disclosure and Finish becomes a truthful local fallback.
      }
    }

    try {
      const result = await buildVoiceDraftWithTranscriptParsing({
        draftId: randomUUID(),
        transcript,
        transcriptionMode: session.mode,
        sessionLocationId,
        allowProviderResolution: false,
        locale: language,
        visibleLocations: locations.map(({ id, name }) => ({ id, name })),
        aiTranscriptParsing: useAi,
        signal: controller.signal,
      });
      if (controller.signal.aborted || transcriptRef.current !== transcript) {
        setParseStatus('Transcript changed. Tap Parse corrected transcript when it is ready.');
        return;
      }
      if (startingIdentity) {
        try {
          const current = await getSelectedVoiceProviderIdentity(controller.signal);
          if (current.provider !== startingIdentity.provider || current.model !== startingIdentity.model) {
            setParseStatus('AI provider or model changed. Tap Parse corrected transcript to use the new choice.');
            return;
          }
        } catch {
          setParseStatus('AI provider changed. Tap Parse corrected transcript to continue.');
          return;
        }
      }
      setDraft(result.draft);
      setParseStatus(
        result.parserPath === 'local'
          ? 'Parsed locally. Your transcript was preserved.'
          : result.parserPath === 'mixed'
            ? 'AI-separated items were checked locally; unsupported spans used the local parser.'
            : 'AI-separated items were checked against your exact transcript.',
      );
      router.push('/pantry-voice-review');
    } catch (error) {
      if (error instanceof VisionError && error.kind === 'cancelled') {
        if (transcriptRef.current !== transcript) {
          setParseStatus('Transcript changed. Tap Parse corrected transcript when it is ready.');
        }
        return;
      }
      dispatch({ type: 'FAIL', kind: 'resolution_failed' });
      setParseStatus('The local parser could not prepare review. Your transcript is still here.');
    } finally {
      if (parseAbort.current === controller) {
        parseAbort.current = null;
        setProcessing(false);
      }
    }
  };

  const chooseTranscriptParsing = async (transcript: string) => {
    if (speechPreferences.recognition === 'offline') {
      await buildReviewDraft(transcript, false);
      return;
    }
    const provider = await getConfiguredProvider();
    if (!provider) {
      await buildReviewDraft(transcript, false);
      return;
    }
    if (speechPreferences.aiTranscriptParsingConsent) {
      await buildReviewDraft(transcript, true);
      return;
    }
    const providerName = PROVIDERS[provider].displayName;
    Alert.alert(
      'AI transcript parsing',
      `${providerName} can separate the items you said. Mise sends only this transcript, language, and the visible location names and ids—never audio, pantry contents, or your API key. You can revoke this in Settings.`,
      [
        { text: 'Parse locally', onPress: () => void buildReviewDraft(transcript, false) },
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Allow ${providerName}`,
          onPress: () => {
            const next = updateSpeechPreferences({ aiTranscriptParsingConsent: true });
            setSpeechPreferences(next);
            void buildReviewDraft(transcript, true);
          },
        },
      ],
    );
  };

  const finish = async () => {
    if (processing) return;
    if (session.status === 'ready' && useVoiceIntakeStore.getState().draft) {
      // Already finished — a stale re-press from a screen instance left
      // mounted under the review route (`router.push`, not `replace`). The
      // draft is already in the store; calling adapter.stop() again here
      // would hang, since its listeners were torn down by the first call.
      router.push('/pantry-voice-review');
      return;
    }
    const adapter = activeAdapter;
    dispatch({ type: 'FINISH' });
    let transcript = session.transcript;

    // A `failed` session has nothing running to stop — this is a typed
    // recovery, so the transcript already on screen is the whole answer.
    if (
      adapter &&
      isDriven(adapter) &&
      ['listening', 'paused', 'interrupted'].includes(session.status)
    ) {
      dispatch({ type: 'TRANSCRIBING' });
      try {
        transcript = (await adapter.stop()).text;
      } catch (error) {
        if (error instanceof NativeSpeechRecognitionError) {
          transcript = joinTranscript(transcript, error.partialTranscript);
          if (transcript.trim()) dispatch({ type: 'TRANSCRIBED', text: transcript });
          dispatch({ type: 'FAIL', kind: error.kind });
        } else {
          dispatch({ type: 'FAIL', kind: 'transcription_failed' });
        }
        return;
      }
    }
    dispatch({ type: 'TRANSCRIBED', text: transcript });
    transcriptRef.current = transcript;

    if (transcript.trim().length === 0) {
      dispatch({ type: 'FAIL', kind: 'no_speech' });
      return;
    }

    await chooseTranscriptParsing(transcript);
  };

  const cancel = () => {
    parseAbort.current?.abort();
    const adapter = activeAdapter;
    if (adapter && isDriven(adapter)) void adapter.cancel();
    dispatch({ type: 'CANCEL' });
    deleteAudio(session.audioUri);
    purgeAllAudio();
    router.back();
  };

  const download = useMemo(
    () => describeDownload(language, languageName(language), preferredModelId),
    [language, preferredModelId],
  );
  const modelChoices = useMemo(() => modelsForLanguage(language), [language]);

  /** Bypasses whatever just failed and drops straight to the always-available path. */
  const forceKeyboardFallback = () => {
    setForcedKeyboard(true);
    setTypedDirectly(false);
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_MODE', mode: 'keyboard' });
  };

  /* -- render ------------------------------------------------------------ */

  const canFinish =
    hasSalvageableTranscript(session) ||
    (['listening', 'paused', 'interrupted'].includes(session.status) &&
      session.transcript.trim().length > 0);

  /**
   * Shown whenever a model would genuinely help — not only when the preflight
   * ladder happened to notice. A native recogniser that reports itself
   * available and then fails at start() with `offline_model_missing` or
   * `service_unavailable` deserves the same offer as one the ladder skipped
   * up front.
   */
  const showDownloadCard =
    Boolean(download) &&
    !(
      speechPreferences.recognition === 'offline' &&
      offlineLanguageStatus === 'missing' &&
      offlineInstallResult === null
    ) &&
    Boolean(
      route?.downloadSuggestion ||
        session.failure === 'offline_model_missing' ||
        session.failure === 'service_unavailable',
    );

  /**
   * Every string `recoveryActions` can return, wired to something real.
   *
   * Keyed by failure kind first rather than by label alone: `resolution_failed`
   * means recording and transcription already succeeded and only the
   * ingredient lookup failed, so its "Try again" must retry that lookup
   * (`finish()`), not discard the good transcript by starting a new
   * recording — the same label means something different depending on what
   * actually broke.
   */
  const recoveryHandlerFor = (label: string): (() => void) => {
    if (session.failure === 'resolution_failed') return () => void finish();
    switch (label) {
      case 'Download a speech model':
        return () => setSpeechModelsOpen(true);
      case 'Change language':
        return () => setPickingLanguage(true);
      case 'Type instead':
        return () => inputRef.current?.focus();
      case 'Try again':
      case 'Start again':
        return () => void startListening();
      case 'Use the keyboard microphone':
        return forceKeyboardFallback;
      case 'Use Offline only':
        return () => chooseRecognition('offline');
      case 'Retry Phone speech':
        return () => void startListening();
      case 'Open Settings':
        return () => void Linking.openSettings();
      default:
        return () => inputRef.current?.focus();
    }
  };

  return (
    <Screen
      scroll
      footer={
        <View style={styles.footer}>
          <Button
            label={processing
              ? 'Reading what you said'
              : lastSubmittedTranscript.current !== null &&
                  lastSubmittedTranscript.current !== session.transcript
                ? 'Parse corrected transcript'
                : 'Finish'}
            onPress={() => void finish()}
            disabled={!canFinish || processing}
            loading={processing}
            accessibilityHint="Stops recording and opens the review. Nothing is added yet."
          />
          <Button label="Cancel" variant="ghost" onPress={cancel} />
        </View>
      }
    >
      <View style={styles.header}>
        <ScreenTitle>Speak your pantry</ScreenTitle>
      </View>

      <Card style={styles.contextCard}>
        <Pressable
          onPress={() => setPickingLocation(true)}
          accessibilityRole="button"
          accessibilityLabel={`Session location: ${sessionLocation?.name ?? 'choose one'}`}
          accessibilityHint="Every item you name goes here unless you say otherwise."
          style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
        >
          <Feather name="map-pin" size={18} color={color.muted} />
          <View style={styles.rowText}>
            <SectionLabel muted>Putting things in</SectionLabel>
            <RowTitle>{sessionLocation?.name ?? 'Choose a place'}</RowTitle>
          </View>
          <Feather name="chevron-right" size={18} color={color.muted} />
        </Pressable>

        <Pressable
          onPress={() => setPickingLanguage(true)}
          accessibilityRole="button"
          accessibilityLabel={`Recognition language: ${languageName(language)}`}
          style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
        >
          <Feather name="globe" size={18} color={color.muted} />
          <View style={styles.rowText}>
            <SectionLabel muted>Listening in</SectionLabel>
            <RowTitle>{languageName(language)}</RowTitle>
          </View>
          <Feather name="chevron-right" size={18} color={color.muted} />
        </Pressable>
      </Card>

      <Card style={styles.modeCard}>
        <SectionLabel muted>Speech mode</SectionLabel>
        {([
          {
            id: 'phone' as const,
            label: 'Phone speech',
            detail: 'Best default. Your phone provider may process audio off-device.',
          },
          {
            id: 'offline' as const,
            label: 'Offline only',
            detail: 'Android offline model, then a downloaded model if you choose one.',
          },
        ]).map((option) => {
          const selected = speechPreferences.recognition === option.id && !forcedKeyboard;
          const locked = ['listening', 'finishing', 'transcribing'].includes(session.status);
          return (
            <Pressable
              key={option.id}
              onPress={() => chooseRecognition(option.id)}
              disabled={locked}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: locked }}
              style={({ pressed }) => [
                styles.modeChoice,
                pressed && !locked && { opacity: opacity.pressed },
              ]}
            >
              <View style={styles.rowText}>
                <RowTitle>{option.label}</RowTitle>
                <Caption muted>{option.detail}</Caption>
              </View>
              <Feather
                name={selected ? 'check-circle' : 'circle'}
                size={20}
                color={selected ? color.action : color.muted}
              />
            </Pressable>
          );
        })}
      </Card>

      {speechPreferences.recognition === 'offline' && offlineLanguageStatus === 'missing' ? (
        <Card style={styles.downloadCard}>
          <View style={styles.downloadHead}>
            <Feather name="download" size={20} color={color.ink} />
            <View style={styles.rowText}>
              <RowTitle>Install Android offline language</RowTitle>
              <Caption muted>{languageName(language)} is not installed for offline speech.</Caption>
            </View>
          </View>
          <Button
            label={installingOfflineLanguage ? 'Opening Android…' : 'Install with Android'}
            variant="secondary"
            loading={installingOfflineLanguage}
            disabled={installingOfflineLanguage}
            onPress={() => void installOfflineLanguage()}
          />
          {offlineInstallResult ? (
            <Caption accessibilityLiveRegion="polite">
              {offlineInstallCopy(offlineInstallResult)}
            </Caption>
          ) : null}
          {offlineInstallResult?.recheck ? (
            <Button
              label="Recheck"
              variant="ghost"
              onPress={() => {
                void getAndroidOfflineLanguageStatus(language).then((status) => {
                  setOfflineLanguageStatus(status);
                  setInstalledStamp((value) => value + 1);
                });
              }}
            />
          ) : null}
        </Card>
      ) : null}

      {/*
        One focal control rather than a wall of status text. The status word
        only appears once there is something to say beyond "ready" — idle and
        failed states speak through the mic button's label and the problem
        card below instead of a redundant status line.
      */}
      <View style={styles.focal}>
        {activeAdapter ? (
          <View style={styles.activePath}>
            <SectionLabel muted>Active speech path</SectionLabel>
            <RowTitle>
              {activeSpeechPathLabel(
                activeAdapter,
                language,
                preferredModelId,
                typedDirectly,
              )}
            </RowTitle>
          </View>
        ) : null}
        {!['idle', 'failed'].includes(session.status) ? (
          ['listening', 'paused'].includes(session.status) ? (
            <View style={styles.listeningRow}>
              <ScreenTitle accessibilityLiveRegion="polite">{statusLabel(session)}</ScreenTitle>
              <Caption muted numeric>{elapsedLabel(session.elapsedMs)}</Caption>
            </View>
          ) : (
            <Caption muted accessibilityLiveRegion="polite">
              {statusLabel(session)}
            </Caption>
          )
        ) : null}

        {driven ? (
          session.status === 'listening' ? (
            <MicButton label="Pause" icon="pause" onPress={() => void pause()} />
          ) : session.status === 'paused' ? (
            <MicButton label="Resume" icon="mic" onPress={() => void resume()} />
          ) : (
            <MicButton
              label={session.status === 'interrupted' ? 'Start again' : 'Start listening'}
              icon="mic"
              onPress={() => void startListening()}
            />
          )
        ) : (
          <MicButton
            label="Use the keyboard microphone"
            icon="mic"
            onPress={() => void startListening()}
            accessibilityHint="Opens the keyboard. Tap the microphone key on it to dictate."
          />
        )}

        {explanation ? (
          <View style={styles.privacyBadge}>
            <Feather name="shield" size={13} color={color.muted} />
            <Caption muted>{explanation}</Caption>
          </View>
        ) : null}

        <View style={styles.lockNote}>
          <Feather name="lock" size={12} color={color.muted} />
          <Caption muted>Nothing is added until you confirm it.</Caption>
        </View>
      </View>

      {session.status === 'failed' ? (
        <Card style={styles.problemCard}>
          <RowTitle>{failureLabel(session.failure)}</RowTitle>
          {recoveryActions(session.failure).map((action) => (
            <Pressable
              key={action}
              onPress={recoveryHandlerFor(action)}
              accessibilityRole="button"
              accessibilityLabel={action}
              style={({ pressed }) => [
                styles.recoveryRow,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Body>{action}</Body>
              <Feather name="chevron-right" size={16} color={color.muted} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {/*
        The download offer. Shown whenever a model would genuinely help — the
        ladder skipping a candidate up front, or a preflight "available"
        answer that turned out wrong once start() actually ran, land here the
        same way. Nothing about this model ships inside Mise: this fetches it
        from NVIDIA's or FunAudioLLM's published release only when the user
        taps, which is why the size is stated before the button and not
        after it.
      */}
      {showDownloadCard && download ? (
        <Card style={styles.downloadCard}>
          <View style={styles.downloadHead}>
            <Feather name="download-cloud" size={18} color={color.muted} />
            <RowTitle>{download.title}</RowTitle>
          </View>
          <Caption muted>{download.reason}</Caption>
          <View style={styles.sizeRow}>
            <RowTitle numeric>{download.size}</RowTitle>
            <Caption muted style={styles.sizeNote}>
              separate download · not part of installing Mise
            </Caption>
          </View>
          <Caption muted>{download.detail}</Caption>
          <Caption muted>{download.caution}</Caption>

          {modelChoices.length > 1 ? (
            <View style={styles.modelChoices}>
              <SectionLabel muted>Choose the model</SectionLabel>
              {modelChoices.map((model) => {
                const selected = model.id === download.model.id;
                return (
                  <Pressable
                    key={model.id}
                    onPress={() => {
                      setSpeechPreferences(updateSpeechPreferences({
                        preferredModelId: model.id,
                      }));
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.modelChoice,
                      pressed && { opacity: opacity.pressed },
                    ]}
                  >
                    <View style={styles.rowText}>
                      <RowTitle>{model.name}</RowTitle>
                      <Caption muted>{model.sizeMb} MB · {model.summary}</Caption>
                    </View>
                    <Feather
                      name={selected ? 'check-circle' : 'circle'}
                      size={20}
                      color={selected ? color.action : color.muted}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Button
            label="Choose or download speech models"
            variant="secondary"
            onPress={() => setSpeechModelsOpen(true)}
            accessibilityHint="Opens durable Download, Pause, Resume, Repair, and Delete controls."
          />
        </Card>
      ) : null}

      <View style={styles.transcriptBlock}>
        <SectionLabel muted>What Mise heard</SectionLabel>
        <TextInput
          ref={inputRef}
          value={session.transcript}
          onChangeText={(text) => {
            if (processing) parseAbort.current?.abort();
            if (session.status === 'idle' && session.elapsedMs === 0) setTypedDirectly(true);
            dispatch({ type: 'EDIT_TRANSCRIPT', text });
          }}
          editable={!driven || session.status !== 'listening'}
          multiline
          placeholder={
            !driven
              ? KEYBOARD_START_HINT
              : livePartials
                ? 'Say what is in there — “six chicken breasts, half a broccoli, some butter”.'
                : 'Say what is in there. This model writes it all down when you press Finish, so nothing appears here until then.'
          }
          placeholderTextColor={color.muted}
          style={styles.transcript}
          accessibilityLabel="Transcript. Edit anything that came out wrong."
        />
        {parseStatus ? (
          <Caption muted accessibilityLiveRegion="polite">{parseStatus}</Caption>
        ) : null}
        <Caption muted>
          {livePartials
            ? 'Correct anything here before you finish — it is easier than fixing it in the review.'
            : 'You can correct all of it after you press Finish, before anything is added.'}
        </Caption>
      </View>

      <Body muted>
        Would rather type? The field above is a normal text box — write your
        items the same way you would say them.
      </Body>

      <Sheet
        visible={pickingLocation}
        onClose={() => setPickingLocation(false)}
        title="Where are you looking?"
      >
        {locations.map((location) => (
          <Pressable
            key={location.id}
            onPress={() => {
              setSessionLocationId(location.id);
              setPickingLocation(false);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: location.id === sessionLocationId }}
            style={({ pressed }) => [styles.option, pressed && { opacity: opacity.pressed }]}
          >
            <RowTitle>{location.name}</RowTitle>
            {location.id === sessionLocationId ? (
              <Feather name="check" size={18} color={color.ink} />
            ) : null}
          </Pressable>
        ))}
      </Sheet>

      <Sheet
        visible={pickingLanguage}
        onClose={() => setPickingLanguage(false)}
        title="Which language are you speaking?"
      >
        {RECOGNITION_LANGUAGES.map((entry) => (
          <Pressable
            key={entry.tag}
            onPress={() => {
              // Changing `language` rebuilds the adapter ladder (a fresh
              // local-model instance in particular — `resolveTranscriptionRoute`
              // constructs a new one on every call). Doing that mid-recording
              // would orphan the instance actually capturing audio: nothing
              // left holding a reference to it, with no way to stop it.
              if (session.status === 'listening') return;
              setLanguage(entry.tag);
              dispatch({ type: 'SET_LANGUAGE', language: entry.tag });
              setPickingLanguage(false);
            }}
            accessibilityRole="button"
            accessibilityState={{
              selected: entry.tag === language,
              disabled: session.status === 'listening',
            }}
            accessibilityHint={
              session.status === 'listening' ? 'Pause or finish before changing language.' : undefined
            }
            style={({ pressed }) => [
              styles.option,
              session.status === 'listening' && { opacity: opacity.disabled },
              pressed && session.status !== 'listening' && { opacity: opacity.pressed },
            ]}
          >
            <RowTitle>{entry.name}</RowTitle>
            {entry.tag === language ? <Feather name="check" size={18} color={color.ink} /> : null}
          </Pressable>
        ))}
      </Sheet>

      <SpeechModelsSheet
        visible={speechModelsOpen}
        onClose={() => setSpeechModelsOpen(false)}
        onChange={() => {
          void refreshInstalledModels().then(() => setInstalledStamp((value) => value + 1));
        }}
      />
    </Screen>
  );
}

function activeSpeechPathLabel(
  adapter: TranscriptionAdapter,
  language: string,
  preferredModelId: string | null,
  typedDirectly: boolean,
): string {
  if (typedDirectly) return 'Type';
  if (adapter.id === 'phone-speech') return 'Phone speech';
  if (adapter.id === 'android-offline') return 'Android offline';
  if (adapter.id === 'keyboard') return 'Keyboard microphone';
  if (adapter.id === 'local-model') {
    const model = chosenModelForLanguage(language, preferredModelId);
    if (model?.id === 'parakeet-tdt-0.6b-v3') return 'Parakeet';
    if (model?.id === 'sense-voice-small') return 'SenseVoice';
    return 'Downloaded model';
  }
  return adapter.label;
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  contextCard: { gap: space.xs, marginBottom: space.md },
  modeCard: { gap: space.xs, marginBottom: space.md },
  modeChoice: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTouchTarget,
    paddingVertical: space.xs,
  },
  rowText: { flex: 1, gap: 2 },
  focal: { alignItems: 'center', gap: space.md, marginVertical: space.lg },
  activePath: { alignItems: 'center', gap: 2 },
  listeningRow: { alignItems: 'center', gap: space.xs },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    maxWidth: '85%',
  },
  lockNote: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  problemCard: { gap: space.xs, marginBottom: space.md },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.minTouchTarget,
    paddingVertical: space.xs,
  },
  downloadCard: { gap: space.xs, marginBottom: space.md },
  downloadHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  modelChoices: { gap: space.xs, marginTop: space.xs },
  modelChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTouchTarget,
    paddingVertical: space.xs,
  },
  sizeRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
  sizeNote: { flexShrink: 1 },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: color.line,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: color.ink },
  downloadError: { color: color.paprika },
  transcriptBlock: { gap: space.xs, marginBottom: space.md },
  transcript: {
    ...type.body,
    color: color.ink,
    minHeight: 140,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    padding: space.md,
    textAlignVertical: 'top',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.minTouchTarget,
    paddingVertical: space.sm,
  },
  footer: { gap: space.sm },
});
