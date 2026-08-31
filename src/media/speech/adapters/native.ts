import type {
  DrivenTranscriptionAdapter,
  TranscriptionAvailability,
  TranscriptionResult,
} from '@/media/speech/types';

/**
 * The platform's own speech recogniser — `SFSpeechRecognizer` on iOS, Android's
 * `SpeechRecognizer` — reached through `expo-speech-recognition` when that
 * module is in the build.
 *
 * The module is a dependency, but its *native* side is not always there: Expo
 * Go has no custom native code, and neither does a checkout that has not been
 * prebuilt. So the adapter probes at runtime and reports `module_missing` when
 * the native module does not answer, which the routing ladder treats as an
 * ordinary skip down to the keyboard rather than as an error.
 *
 * The probe is also the honest shape for this adapter on a real device: there
 * are three separate ways for the platform recogniser to be unavailable — no
 * native module, no on-device model for the chosen language, or a platform too
 * old for continuous recognition — and each one needs a different sentence and
 * a different repair. A boolean would collapse them.
 *
 * Nothing here reaches the network. `requiresOnDeviceRecognition` is passed on
 * every start, and a device that cannot honour it is reported unavailable
 * rather than quietly falling back to the platform's server-side recogniser —
 * which would send the user's kitchen audio to Apple or Google without ever
 * showing the disclosure this feature promises.
 */

/** The slice of `expo-speech-recognition` this adapter uses. */
interface SpeechRecognitionModule {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  supportsOnDeviceRecognition?(): boolean;
  getSupportedLocales?(options?: unknown): Promise<{ installedLocales: string[] }>;
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  addSpeechRecognitionListener(
    event: string,
    handler: (payload: Record<string, unknown>) => void,
  ): { remove(): void };
}

/**
 * Reaches the native module without letting its absence be fatal.
 *
 * `require` inside a try rather than a static import: under Expo Go, under the
 * Node test runner, and before a prebuild, resolving this at module scope
 * throws and takes the whole voice surface down with it. Here the failure is a
 * null, and the caller falls to the keyboard.
 */
function loadModule(): SpeechRecognitionModule | null {
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

let listeners: { remove(): void }[] = [];
let pending: {
  resolve: (result: TranscriptionResult) => void;
  reject: (error: Error) => void;
  transcript: string;
  confidence: number | null;
} | null = null;

export const nativeRecognitionAdapter: DrivenTranscriptionAdapter = {
  id: 'native',
  mode: 'on_device',
  label: 'This device’s speech recognition',
  privacyLine:
    'Your speech is recognised on this device. Nothing is sent anywhere.',
  canStartProgrammatically: true,
  // `interimResults` gives partial hypotheses while the user is still talking.
  providesLiveTranscript: true,
  sendsAudioOffDevice: false,

  async isAvailable(language: string): Promise<TranscriptionAvailability> {
    const module = loadModule();
    if (!module) {
      return {
        available: false,
        reason: 'module_missing',
        detail:
          'This build does not include the speech recognition module. The keyboard microphone works instead.',
      };
    }
    if (module.supportsOnDeviceRecognition?.() === false) {
      return {
        available: false,
        reason: 'no_offline_model',
        detail: 'This device cannot recognise speech without sending it away.',
      };
    }
    try {
      const locales = await module.getSupportedLocales?.({});
      const installed = locales?.installedLocales ?? [];
      if (installed.length > 0 && !installed.some((tag) => sameLanguage(tag, language))) {
        return {
          available: false,
          reason: 'no_offline_model',
          detail: `No offline model for ${language} is installed on this device.`,
        };
      }
    } catch {
      // A probe that throws tells us nothing about the language; fall through
      // and let a real start surface a real error rather than guessing here.
    }
    return { available: true, onDevice: true };
  },

  async start({ language, onPartial }) {
    const module = loadModule();
    if (!module) throw new Error('Speech recognition is not available in this build.');

    const { granted } = await module.requestPermissionsAsync();
    if (!granted) throw new Error('Microphone permission was not granted.');

    listeners = [
      module.addSpeechRecognitionListener('result', (payload) => {
        const results = payload.results as { transcript?: string; confidence?: number }[] | undefined;
        const transcript = results?.[0]?.transcript ?? '';
        const confidence = results?.[0]?.confidence ?? null;
        if (pending) {
          pending.transcript = transcript;
          pending.confidence = confidence;
        }
        onPartial(transcript);
      }),
      module.addSpeechRecognitionListener('error', (payload) => {
        pending?.reject(new Error(String(payload.message ?? payload.error ?? 'Recognition failed.')));
        pending = null;
      }),
      module.addSpeechRecognitionListener('end', () => {
        if (!pending) return;
        pending.resolve({
          text: pending.transcript,
          confidence: pending.confidence,
          mode: 'on_device',
        });
        pending = null;
      }),
    ];

    module.start({
      lang: language,
      interimResults: true,
      continuous: true,
      // Non-negotiable: a device that cannot do this is reported unavailable
      // rather than silently upgraded to the platform's server recogniser.
      requiresOnDeviceRecognition: true,
    });

    // The platform recogniser hands back text, not a file. There is no audio
    // for Mise to hold, and therefore none to delete.
    return { audioUri: null };
  },

  async stop(): Promise<TranscriptionResult> {
    const module = loadModule();
    if (!module) throw new Error('Speech recognition is not available in this build.');

    return new Promise<TranscriptionResult>((resolve, reject) => {
      pending = { resolve, reject, transcript: '', confidence: null };
      module.stop();
    }).finally(() => {
      for (const listener of listeners) listener.remove();
      listeners = [];
    });
  },

  async cancel(): Promise<void> {
    pending = null;
    for (const listener of listeners) listener.remove();
    listeners = [];
    loadModule()?.abort();
  },
};

/** Compares BCP-47 tags on their primary subtag only: en-GB serves en-US. */
function sameLanguage(a: string, b: string): boolean {
  const head = (tag: string) => tag.toLowerCase().split(/[-_]/)[0];
  return head(a) === head(b);
}
