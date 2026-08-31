import type { TranscriptionMode } from '@/types';
import type { VoiceFailureKind } from '@/media/speech/session';

/**
 * The platform-neutral shape every transcription path implements.
 *
 * Four of them exist, and they differ in ways the UI genuinely has to know
 * about rather than in ways it can pretend away — which is why availability is
 * a reason rather than a boolean, and why `canStartProgrammatically` is on the
 * interface at all. Keyboard dictation cannot be started by the app; saying it
 * can, and then rendering a Start button that does nothing, would be worse than
 * telling the user to tap the microphone on their keyboard.
 */

export type UnavailableReason =
  /** The native module is not in the build (no development build yet). */
  | 'module_missing'
  /** The platform recogniser has no on-device model for this language. */
  | 'no_offline_model'
  /** A registry model covers the language but is not downloaded. */
  | 'model_not_downloaded'
  /** No model of any kind covers the language. */
  | 'language_unsupported'
  /** The user has not consented to this session sending audio. */
  | 'not_consented'
  | 'no_provider_key'
  | 'platform_unsupported';

export type TranscriptionAvailability =
  | { available: true; onDevice: boolean }
  | { available: false; reason: UnavailableReason; detail: string };

export interface TranscriptionResult {
  text: string;
  /** The adapter's own confidence, where it reports one. Never the identity's. */
  confidence: number | null;
  mode: TranscriptionMode;
}

export interface TranscriptionAdapter {
  id: string;
  mode: TranscriptionMode;
  /** Shown to the user when choosing or explaining the path. */
  label: string;
  /** One line on where the speech is processed. */
  privacyLine: string;
  /**
   * False when the user drives capture themselves — the keyboard microphone.
   * The session chrome adapts rather than rendering dead controls.
   */
  canStartProgrammatically: boolean;
  /**
   * False when text only appears once the user finishes.
   *
   * The two downloadable models are offline recognisers, not streaming ones, so
   * they genuinely cannot show words as they are spoken. The surface says
   * "Mise writes it down when you finish" rather than leaving an empty box that
   * reads as a broken microphone.
   */
  providesLiveTranscript: boolean;
  /** Whether audio ever leaves the device on this path. */
  sendsAudioOffDevice: boolean;
  isAvailable(language: string): Promise<TranscriptionAvailability>;
}

/** Adapters Mise can start and stop itself. */
export interface DrivenTranscriptionAdapter extends TranscriptionAdapter {
  canStartProgrammatically: true;
  start(options: {
    language: string;
    onPartial: (text: string) => void;
    /**
     * Called for a failure that arrives *while listening* — a native error
     * event, a service dying mid-session — rather than one thrown from
     * `start()` or `stop()` themselves.
     *
     * Without this, an adapter has nowhere to put a failure that is not the
     * direct result of a call the screen made: the native side reports it on
     * its own schedule, and if nothing is listening for that report it is
     * dropped. A dropped error looks like a microphone that has silently
     * stopped working, which is worse than any specific failure message.
     */
    onError?: (kind: VoiceFailureKind) => void;
  }): Promise<{ audioUri: string | null }>;
  stop(): Promise<TranscriptionResult>;
  cancel(): Promise<void>;
}

/**
 * Thrown by a driven adapter's `start()` specifically when the *permission*
 * was refused — as opposed to any other way starting can fail (a missing
 * module, a native error, a locale the recogniser rejects).
 *
 * The distinction matters because the screen's failure copy is per-kind:
 * `permission_denied` tells the user to open Settings, which is exactly the
 * wrong instruction for a failure that has nothing to do with permission —
 * and sends someone to check a toggle that was never the problem.
 */
export class SpeechPermissionDeniedError extends Error {
  constructor(message = 'Microphone or speech-recognition permission was not granted.') {
    super(message);
    this.name = 'SpeechPermissionDeniedError';
  }
}

export function isDriven(
  adapter: TranscriptionAdapter,
): adapter is DrivenTranscriptionAdapter {
  return adapter.canStartProgrammatically;
}

/** Maps an unavailability into the failure the session should show. */
export function failureForUnavailable(reason: UnavailableReason): VoiceFailureKind {
  switch (reason) {
    case 'module_missing':
    case 'platform_unsupported':
      return 'service_unavailable';
    case 'no_offline_model':
    case 'model_not_downloaded':
    case 'language_unsupported':
      return 'offline_model_missing';
    case 'not_consented':
    case 'no_provider_key':
      return 'provider_rejected';
  }
}
