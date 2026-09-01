import { describe, expect, test } from 'vitest';

import {
  NO_VOICE_CONSENT,
  TRANSCRIPTION_MODES,
  describeDisclosure,
  grantConsent,
  isLocalMode,
  mayLeaveDevice,
  mayTranscribe,
  revokeConsent,
} from '../src/logic/voiceConsent';

/**
 * Task 1.2's proof obligation: a configured vision provider must not become
 * permission to upload audio, and consenting to one payload must not widen to
 * the other.
 */

describe('a provider key is not consent', () => {
  test('audio cannot leave the device on the strength of a key alone', () => {
    expect(mayLeaveDevice('audio_transcription', NO_VOICE_CONSENT, true)).toEqual({
      allowed: false,
      reason: 'not_consented',
    });
  });

  test('an unresolved food word cannot leave on the strength of a key alone', () => {
    expect(mayLeaveDevice('text_resolution', NO_VOICE_CONSENT, true)).toEqual({
      allowed: false,
      reason: 'not_consented',
    });
  });

  test('consent without a key is still refused, and says so differently', () => {
    const consent = grantConsent(NO_VOICE_CONSENT, 'audio_transcription');
    expect(mayLeaveDevice('audio_transcription', consent, false)).toEqual({
      allowed: false,
      reason: 'no_provider_key',
    });
  });

  test('consent plus a key is the only allowed combination', () => {
    const consent = grantConsent(NO_VOICE_CONSENT, 'audio_transcription');
    expect(mayLeaveDevice('audio_transcription', consent, true)).toEqual({
      allowed: true,
    });
  });
});

describe('the two payloads are consented separately', () => {
  test('agreeing to cloud transcription does not agree to text resolution', () => {
    const consent = grantConsent(NO_VOICE_CONSENT, 'audio_transcription');
    expect(consent.textResolution).toBe(false);
    expect(mayLeaveDevice('text_resolution', consent, true).allowed).toBe(false);
  });

  test('agreeing to text resolution does not agree to sending audio', () => {
    const consent = grantConsent(NO_VOICE_CONSENT, 'text_resolution');
    expect(consent.audioTranscription).toBe(false);
    expect(mayLeaveDevice('audio_transcription', consent, true).allowed).toBe(false);
  });

  test('revoking one leaves the other standing', () => {
    const both = grantConsent(
      grantConsent(NO_VOICE_CONSENT, 'audio_transcription'),
      'text_resolution',
    );
    const revoked = revokeConsent(both, 'audio_transcription');
    expect(revoked).toEqual({ audioTranscription: false, textResolution: true });
  });
});

describe('local modes never ask', () => {
  test('Phone speech and cloud are the only modes that can cross the device boundary', () => {
    for (const mode of TRANSCRIPTION_MODES) {
      const verdict = mayTranscribe(mode, NO_VOICE_CONSENT, false);
      const local = !['cloud', 'phone'].includes(mode);
      expect(verdict.allowed).toBe(local);
      expect(isLocalMode(mode)).toBe(local);
    }
  });
});

describe('disclosure copy', () => {
  test('audio disclosure names the provider and offers a way out', () => {
    const disclosure = describeDisclosure('audio_transcription', 'gemini');
    expect(disclosure.payload).toContain('Google Gemini');
    expect(disclosure.ifDeclined).toMatch(/type/i);
  });

  test('text disclosure states what is NOT sent', () => {
    const disclosure = describeDisclosure('text_resolution', 'anthropic');
    expect(disclosure.payload).toContain('Anthropic');
    expect(disclosure.payload).toMatch(/not the audio/i);
    expect(disclosure.payload).toMatch(/not your pantry/i);
  });
});
