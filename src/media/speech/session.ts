import type { TranscriptionMode } from '@/types';

/**
 * The microphone's state machine, as a pure reducer.
 *
 * Recording has more ways to end than to start, and most of them are not the
 * user's doing: a call arrives, the headphones disconnect, the app goes to the
 * background, another app grabs the microphone, the permission is revoked in
 * Settings while the screen is open. Each of those needs a different sentence
 * on screen and a different way out, and the one thing none of them may do is
 * quietly start recording again.
 *
 * Writing it as a reducer rather than a pile of booleans makes the illegal
 * transitions unrepresentable and — more usefully — testable without a device.
 * The rule the tests exist to protect: **there is no edge back into
 * `listening` that the user did not take.**
 */

export type VoiceSessionStatus =
  /** Nothing has been asked for and nothing is listening. */
  | 'idle'
  /** The OS permission dialog is up. */
  | 'requesting_permission'
  | 'listening'
  | 'paused'
  /** Capture stopped; the tail of the audio is still being flushed. */
  | 'finishing'
  /** Audio is being turned into text. */
  | 'transcribing'
  /** A transcript exists and can be reviewed. */
  | 'ready'
  /** Something outside the app stopped capture. Never auto-resumes. */
  | 'interrupted'
  | 'failed'
  | 'cancelled';

/** Why a session stopped or cannot start. Each has its own recovery copy. */
export type VoiceFailureKind =
  | 'permission_denied'
  | 'microphone_unavailable'
  | 'no_speech'
  | 'too_noisy'
  | 'service_unavailable'
  | 'offline_model_missing'
  | 'provider_rejected'
  | 'provider_timeout'
  | 'transcription_failed'
  | 'resolution_failed';

export type VoiceInterruptionKind =
  | 'call'
  | 'audio_route_changed'
  | 'backgrounded'
  | 'microphone_taken'
  | 'permission_revoked';

export interface VoiceSessionState {
  status: VoiceSessionStatus;
  mode: TranscriptionMode;
  /** BCP-47 tag the user chose. Never changed silently. */
  language: string;
  /** What has been heard so far. Editable by the user at any point. */
  transcript: string;
  /** Milliseconds of actual capture, excluding paused time. */
  elapsedMs: number;
  failure: VoiceFailureKind | null;
  interruption: VoiceInterruptionKind | null;
  /** Set while raw audio exists on disk and must be deleted before leaving. */
  audioUri: string | null;
}

export type VoiceSessionEvent =
  | { type: 'START' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'AUDIO_STARTED'; audioUri: string | null }
  | { type: 'TRANSCRIPT'; text: string }
  /**
   * Folds text captured up to the moment of pausing into the transcript.
   *
   * Distinct from `TRANSCRIPT`, which only applies while `listening`: a
   * driven adapter has genuinely stopped by the time this arrives (Pause
   * calls `stop()`/`cancel()` on it so the microphone is not left running
   * under a screen that says "Paused"), and the result needs somewhere to
   * land other than a status that no longer accepts live partials.
   */
  | { type: 'MERGE_TRANSCRIPT'; text: string }
  | { type: 'TICK'; ms: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'FINISH' }
  | { type: 'TRANSCRIBING' }
  | { type: 'TRANSCRIBED'; text: string }
  | { type: 'FAIL'; kind: VoiceFailureKind }
  | { type: 'INTERRUPT'; kind: VoiceInterruptionKind }
  | { type: 'CANCEL' }
  | { type: 'AUDIO_DELETED' }
  | { type: 'EDIT_TRANSCRIPT'; text: string }
  | { type: 'SET_LANGUAGE'; language: string }
  | { type: 'SET_MODE'; mode: TranscriptionMode }
  | { type: 'RESET' };

export function initialVoiceSession(
  mode: TranscriptionMode,
  language: string,
): VoiceSessionState {
  return {
    status: 'idle',
    mode,
    language,
    transcript: '',
    elapsedMs: 0,
    failure: null,
    interruption: null,
    audioUri: null,
  };
}

/** States in which the microphone is actually open. */
export function isCapturing(state: VoiceSessionState): boolean {
  return state.status === 'listening';
}

/** States from which the user may still salvage a partial transcript. */
export function hasSalvageableTranscript(state: VoiceSessionState): boolean {
  return (
    state.transcript.trim().length > 0 &&
    ['paused', 'interrupted', 'failed', 'ready'].includes(state.status)
  );
}

/** True while raw audio is still on disk and owes the user a deletion. */
export function owesAudioDeletion(state: VoiceSessionState): boolean {
  return state.audioUri !== null;
}

export function voiceSessionReducer(
  state: VoiceSessionState,
  event: VoiceSessionEvent,
): VoiceSessionState {
  switch (event.type) {
    case 'START':
      // The only edge into capture, from every stopped state. Explicitly
      // includes `interrupted`: coming back from a call, the user taps Start
      // again, which is the point.
      if (['listening', 'finishing', 'transcribing'].includes(state.status)) return state;
      return {
        ...state,
        status: 'requesting_permission',
        failure: null,
        interruption: null,
      };

    case 'PERMISSION_GRANTED':
      if (state.status !== 'requesting_permission') return state;
      return { ...state, status: 'listening' };

    case 'PERMISSION_DENIED':
      if (state.status !== 'requesting_permission') return state;
      return { ...state, status: 'failed', failure: 'permission_denied' };

    case 'AUDIO_STARTED':
      // Only the keyboard mode has no audio of its own; every other mode
      // records a file that must be deleted before the session is over.
      return { ...state, audioUri: event.audioUri };

    case 'TRANSCRIPT':
      if (state.status !== 'listening') return state;
      return { ...state, transcript: event.text };

    case 'MERGE_TRANSCRIPT':
      if (state.status !== 'paused') return state;
      return { ...state, transcript: event.text };

    case 'TICK':
      if (state.status !== 'listening') return state;
      return { ...state, elapsedMs: state.elapsedMs + event.ms };

    case 'PAUSE':
      if (state.status !== 'listening') return state;
      return { ...state, status: 'paused' };

    case 'RESUME':
      // Deliberately *not* reachable from `interrupted`. Resuming after a call
      // must be a decision the user makes with Start, not one the app makes
      // for them.
      if (state.status !== 'paused') return state;
      return { ...state, status: 'listening' };

    case 'FINISH': {
      // A failure normally ends the session, but not when the user typed a
      // recovery — `EDIT_TRANSCRIPT` already permits editing from `failed`,
      // and refusing Finish here as well left that transcript with no way
      // out. Only reachable with something to finish, matching
      // `hasSalvageableTranscript`.
      const salvaging = state.status === 'failed' && state.transcript.trim().length > 0;
      if (!['listening', 'paused', 'interrupted'].includes(state.status) && !salvaging) {
        return state;
      }
      return { ...state, status: 'finishing' };
    }

    case 'TRANSCRIBING':
      if (state.status !== 'finishing') return state;
      return { ...state, status: 'transcribing' };

    case 'TRANSCRIBED':
      if (!['finishing', 'transcribing'].includes(state.status)) return state;
      return { ...state, status: 'ready', transcript: event.text, failure: null };

    case 'FAIL':
      return { ...state, status: 'failed', failure: event.kind };

    case 'INTERRUPT':
      // Anything outside the app that took the microphone. The partial
      // transcript is kept — it is the user's speech, and throwing it away
      // would make an interruption cost more than it has to.
      if (!['listening', 'paused', 'requesting_permission'].includes(state.status)) {
        return state;
      }
      return { ...state, status: 'interrupted', interruption: event.kind };

    case 'CANCEL':
      return {
        ...state,
        status: 'cancelled',
        transcript: '',
        elapsedMs: 0,
        failure: null,
        interruption: null,
      };

    case 'AUDIO_DELETED':
      return { ...state, audioUri: null };

    case 'EDIT_TRANSCRIPT':
      // The transcript is the user's to correct, in every state where it is
      // visible — including while paused, mid-sweep.
      if (['listening', 'transcribing', 'finishing'].includes(state.status)) return state;
      return { ...state, transcript: event.text };

    case 'SET_LANGUAGE':
      if (state.status === 'listening') return state;
      return { ...state, language: event.language };

    case 'SET_MODE':
      if (state.status === 'listening') return state;
      return { ...state, mode: event.mode };

    case 'RESET':
      return initialVoiceSession(state.mode, state.language);
  }
}

/* -------------------------------------------------------------------------- */
/* What the user is told                                                       */
/* -------------------------------------------------------------------------- */

/** The state line. Text, always — a waveform is decoration, not information. */
export function statusLabel(state: VoiceSessionState): string {
  switch (state.status) {
    case 'idle':
      return 'Ready when you are';
    case 'requesting_permission':
      return 'Waiting for microphone access';
    case 'listening':
      return 'Listening';
    case 'paused':
      return 'Paused';
    case 'finishing':
      return 'Finishing up';
    case 'transcribing':
      return 'Writing down what you said';
    case 'ready':
      return 'Ready to review';
    case 'interrupted':
      return interruptionLabel(state.interruption);
    case 'failed':
      return failureLabel(state.failure);
    case 'cancelled':
      return 'Cancelled';
  }
}

function interruptionLabel(kind: VoiceInterruptionKind | null): string {
  switch (kind) {
    case 'call':
      return 'Stopped for a call';
    case 'audio_route_changed':
      return 'Stopped when the audio changed';
    case 'backgrounded':
      return 'Stopped when you left Mise';
    case 'microphone_taken':
      return 'Another app took the microphone';
    case 'permission_revoked':
      return 'Microphone access was turned off';
    default:
      return 'Stopped';
  }
}

/**
 * One sentence per failure, each naming its own cause.
 *
 * Nine distinct kinds rather than "something went wrong" because the recovery
 * differs every time: a denied permission needs Settings, a missing offline
 * model needs a download, heavy noise needs a quieter spot, and a provider
 * timeout needs a retry. One message for all of them would be wrong for eight.
 */
export function failureLabel(kind: VoiceFailureKind | null): string {
  switch (kind) {
    case 'permission_denied':
      return 'Mise does not have microphone access';
    case 'microphone_unavailable':
      return 'The microphone is not available right now';
    case 'no_speech':
      return 'Nothing was picked up';
    case 'too_noisy':
      return 'It was too noisy to make out';
    case 'service_unavailable':
      return 'Speech recognition is not available on this device';
    case 'offline_model_missing':
      return 'No offline speech model for this language';
    case 'provider_rejected':
      return 'The provider refused the request';
    case 'provider_timeout':
      return 'The provider did not answer in time';
    case 'transcription_failed':
      return 'The recording could not be turned into text';
    case 'resolution_failed':
      return 'Mise could not look up those ingredients';
    default:
      return 'Something stopped the recording';
  }
}

/** The way out of each failure. Always at least one, always concrete. */
export function recoveryActions(kind: VoiceFailureKind | null): readonly string[] {
  switch (kind) {
    case 'permission_denied':
      return ['Open Settings', 'Type instead'];
    case 'microphone_unavailable':
      return ['Try again', 'Type instead'];
    case 'no_speech':
    case 'too_noisy':
      return ['Start again', 'Type instead'];
    case 'service_unavailable':
      return ['Retry Phone speech', 'Use Offline only', 'Use the keyboard microphone', 'Type instead'];
    case 'offline_model_missing':
      return ['Download a speech model', 'Change language', 'Type instead'];
    case 'provider_rejected':
    case 'provider_timeout':
      return ['Try again', 'Keep everything on this device', 'Type instead'];
    case 'transcription_failed':
      return ['Try again', 'Use Offline only', 'Use the keyboard microphone', 'Type instead'];
    case 'resolution_failed':
      return ['Review what was found', 'Try again'];
    default:
      return ['Type instead'];
  }
}

/** The elapsed time, spoken as a person would read it. */
export function elapsedLabel(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** What assistive technology is told when the state changes. */
export function announcementFor(
  previous: VoiceSessionState,
  next: VoiceSessionState,
): string | null {
  if (previous.status === next.status) return null;
  switch (next.status) {
    case 'listening':
      return previous.status === 'paused' ? 'Listening again' : 'Listening started';
    case 'paused':
      return 'Paused';
    case 'transcribing':
      return 'Writing down what you said';
    case 'ready':
      return 'Ready to review';
    case 'interrupted':
      return `${interruptionLabel(next.interruption)}. Recording did not restart.`;
    case 'failed':
      return failureLabel(next.failure);
    case 'cancelled':
      return 'Cancelled. Nothing was added.';
    default:
      return null;
  }
}
