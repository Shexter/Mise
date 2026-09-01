import {
  recordSpeechDiagnostic,
  type ProvenSpeechMode,
} from '@/media/speech/diagnostics';
import {
  SpeechPermissionDeniedError,
  type DrivenTranscriptionAdapter,
  type TranscriptionAvailability,
  type TranscriptionResult,
} from '@/media/speech/types';
import type { VoiceFailureKind } from '@/media/speech/session';
import type { TranscriptionMode } from '@/types';

interface SpeechRecognitionModule {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  supportsOnDeviceRecognition?(): boolean;
  isRecognitionAvailable?(): boolean;
  getSupportedLocales?(options: {
    androidRecognitionServicePackage?: string;
  }): Promise<{ locales: string[]; installedLocales: string[] }>;
  getSpeechRecognitionServices?(): string[];
  getDefaultRecognitionService?(): { packageName: string };
  androidTriggerOfflineModelDownload?(options: { locale: string }): Promise<{
    status: 'download_success' | 'opened_dialog' | 'download_canceled';
    message: string;
  }>;
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  addListener(
    event: string,
    listener: (payload: Record<string, unknown>) => void,
  ): { remove(): void };
}

type NativeRecognitionKind = 'phone' | 'offline';

function loadModule(): SpeechRecognitionModule | null {
  if (moduleOverrideForTesting !== undefined) return moduleOverrideForTesting;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const module = require('expo-speech-recognition') as {
      ExpoSpeechRecognitionModule?: SpeechRecognitionModule;
    };
    return module.ExpoSpeechRecognitionModule ?? null;
  } catch {
    return null;
  }
}

let moduleOverrideForTesting: SpeechRecognitionModule | null | undefined;

export function __setNativeModuleForTesting(
  module: SpeechRecognitionModule | null | undefined,
): void {
  moduleOverrideForTesting = module;
}

export class NativeSpeechRecognitionError extends Error {
  constructor(
    message: string,
    readonly kind: VoiceFailureKind,
    readonly partialTranscript: string,
    readonly nativeCode: string,
  ) {
    super(message);
    this.name = 'NativeSpeechRecognitionError';
  }
}

function mapErrorCode(code: string): VoiceFailureKind {
  switch (code) {
    case 'not-allowed': return 'permission_denied';
    case 'no-speech':
    case 'speech-timeout': return 'no_speech';
    case 'audio-capture':
    case 'busy': return 'microphone_unavailable';
    case 'language-not-supported': return 'offline_model_missing';
    case 'service-not-allowed':
    case 'network': return 'service_unavailable';
    default: return 'transcription_failed';
  }
}

let listeners: { remove(): void }[] = [];
let pending: {
  resolve: (result: TranscriptionResult) => void;
  reject: (error: Error) => void;
} | null = null;
let onSessionError:
  | ((kind: VoiceFailureKind, partialTranscript?: string, nativeCode?: string) => void)
  | null = null;
let latestTranscript = '';
let latestConfidence: number | null = null;
let activeMode: TranscriptionMode = 'phone';
let activeDiagnosticMode: ProvenSpeechMode = 'phone';

function teardownListeners(): void {
  for (const listener of listeners) listener.remove();
  listeners = [];
  onSessionError = null;
}

function createNativeRecognitionAdapter(
  kind: NativeRecognitionKind,
): DrivenTranscriptionAdapter {
  const phone = kind === 'phone';
  const mode: TranscriptionMode = phone ? 'phone' : 'android_offline';
  const diagnosticMode: ProvenSpeechMode = phone ? 'phone' : 'android_offline';
  return {
    id: phone ? 'phone-speech' : 'android-offline',
    mode,
    label: phone ? 'Phone speech' : 'Android offline',
    privacyLine: phone
      ? 'Your phone speech service turns audio into text. Its provider may process audio off-device.'
      : 'Android turns speech into text with an installed offline language model.',
    canStartProgrammatically: true,
    providesLiveTranscript: true,
    sendsAudioOffDevice: phone,

    async isAvailable(language: string): Promise<TranscriptionAvailability> {
      const module = loadModule();
      if (!module) {
        return {
          available: false,
          reason: 'module_missing',
          detail: 'This build does not include phone speech recognition.',
        };
      }
      if (phone) {
        if (module.isRecognitionAvailable?.() === false) {
          return {
            available: false,
            reason: 'platform_unsupported',
            detail: 'Android did not expose a compatible phone speech service.',
          };
        }
        return { available: true, onDevice: false };
      }

      if (module.supportsOnDeviceRecognition?.() === false) {
        return {
          available: false,
          reason: 'platform_unsupported',
          detail: 'This Android version does not expose the generic on-device recognizer.',
        };
      }
      try {
        const locales = await module.getSupportedLocales?.({});
        if (locales && !locales.installedLocales.some((tag) => sameLanguage(tag, language))) {
          return {
            available: false,
            reason: 'no_offline_model',
            detail: `Android's offline language model for ${language} is not installed.`,
          };
        }
      } catch {
        return {
          available: false,
          reason: 'no_offline_model',
          detail: `Android could not confirm an offline language model for ${language}.`,
        };
      }
      return { available: true, onDevice: true };
    },

    async start({ language, onPartial, onError }) {
      const module = loadModule();
      if (!module) throw new Error('Speech recognition is not available in this build.');
      const { granted } = await module.requestPermissionsAsync();
      if (!granted) throw new SpeechPermissionDeniedError();

      onSessionError = onError ?? null;
      latestTranscript = '';
      latestConfidence = null;
      activeMode = mode;
      activeDiagnosticMode = diagnosticMode;

      listeners = [
        module.addListener('result', (payload) => {
          const results = payload.results as { transcript?: string; confidence?: number }[] | undefined;
          const transcript = results?.[0]?.transcript ?? '';
          latestTranscript = transcript;
          latestConfidence = results?.[0]?.confidence ?? null;
          onPartial(transcript);
        }),
        module.addListener('error', (payload) => {
          const code = String(payload.error ?? '');
          if (code === 'aborted') return;
          const failure = mapErrorCode(code);
          const message = String(payload.message ?? (code || 'Recognition failed.'));
          recordSpeechDiagnostic({
            boundary: 'recognition', outcome: 'failed', mode: activeDiagnosticMode,
            nativeErrorCode: code || 'unknown',
          });
          const error = new NativeSpeechRecognitionError(
            message, failure, latestTranscript, code || 'unknown',
          );
          if (pending) {
            pending.reject(error);
            pending = null;
            return;
          }
          onSessionError?.(failure, latestTranscript, code || 'unknown');
        }),
        module.addListener('end', () => {
          if (!pending) return;
          pending.resolve({
            text: latestTranscript,
            confidence: latestConfidence,
            mode: activeMode,
          });
          recordSpeechDiagnostic({
            boundary: 'recognition', outcome: 'succeeded', mode: activeDiagnosticMode,
          });
          pending = null;
        }),
      ];

      recordSpeechDiagnostic({
        boundary: 'recognition', outcome: 'started', mode: diagnosticMode,
        serviceState: 'available',
        discoveredServiceCount: module.getSpeechRecognitionServices?.().length ?? 0,
      });
      try {
        module.start({
          lang: language,
          interimResults: true,
          continuous: true,
          requiresOnDeviceRecognition: !phone,
        });
      } catch (error) {
        teardownListeners();
        recordSpeechDiagnostic({
          boundary: 'recognition', outcome: 'failed', mode: diagnosticMode,
          nativeErrorCode: error instanceof Error ? error.message : 'start_failed',
        });
        throw error;
      }
      return { audioUri: null };
    },

    async stop(): Promise<TranscriptionResult> {
      const module = loadModule();
      if (!module) throw new Error('Speech recognition is not available in this build.');
      return new Promise<TranscriptionResult>((resolve, reject) => {
        pending = { resolve, reject };
        module.stop();
      }).finally(teardownListeners);
    },

    async cancel(): Promise<void> {
      pending = null;
      teardownListeners();
      loadModule()?.abort();
      recordSpeechDiagnostic({
        boundary: 'recognition', outcome: 'cancelled', mode: diagnosticMode,
      });
    },
  };
}

export const phoneSpeechAdapter = createNativeRecognitionAdapter('phone');
export const androidOfflineRecognitionAdapter = createNativeRecognitionAdapter('offline');
export const nativeRecognitionAdapter = androidOfflineRecognitionAdapter;

export type OfflineLanguageStatus = 'installed' | 'missing' | 'unsupported';
export type OfflineLanguageInstallResult =
  | { status: 'installed' | 'completed' | 'dialog_opened' | 'cancelled'; recheck: boolean }
  | { status: 'unsupported' | 'failed'; recheck: false; message: string };

export async function getAndroidOfflineLanguageStatus(
  language: string,
): Promise<OfflineLanguageStatus> {
  const module = loadModule();
  if (!module || module.supportsOnDeviceRecognition?.() === false) return 'unsupported';
  try {
    const locales = await module.getSupportedLocales?.({});
    if (!locales) return 'installed';
    return locales.installedLocales.some((tag) => sameLanguage(tag, language))
      ? 'installed'
      : 'missing';
  } catch {
    return 'unsupported';
  }
}

export async function installAndroidOfflineLanguage(
  language: string,
): Promise<OfflineLanguageInstallResult> {
  const module = loadModule();
  const current = await getAndroidOfflineLanguageStatus(language);
  if (current === 'installed') return { status: 'installed', recheck: false };
  if (current === 'unsupported' || !module?.androidTriggerOfflineModelDownload) {
    return {
      status: 'unsupported', recheck: false,
      message: 'Android does not offer offline language installation on this device.',
    };
  }
  recordSpeechDiagnostic({
    boundary: 'offline_language_install', outcome: 'started', mode: 'android_offline',
  });
  try {
    const result = await module.androidTriggerOfflineModelDownload({ locale: language });
    if (result.status === 'download_success') {
      recordSpeechDiagnostic({
        boundary: 'offline_language_install', outcome: 'succeeded', mode: 'android_offline',
      });
      return { status: 'completed', recheck: true };
    }
    if (result.status === 'opened_dialog') {
      return { status: 'dialog_opened', recheck: true };
    }
    recordSpeechDiagnostic({
      boundary: 'offline_language_install', outcome: 'cancelled', mode: 'android_offline',
    });
    return { status: 'cancelled', recheck: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Offline language installation failed.';
    recordSpeechDiagnostic({
      boundary: 'offline_language_install', outcome: 'failed', mode: 'android_offline',
      nativeErrorCode: message,
    });
    return { status: 'failed', recheck: false, message };
  }
}

function sameLanguage(a: string, b: string): boolean {
  const head = (tag: string) => tag.toLowerCase().split(/[-_]/)[0];
  return head(a) === head(b);
}
