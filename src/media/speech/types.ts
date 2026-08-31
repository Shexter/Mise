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
  }): Promise<{ audioUri: string | null }>;
  stop(): Promise<TranscriptionResult>;
  cancel(): Promise<void>;
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
