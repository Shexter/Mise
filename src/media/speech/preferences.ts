import Storage from 'expo-sqlite/kv-store';

import { modelById } from '@/media/speech/models';

const STORAGE_KEY = 'mise.speech.preferences.v1';

export type SpeechRecognitionPreference = 'phone' | 'offline';

export interface SpeechPreferences {
  recognition: SpeechRecognitionPreference;
  phoneSpeechDisclosureAccepted: boolean;
  aiTranscriptParsingConsent: boolean;
  preferredModelId: string | null;
}

export const DEFAULT_SPEECH_PREFERENCES: SpeechPreferences = {
  recognition: 'phone',
  phoneSpeechDisclosureAccepted: false,
  aiTranscriptParsingConsent: false,
  preferredModelId: null,
};

/**
 * Reads the local speech contract without touching a provider, a key, or the
 * model registry. Invalid and old values narrow back to the privacy-preserving
 * defaults instead of turning a truthy string into consent.
 */
export function readSpeechPreferences(): SpeechPreferences {
  try {
    return parseSpeechPreferences(Storage.getItemSync(STORAGE_KEY));
  } catch {
    return { ...DEFAULT_SPEECH_PREFERENCES };
  }
}

export function writeSpeechPreferences(preferences: SpeechPreferences): void {
  Storage.setItemSync(STORAGE_KEY, JSON.stringify(parseSpeechPreferences(preferences)));
}

export function updateSpeechPreferences(
  patch: Partial<SpeechPreferences>,
): SpeechPreferences {
  const next = parseSpeechPreferences({ ...readSpeechPreferences(), ...patch });
  writeSpeechPreferences(next);
  return next;
}

export function revokeAiTranscriptParsingConsent(): SpeechPreferences {
  return updateSpeechPreferences({ aiTranscriptParsingConsent: false });
}

export function clearSpeechPreferences(): void {
  try {
    Storage.removeItemSync(STORAGE_KEY);
  } catch {
    // Delete-all continues even if the preference store has already gone away.
  }
}

export function parseSpeechPreferences(value: unknown): SpeechPreferences {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return { ...DEFAULT_SPEECH_PREFERENCES };
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_SPEECH_PREFERENCES };
  }
  const record = parsed as Record<string, unknown>;
  const modelId = typeof record['preferredModelId'] === 'string'
    ? record['preferredModelId']
    : null;
  return {
    recognition: record['recognition'] === 'offline' ? 'offline' : 'phone',
    phoneSpeechDisclosureAccepted:
      record['phoneSpeechDisclosureAccepted'] === true,
    aiTranscriptParsingConsent: record['aiTranscriptParsingConsent'] === true,
    preferredModelId: modelId && modelById(modelId) ? modelId : null,
  };
}
