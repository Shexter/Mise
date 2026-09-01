import Storage from 'expo-sqlite/kv-store';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test } from 'vitest';

import {
  buildSpeechDiagnosticReport,
  clearSpeechDiagnostics,
  createSpeechDiagnosticEvent,
  readSpeechDiagnostics,
  recordSpeechDiagnostic,
} from '../src/media/speech/diagnostics';
import {
  DEFAULT_SPEECH_PREFERENCES,
  clearSpeechPreferences,
  parseSpeechPreferences,
  readSpeechPreferences,
  updateSpeechPreferences,
} from '../src/media/speech/preferences';

beforeEach(() => {
  Storage.removeItemSync('mise.speech.preferences.v1');
  Storage.removeItemSync('mise.speech.diagnostics.v1');
});

describe('persisted speech preferences', () => {
  test('missing and malformed values cannot manufacture consent', () => {
    expect(readSpeechPreferences()).toEqual(DEFAULT_SPEECH_PREFERENCES);
    expect(parseSpeechPreferences('{nope')).toEqual(DEFAULT_SPEECH_PREFERENCES);
    expect(parseSpeechPreferences({
      recognition: 'surprise',
      phoneSpeechDisclosureAccepted: 'yes',
      aiTranscriptParsingConsent: 1,
      preferredModelId: 'not-a-real-model',
    })).toEqual(DEFAULT_SPEECH_PREFERENCES);
  });

  test('phone disclosure, Offline only, consent, and a compatible model survive restart', () => {
    updateSpeechPreferences({
      recognition: 'offline',
      phoneSpeechDisclosureAccepted: true,
      aiTranscriptParsingConsent: true,
      preferredModelId: 'sense-voice-small',
    });
    expect(readSpeechPreferences()).toEqual({
      recognition: 'offline',
      phoneSpeechDisclosureAccepted: true,
      aiTranscriptParsingConsent: true,
      preferredModelId: 'sense-voice-small',
    });
  });

  test('revocation and Delete all data clear consent without a provider or network', () => {
    updateSpeechPreferences({ aiTranscriptParsingConsent: true });
    expect(updateSpeechPreferences({ aiTranscriptParsingConsent: false }).aiTranscriptParsingConsent)
      .toBe(false);
    clearSpeechPreferences();
    expect(readSpeechPreferences()).toEqual(DEFAULT_SPEECH_PREFERENCES);
  });
});

describe('redacted speech diagnostics', () => {
  test('the runtime allowlist drops content and credentials even from an untyped caller', () => {
    const event = createSpeechDiagnosticEvent({
      boundary: 'transcript_parse',
      outcome: 'failed',
      mode: 'phone',
      nativeErrorCode: 'network\nsecret',
      provider: 'openai',
      providerModel: 'gpt-test',
      transcript: 'six eggs',
      audioUri: '/private/kitchen.wav',
      apiKey: 'sk-secret',
      pantry: ['milk'],
      rawProviderResponse: '{secret}',
    } as never, new Date('2026-09-01T00:00:00.000Z'));
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/six eggs|kitchen\.wav|sk-secret|milk|\{secret\}/);
    expect(event.nativeErrorCode).toBe('network secret');
  });

  test('storage is bounded and invalid stored shapes are ignored', () => {
    for (let index = 0; index < 30; index += 1) {
      recordSpeechDiagnostic({
        boundary: 'recognition', outcome: 'failed', mode: 'phone',
        nativeErrorCode: `error-${index}`,
      });
    }
    expect(readSpeechDiagnostics()).toHaveLength(24);
    Storage.setItemSync('mise.speech.diagnostics.v1', JSON.stringify([{ transcript: 'private' }]));
    expect(readSpeechDiagnostics()).toEqual([]);
  });

  test('Delete all data removes the local report', () => {
    recordSpeechDiagnostic({ boundary: 'model_validation', outcome: 'succeeded', mode: 'parakeet' });
    expect(buildSpeechDiagnosticReport().events).toHaveLength(1);
    clearSpeechDiagnostics();
    expect(buildSpeechDiagnosticReport().events).toEqual([]);
  });
});

describe('speech support and deletion surfaces', () => {
  const settings = readFileSync('app/(tabs)/settings.tsx', 'utf8');
  const sheet = readFileSync('src/components/settings/SpeechDiagnosticsSheet.tsx', 'utf8');

  test('the report is only copied by an explicit redacted action', () => {
    expect(settings).toContain('Speech diagnostics');
    expect(sheet).toContain('Copy redacted report');
    expect(sheet).toContain('Clipboard.setStringAsync(serializeSpeechDiagnosticReport())');
    expect(sheet).toMatch(/never contains[\s\S]*transcripts[\s\S]*audio[\s\S]*API keys[\s\S]*pantry data[\s\S]*raw AI responses/i);
  });

  test('Delete all clears every locally retained voice boundary', () => {
    expect(settings).toContain('removeAllSpeechModels()');
    expect(settings).toContain('clearSpeechPreferences()');
    expect(settings).toContain('clearSpeechDiagnostics()');
    expect(settings).toContain('useVoiceIntakeStore.getState().clear()');
    // Credentials retain their existing, separate Remove key contract.
    const deleteBlock = settings.slice(settings.indexOf('const confirmDeleteAll'));
    expect(deleteBlock).not.toContain('clearApiKey()');
  });
});
