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
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, radius, space, type } from '@/constants/theme';
import { buildVoiceDraft } from '@/logic/voiceIntakeService';
import {
  KEYBOARD_START_HINT,
  RECOGNITION_LANGUAGES,
  announcementFor,
  deleteAudio,
  describeDownload,
  downloadSpeechModel,
  elapsedLabel,
  failureLabel,
  initialVoiceSession,
  isDriven,
  languageName,
  owesAudioDeletion,
  purgeAllAudio,
  recoveryActions,
  refreshInstalledModels,
  resolveTranscriptionRoute,
  statusLabel,
  voiceSessionReducer,
  SpeechPermissionDeniedError,
  type DownloadProgress,
  type TranscriptionRoute,
} from '@/media/speech';
import { useVoiceInterruptions } from '@/media/speech/interruptions';
import { usePantryStore } from '@/store/pantryStore';
import { useVoiceIntakeStore } from '@/store/voiceIntakeStore';

const TICK_MS = 250;

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
  const [downloading, setDownloading] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);

  const [session, dispatch] = useReducer(
    voiceSessionReducer,
    initialVoiceSession('keyboard', 'en-GB'),
  );
  const previous = useRef(session);
  const inputRef = useRef<TextInput>(null);

  const driven = route?.chosen != null && isDriven(route.chosen);
  /**
   * The downloaded models are offline recognisers, not streaming ones, so they
   * produce nothing until Finish. Saying so beats an empty box that reads as a
   * dead microphone.
   */
  const livePartials = route?.chosen?.providesLiveTranscript ?? true;
  const sessionLocation = locations.find((entry) => entry.id === sessionLocationId) ?? null;

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
    void resolveTranscriptionRoute(language, languageName(language)).then((resolved) => {
      if (cancelled) return;
      setRoute(resolved);
      if (resolved.mode) dispatch({ type: 'SET_MODE', mode: resolved.mode });
    });
    return () => {
      cancelled = true;
    };
  }, [language, installedStamp]);

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
      if (route?.chosen && isDriven(route.chosen)) void route.chosen.cancel();
    },
    [route],
  );
  useVoiceInterruptions(session.status === 'listening', onInterrupt);

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

  /* -- controls ---------------------------------------------------------- */

  const startListening = async () => {
    const adapter = route?.chosen;
    if (!adapter) return;
    dispatch({ type: 'START' });
    if (!isDriven(adapter)) {
      // The keyboard path: the user drives it. Focusing the field is the only
      // thing Mise can do to help, and it brings up the keyboard whose
      // microphone key does the actual work.
      dispatch({ type: 'PERMISSION_GRANTED' });
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
        onError: (kind) => dispatch({ type: 'FAIL', kind }),
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

  const finish = async () => {
    const adapter = route?.chosen;
    dispatch({ type: 'FINISH' });
    let transcript = session.transcript;

    if (adapter && isDriven(adapter)) {
      dispatch({ type: 'TRANSCRIBING' });
      try {
        transcript = (await adapter.stop()).text;
      } catch {
        dispatch({ type: 'FAIL', kind: 'transcription_failed' });
        return;
      }
    }
    dispatch({ type: 'TRANSCRIBED', text: transcript });

    if (transcript.trim().length === 0) {
      dispatch({ type: 'FAIL', kind: 'no_speech' });
      return;
    }

    setProcessing(true);
    try {
      const draft = await buildVoiceDraft({
        draftId: randomUUID(),
        transcript,
        transcriptionMode: session.mode,
        sessionLocationId,
        // Local cascade only. Sending an unrecognised word to a provider is a
        // separate disclosure, offered in review where the user can see which
        // words it would be.
        allowProviderResolution: false,
      });
      setDraft(draft);
      router.push('/pantry-voice-review');
    } catch {
      dispatch({ type: 'FAIL', kind: 'resolution_failed' });
    } finally {
      setProcessing(false);
    }
  };

  const cancel = () => {
    const adapter = route?.chosen;
    if (adapter && isDriven(adapter)) void adapter.cancel();
    dispatch({ type: 'CANCEL' });
    deleteAudio(session.audioUri);
    purgeAllAudio();
    router.back();
  };

  const download = useMemo(
    () => describeDownload(language, languageName(language)),
    [language],
  );

  /**
   * Fetches the model, then re-resolves the route so it is actually used.
   *
   * Cancellable, because 487 MB is long enough that someone will change their
   * mind — and resumable on the next attempt, which is why cancelling is safe
   * to offer rather than something to talk them out of.
   */
  const startDownload = async () => {
    if (!download || downloading) return;
    const controller = new AbortController();
    downloadAbort.current = controller;
    setDownloadError(null);
    setDownloading({ percent: 0, phase: 'downloading' });
    AccessibilityInfo.announceForAccessibility(
      `Downloading ${download.model.name}, ${download.size}.`,
    );
    try {
      const result = await downloadSpeechModel(
        download.model.id,
        setDownloading,
        controller.signal,
      );
      if (result.status === 'installed') {
        await refreshInstalledModels();
        setInstalledStamp((n) => n + 1);
        AccessibilityInfo.announceForAccessibility(
          `${download.model.name} is ready. Mise will use it for ${languageName(language)}.`,
        );
      } else if (result.status === 'failed') {
        setDownloadError(result.message);
      }
    } finally {
      setDownloading(null);
      downloadAbort.current = null;
    }
  };

  const cancelDownload = () => {
    downloadAbort.current?.abort();
    downloadAbort.current = null;
    setDownloading(null);
  };

  /* -- render ------------------------------------------------------------ */

  const canFinish =
    ['listening', 'paused', 'interrupted'].includes(session.status) &&
    session.transcript.trim().length > 0;

  return (
    <Screen
      scroll
      footer={
        <View style={styles.footer}>
          <Button
            label={processing ? 'Reading what you said' : 'Finish'}
            onPress={() => void finish()}
            disabled={!canFinish}
            loading={processing}
            accessibilityHint="Stops recording and opens the review. Nothing is added yet."
          />
          <Button label="Cancel" variant="ghost" onPress={cancel} />
        </View>
      }
    >
      <View style={styles.header}>
        <ScreenTitle>Speak your pantry</ScreenTitle>
        <Caption muted>
          Mise writes down what you say and shows you a draft. Nothing is added
          until you confirm it.
        </Caption>
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

      <Card style={styles.stateCard}>
        <View style={styles.stateRow}>
          <View
            style={[
              styles.dot,
              session.status === 'listening' && styles.dotLive,
            ]}
          />
          {/* Text carries the state. The dot is decoration and is hidden from
              assistive technology so it cannot be read as a second status. */}
          <RowTitle accessibilityLiveRegion="polite">{statusLabel(session)}</RowTitle>
          <Caption muted numeric style={styles.elapsed}>
            {elapsedLabel(session.elapsedMs)}
          </Caption>
        </View>
        {route?.explanation ? <Caption muted>{route.explanation}</Caption> : null}
      </Card>

      {session.status === 'failed' ? (
        <Card style={styles.problemCard}>
          <RowTitle>{failureLabel(session.failure)}</RowTitle>
          {recoveryActions(session.failure).map((action) => (
            <Caption key={action} muted>
              · {action}
            </Caption>
          ))}
        </Card>
      ) : null}

      {/*
        The download offer. Shown whenever the ladder says a model would do
        better than what it settled for — not only after a failure, because the
        keyboard "working" is exactly the case where someone would never think
        to look for something better.

        Nothing about this model ships inside Mise. The app download does not
        carry it; this fetches it from NVIDIA's published release only when the
        user taps, which is why the size is stated before the button and not
        after it.
      */}
      {route?.downloadSuggestion && download ? (
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

          {downloading ? (
            <>
              <Caption muted accessibilityLiveRegion="polite">
                {downloading.phase === 'extracting'
                  ? `Unpacking… ${downloading.percent}%`
                  : `Downloading… ${downloading.percent}%`}
              </Caption>
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ now: downloading.percent, min: 0, max: 100 }}
              >
                <View style={[styles.progressFill, { width: `${downloading.percent}%` }]} />
              </View>
              <Button label="Stop the download" variant="ghost" onPress={cancelDownload} />
            </>
          ) : (
            <Button
              label={`Download ${download.size}`}
              variant="secondary"
              onPress={() => void startDownload()}
              accessibilityHint={`Downloads ${download.model.name} from ${download.model.publisher}. It runs on this device and nothing is sent anywhere.`}
            />
          )}

          {downloadError ? <Caption>{downloadError}</Caption> : null}
        </Card>
      ) : null}

      <View style={styles.transcriptBlock}>
        <SectionLabel muted>What Mise heard</SectionLabel>
        <TextInput
          ref={inputRef}
          value={session.transcript}
          onChangeText={(text) => dispatch({ type: 'EDIT_TRANSCRIPT', text })}
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
        <Caption muted>
          {livePartials
            ? 'Correct anything here before you finish — it is easier than fixing it in the review.'
            : 'You can correct all of it after you press Finish, before anything is added.'}
        </Caption>
      </View>

      {driven ? (
        <View style={styles.controls}>
          {session.status === 'listening' ? (
            <Button label="Pause" variant="secondary" onPress={() => dispatch({ type: 'PAUSE' })} />
          ) : session.status === 'paused' ? (
            <Button label="Resume" variant="secondary" onPress={() => dispatch({ type: 'RESUME' })} />
          ) : (
            <Button
              label={session.status === 'interrupted' ? 'Start again' : 'Start listening'}
              variant="secondary"
              onPress={() => void startListening()}
            />
          )}
        </View>
      ) : (
        <View style={styles.controls}>
          <Button
            label="Use the keyboard microphone"
            variant="secondary"
            onPress={() => void startListening()}
            accessibilityHint="Opens the keyboard. Tap the microphone key on it to dictate."
          />
        </View>
      )}

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
              setLanguage(entry.tag);
              dispatch({ type: 'SET_LANGUAGE', language: entry.tag });
              setPickingLanguage(false);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: entry.tag === language }}
            style={({ pressed }) => [styles.option, pressed && { opacity: opacity.pressed }]}
          >
            <RowTitle>{entry.name}</RowTitle>
            {entry.tag === language ? <Feather name="check" size={18} color={color.ink} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  contextCard: { gap: space.xs, marginBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTouchTarget,
    paddingVertical: space.xs,
  },
  rowText: { flex: 1, gap: 2 },
  stateCard: { gap: space.xs, marginBottom: space.md },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: color.muted,
  },
  dotLive: { backgroundColor: color.paprika },
  elapsed: { marginLeft: 'auto' },
  problemCard: { gap: space.xs, marginBottom: space.md },
  downloadCard: { gap: space.xs, marginBottom: space.md },
  downloadHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sizeRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
  sizeNote: { flexShrink: 1 },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: color.line,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: color.ink },
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
  controls: { gap: space.sm, marginBottom: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.minTouchTarget,
    paddingVertical: space.sm,
  },
  footer: { gap: space.sm },
});
