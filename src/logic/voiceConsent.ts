import type { Provider } from '@/api/keyStore';
import { TRANSCRIPTION_MODES, type TranscriptionMode } from '@/types';

export { TRANSCRIPTION_MODES };
export type { TranscriptionMode };

/**
 * The privacy boundary for voice pantry intake.
 *
 * Pure and dependency-free on purpose: the whole value of this module is that
 * the rules can be asserted in a test without a device, a key, or a network
 * stub. Everything here answers one question — may this specific payload leave
 * the device right now — and the answer is never derived from "a key exists".
 *
 * The distinction the rest of the app has not needed until now: Mise already
 * holds a provider key for *photographs*. Speech is a different payload with a
 * different sensitivity (a kitchen microphone records whoever else is in the
 * kitchen), and an unresolved ingredient name is a third. Each needs its own
 * consent, per session, and no two of them are implied by each other.
 */

/** Whether a mode can produce a transcript without any network request. */
export function isLocalMode(mode: TranscriptionMode): boolean {
  return !['cloud', 'phone'].includes(mode);
}

/**
 * The two payloads that can leave the device during voice intake, kept
 * separate because consenting to one says nothing about the other.
 */
export type VoiceDisclosureKind =
  /** Recorded audio, sent to a transcription provider. */
  | 'audio_transcription'
  /** A short ingredient phrase, sent to resolve an unknown food name. */
  | 'text_resolution';

/**
 * What the user agreed to for *this* session. Nothing is persisted: consent
 * does not survive the session that granted it, so a second sweep asks again.
 */
export interface VoiceSessionConsent {
  audioTranscription: boolean;
  textResolution: boolean;
}

export const NO_VOICE_CONSENT: VoiceSessionConsent = {
  audioTranscription: false,
  textResolution: false,
};

/** What must be shown before the matching consent can be collected. */
export interface VoiceDisclosure {
  kind: VoiceDisclosureKind;
  /** The provider by name. Never "a provider" or "the cloud". */
  provider: Provider;
  /** What leaves the device, in the user's terms. */
  payload: string;
  /** Why it is needed. */
  reason: string;
  /** What happens if they decline — never a dead end. */
  ifDeclined: string;
}

const PROVIDER_NAMES: Record<Provider, string> = {
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
};

export function providerName(provider: Provider): string {
  return PROVIDER_NAMES[provider];
}

/**
 * The exact words shown before audio or text leaves the device.
 *
 * Held here rather than in a screen so the copy is testable and cannot drift
 * between the recording surface and the review surface.
 */
export function describeDisclosure(
  kind: VoiceDisclosureKind,
  provider: Provider,
): VoiceDisclosure {
  const name = providerName(provider);
  if (kind === 'audio_transcription') {
    return {
      kind,
      provider,
      payload: `The audio you record in this session, sent to ${name}.`,
      reason:
        'This device cannot turn your speech into text on its own, so the recording has to be transcribed elsewhere.',
      ifDeclined:
        'Nothing is recorded. You can type your items instead, or add them one at a time.',
    };
  }
  return {
    kind,
    provider,
    payload: `Only the food words Mise could not recognise, sent to ${name}. Not the audio, not your pantry, not your profile.`,
    reason:
      'Mise did not recognise these ingredients from what is already on the device.',
    ifDeclined:
      'Those items stay in the review as unrecognised. You can pick the right ingredient yourself or skip them.',
  };
}

/**
 * Whether a payload may be sent, and if not, why not.
 *
 * `hasProviderKey` is deliberately the *last* condition rather than the first.
 * A key is what makes a request possible; consent is what makes it permitted,
 * and the order here is the reason a vision key cannot become speech consent
 * by accident.
 */
export type VoiceEgressVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'not_consented' | 'no_provider_key' };

export function mayLeaveDevice(
  kind: VoiceDisclosureKind,
  consent: VoiceSessionConsent,
  hasProviderKey: boolean,
): VoiceEgressVerdict {
  const consented =
    kind === 'audio_transcription'
      ? consent.audioTranscription
      : consent.textResolution;
  if (!consented) return { allowed: false, reason: 'not_consented' };
  if (!hasProviderKey) return { allowed: false, reason: 'no_provider_key' };
  return { allowed: true };
}

/**
 * Whether a transcription mode may run under the session's consent.
 *
 * Local modes never consult consent at all — there is nothing to consent to,
 * and asking would train the user to tap through a dialog that does not matter.
 */
export function mayTranscribe(
  mode: TranscriptionMode,
  consent: VoiceSessionConsent,
  hasProviderKey: boolean,
): VoiceEgressVerdict {
  if (isLocalMode(mode)) return { allowed: true };
  return mayLeaveDevice('audio_transcription', consent, hasProviderKey);
}

/**
 * Records consent for one payload kind.
 *
 * Takes and returns the whole object rather than mutating, so granting audio
 * consent cannot accidentally widen text consent — the bug this module exists
 * to make impossible.
 */
export function grantConsent(
  consent: VoiceSessionConsent,
  kind: VoiceDisclosureKind,
): VoiceSessionConsent {
  return kind === 'audio_transcription'
    ? { ...consent, audioTranscription: true }
    : { ...consent, textResolution: true };
}

export function revokeConsent(
  consent: VoiceSessionConsent,
  kind: VoiceDisclosureKind,
): VoiceSessionConsent {
  return kind === 'audio_transcription'
    ? { ...consent, audioTranscription: false }
    : { ...consent, textResolution: false };
}
