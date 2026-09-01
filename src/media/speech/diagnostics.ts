import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';

import type { Provider } from '@/api/keyStore';

const STORAGE_KEY = 'mise.speech.diagnostics.v1';
const MAX_EVENTS = 24;

export type ProvenSpeechMode =
  | 'phone'
  | 'android_offline'
  | 'parakeet'
  | 'sensevoice'
  | 'keyboard'
  | 'type';

export type SpeechDiagnosticBoundary =
  | 'recognition'
  | 'offline_language_install'
  | 'model_download'
  | 'model_validation'
  | 'transcript_parse'
  | 'pantry_review';

export type SpeechDiagnosticOutcome = 'started' | 'succeeded' | 'failed' | 'cancelled';
export type ModelReadiness =
  | 'absent'
  | 'downloading'
  | 'paused'
  | 'extracting'
  | 'validating'
  | 'ready'
  | 'repair'
  | 'incompatible';
export type TranscriptParserPath = 'not_run' | 'ai' | 'local' | 'mixed';

/**
 * Deliberately allowlisted. There is nowhere to put transcript text, audio,
 * Pantry content, credentials, or a raw provider response.
 */
export interface SpeechDiagnosticInput {
  boundary: SpeechDiagnosticBoundary;
  outcome: SpeechDiagnosticOutcome;
  mode: ProvenSpeechMode;
  serviceState?: 'available' | 'unavailable' | 'unknown';
  discoveredServiceCount?: number;
  nativeErrorCode?: string | null;
  modelId?: string | null;
  modelReadiness?: ModelReadiness;
  parserPath?: TranscriptParserPath;
  provider?: Provider | null;
  providerModel?: string | null;
}

export interface SpeechDiagnosticEvent extends SpeechDiagnosticInput {
  at: string;
  appVersion: string;
  sourceRevision: string;
}

export interface SpeechDiagnosticReport {
  generatedAt: string;
  appVersion: string;
  sourceRevision: string;
  events: readonly SpeechDiagnosticEvent[];
}

const BOUNDARIES: readonly SpeechDiagnosticBoundary[] = [
  'recognition', 'offline_language_install', 'model_download',
  'model_validation', 'transcript_parse', 'pantry_review',
];
const OUTCOMES: readonly SpeechDiagnosticOutcome[] = [
  'started', 'succeeded', 'failed', 'cancelled',
];
const MODES: readonly ProvenSpeechMode[] = [
  'phone', 'android_offline', 'parakeet', 'sensevoice', 'keyboard', 'type',
];
const READINESS: readonly ModelReadiness[] = [
  'absent', 'downloading', 'paused', 'extracting', 'validating', 'ready',
  'repair', 'incompatible',
];
const PARSER_PATHS: readonly TranscriptParserPath[] = ['not_run', 'ai', 'local', 'mixed'];
const PROVIDERS: readonly Provider[] = ['anthropic', 'gemini', 'openai'];

export function createSpeechDiagnosticEvent(
  input: SpeechDiagnosticInput,
  now = new Date(),
): SpeechDiagnosticEvent {
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const configuredRevision = Constants.expoConfig?.extra?.['sourceRevision'];
  const sourceRevision = safeToken(configuredRevision, 'development', 64);
  return {
    boundary: includes(BOUNDARIES, input.boundary) ? input.boundary : 'recognition',
    outcome: includes(OUTCOMES, input.outcome) ? input.outcome : 'failed',
    mode: includes(MODES, input.mode) ? input.mode : 'type',
    ...(input.serviceState && ['available', 'unavailable', 'unknown'].includes(input.serviceState)
      ? { serviceState: input.serviceState }
      : {}),
    ...(typeof input.discoveredServiceCount === 'number'
      ? { discoveredServiceCount: Math.max(0, Math.min(99, Math.round(input.discoveredServiceCount))) }
      : {}),
    ...(input.nativeErrorCode ? { nativeErrorCode: safeToken(input.nativeErrorCode, 'unknown', 80) } : {}),
    ...(input.modelId ? { modelId: safeToken(input.modelId, 'unknown', 120) } : {}),
    ...(input.modelReadiness && includes(READINESS, input.modelReadiness)
      ? { modelReadiness: input.modelReadiness }
      : {}),
    ...(input.parserPath && includes(PARSER_PATHS, input.parserPath)
      ? { parserPath: input.parserPath }
      : {}),
    ...(input.provider && includes(PROVIDERS, input.provider) ? { provider: input.provider } : {}),
    ...(input.providerModel ? { providerModel: safeToken(input.providerModel, 'unknown', 120) } : {}),
    at: now.toISOString(),
    appVersion,
    sourceRevision,
  };
}

export function recordSpeechDiagnostic(input: SpeechDiagnosticInput): SpeechDiagnosticEvent {
  const event = createSpeechDiagnosticEvent(input);
  const events = [...readSpeechDiagnostics(), event].slice(-MAX_EVENTS);
  try {
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // Diagnostics are support evidence, never a reason to fail speech intake.
  }
  return event;
}

export function readSpeechDiagnostics(): SpeechDiagnosticEvent[] {
  try {
    const parsed: unknown = JSON.parse(Storage.getItemSync(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseStoredEvent)
      .filter((event): event is SpeechDiagnosticEvent => event !== null)
      .slice(-MAX_EVENTS);
  } catch {
    return [];
  }
}

export function buildSpeechDiagnosticReport(): SpeechDiagnosticReport {
  const probe = createSpeechDiagnosticEvent({
    boundary: 'recognition', outcome: 'started', mode: 'type',
  });
  return {
    generatedAt: new Date().toISOString(),
    appVersion: probe.appVersion,
    sourceRevision: probe.sourceRevision,
    events: readSpeechDiagnostics(),
  };
}

export function serializeSpeechDiagnosticReport(): string {
  return JSON.stringify(buildSpeechDiagnosticReport(), null, 2);
}

export function clearSpeechDiagnostics(): void {
  try {
    Storage.removeItemSync(STORAGE_KEY);
  } catch {
    // Delete-all remains best-effort across already-cleared platform storage.
  }
}

function parseStoredEvent(value: unknown): SpeechDiagnosticEvent | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (
    !includes(BOUNDARIES, record['boundary']) ||
    !includes(OUTCOMES, record['outcome']) ||
    !includes(MODES, record['mode']) ||
    typeof record['at'] !== 'string'
  ) return null;
  return createSpeechDiagnosticEvent({
    boundary: record['boundary'],
    outcome: record['outcome'],
    mode: record['mode'],
    serviceState: record['serviceState'] === 'available' ||
      record['serviceState'] === 'unavailable' ? record['serviceState'] : 'unknown',
    discoveredServiceCount: typeof record['discoveredServiceCount'] === 'number'
      ? record['discoveredServiceCount'] : undefined,
    nativeErrorCode: typeof record['nativeErrorCode'] === 'string' ? record['nativeErrorCode'] : null,
    modelId: typeof record['modelId'] === 'string' ? record['modelId'] : null,
    modelReadiness: includes(READINESS, record['modelReadiness']) ? record['modelReadiness'] : undefined,
    parserPath: includes(PARSER_PATHS, record['parserPath']) ? record['parserPath'] : undefined,
    provider: includes(PROVIDERS, record['provider']) ? record['provider'] : null,
    providerModel: typeof record['providerModel'] === 'string' ? record['providerModel'] : null,
  }, new Date(record['at']));
}

function includes<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function safeToken(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/[^\p{L}\p{N}._:/+ -]/gu, '').trim();
  return normalized.length > 0 ? normalized.slice(0, maxLength) : fallback;
}
