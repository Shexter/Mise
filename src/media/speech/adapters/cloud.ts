import { mayTranscribe, type VoiceSessionConsent } from '@/logic/voiceConsent';
import type {
  TranscriptionAdapter,
  TranscriptionAvailability,
} from '@/media/speech/types';

/**
 * Sending audio to a provider.
 *
 * Deliberately not in the routing ladder. `selectRoute` will never pick this,
 * no matter how thoroughly the on-device paths fail, because a fallback that
 * ends in "your kitchen audio was uploaded" is not a fallback the user agreed
 * to. It exists only where the user has read the disclosure and chosen it for
 * this one session.
 *
 * The two gates are checked in the order that matters. Consent first, key
 * second: Mise already holds a provider key for food photographs, and if the
 * key were checked first the natural next line would be "and it is configured,
 * so go ahead". Asking about consent before capability is what stops a vision
 * key from turning into permission to record a room.
 *
 * The upload itself is not implemented here. No provider in
 * `src/api/keyStore.ts` is currently configured for audio, and wiring one would
 * mean choosing an audio endpoint, a retention contract, and a payload format
 * that no decision in `docs/product-decisions.md` has settled. The adapter
 * reports unavailable rather than pretending, which keeps the refusal something
 * the code states rather than something it omits.
 */
export function createCloudAdapter(
  consent: VoiceSessionConsent,
  hasProviderKey: boolean,
): TranscriptionAdapter {
  return {
    id: 'cloud',
    mode: 'cloud',
    label: 'Transcribe with your provider',
    privacyLine:
      'Your recording is sent to the provider you configured. It leaves this device.',
    canStartProgrammatically: true,
    providesLiveTranscript: false,
    sendsAudioOffDevice: true,

    async isAvailable(): Promise<TranscriptionAvailability> {
      const verdict = mayTranscribe('cloud', consent, hasProviderKey);
      if (!verdict.allowed) {
        return {
          available: false,
          reason: verdict.reason,
          detail:
            verdict.reason === 'not_consented'
              ? 'You have not agreed to send this session’s audio to a provider.'
              : 'No provider key is configured.',
        };
      }
      return {
        available: false,
        reason: 'platform_unsupported',
        detail:
          'Mise has no audio provider yet. Speech stays on this device; use the keyboard microphone or type.',
      };
    },
  };
}
