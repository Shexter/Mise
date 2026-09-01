import {
  SpeechPermissionDeniedError,
  type DrivenTranscriptionAdapter,
  type TranscriptionAvailability,
  type TranscriptionResult,
} from '@/media/speech/types';
import type { VoiceFailureKind } from '@/media/speech/session';

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
 *
 * **On the module's real shape.** This adapter previously called a method
 * named `addSpeechRecognitionListener`, which does not exist anywhere in
 * `expo-speech-recognition` — the package extends Expo's ordinary
 * `NativeModule`/`EventEmitter`, whose event method is `addListener(event,
 * listener)`. That typo meant `start()` threw before ever calling the native
 * `start`, on every device, regardless of the OS permission being granted —
 * and the screen's catch-all reported that thrown error as "permission
 * denied", which is a second, independent bug: it hid the real failure behind
 * a message that sent a working setup to Settings for nothing. Both are fixed
 * here: the method name is now verified against the installed package's own
 * `.d.ts`, and only an actual permission refusal throws
 * `SpeechPermissionDeniedError` — everything else is a distinguishable error
 * the caller can tell apart from it.
 *
 * **On which recogniser answers.** `androidRecognitionServicePackage` is set
 * explicitly to `com.google.android.as` — Android System Intelligence, the
 * same package declared in `app.config.ts`'s `androidSpeechServicePackages`
 * for manifest visibility. Leaving it unset hands the choice to the OS
 * default, which on a Samsung device is not guaranteed to be a service that
 * supports `requiresOnDeviceRecognition` at all (Bixby's agent, for one,
 * generally does not) — so a device with working on-device recognition could
 * still fail for a reason that has nothing to do with the feature itself.
 */

/** The slice of `expo-speech-recognition` this adapter uses. */
interface SpeechRecognitionModule {
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  supportsOnDeviceRecognition?(): boolean;
  getSupportedLocales?(options?: {
    androidRecognitionServicePackage?: string;
  }): Promise<{ locales: string[]; installedLocales: string[] }>;
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  /** The real event API: Expo's `EventEmitter.addListener`, not a bespoke method. */
  addListener(
    event: string,
    listener: (payload: Record<string, unknown>) => void,
  ): { remove(): void };
}

/** The Android package this adapter always asks for, matching `app.config.ts`. */
const ANDROID_SERVICE_PACKAGE = 'com.google.android.as';

/**
 * Reaches the native module without letting its absence be fatal.
 *
 * `require` inside a try rather than a static import: under Expo Go, under the
 * Node test runner, and before a prebuild, resolving this at module scope
 * throws and takes the whole voice surface down with it. Here the failure is a
 * null, and the caller falls to the keyboard.
 */
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

/**
 * Test-only seam.
 *
 * `vi.mock` cannot reliably intercept this file's runtime `require()` of an
 * installed native package — the call resolves through Node's real module
 * loader rather than through Vitest's mock registry, so a mocked factory is
 * silently ignored and `loadModule()` still returns null under Node. This is
 * the same shape as `__resetDatabaseLifecycleForTests` in `src/db/index.ts`:
 * a narrow, explicitly-named override so the adapter's actual call sequence —
 * which event method it calls, which service package it asks for, what it
 * throws on a permission refusal — can be exercised against a fake module
 * shaped like the real one, rather than left unverified until a device finds
 * the next wrong method name.
 */
export function __setNativeModuleForTesting(
  module: SpeechRecognitionModule | null | undefined,
): void {
  moduleOverrideForTesting = module;
}

/**
 * Maps a native error code onto the session's failure vocabulary.
 *
 * `'aborted'` is deliberately absent from the switch and handled by the
 * caller before this is reached: it fires on our own `cancel()`, and reporting
 * a user-requested cancellation as a failure would be a third, self-inflicted
 * bug on top of the two this file already fixes.
 */
function mapErrorCode(code: string): VoiceFailureKind {
  switch (code) {
    case 'not-allowed':
      return 'permission_denied';
    case 'no-speech':
    case 'speech-timeout':
      return 'no_speech';
    case 'audio-capture':
    case 'busy':
      return 'microphone_unavailable';
    case 'language-not-supported':
      return 'offline_model_missing';
    case 'service-not-allowed':
    case 'network':
      return 'service_unavailable';
    default:
      return 'transcription_failed';
  }
}

let listeners: { remove(): void }[] = [];
let pending: {
  resolve: (result: TranscriptionResult) => void;
  reject: (error: Error) => void;
} | null = null;
/** Reachable for the whole session, not only while `stop()` is pending. */
let onSessionError: ((kind: VoiceFailureKind) => void) | null = null;
/**
 * The most recent transcript, kept for the whole session rather than only
 * while `stop()` is waiting.
 *
 * `continuous: true` on Android delivers a final (`isFinal: true`) result as
 * soon as the recogniser is confident, which is normally *before* the user
 * presses Finish — so by the time `stop()` runs, no further `result` event may
 * ever arrive. Capturing text only from events that happen to land after
 * `stop()` is called would resolve those sessions with an empty transcript,
 * silently discarding speech the user already saw echoed on screen and
 * reporting the session as though nothing had been heard.
 */
let latestTranscript = '';
let latestConfidence: number | null = null;

function teardownListeners(): void {
  for (const listener of listeners) listener.remove();
  listeners = [];
  onSessionError = null;
}

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
      // Probed against the same service `start()` will actually use — checking
      // the OS default and then starting a different, explicitly-chosen
      // service would make this answer meaningless.
      const locales = await module.getSupportedLocales?.({
        androidRecognitionServicePackage: ANDROID_SERVICE_PACKAGE,
      });
      const installed = locales?.installedLocales ?? [];
      if (installed.length > 0 && !installed.some((tag) => sameLanguage(tag, language))) {
        return {
          available: false,
          reason: 'no_offline_model',
          detail: `No offline model for ${language} is installed on this device.`,
        };
      }
    } catch {
      // A probe that throws proves nothing works: on Android that happens
      // whenever `com.google.android.as` (Android System Intelligence) isn't
      // backing the requested service, which is common outside Pixel and
      // Samsung. Reporting `available: true` here was optimism, not evidence
      // — it let the ladder pick a recogniser that then failed at start()
      // with no downgrade and no download offer, since routing only attaches
      // a download suggestion to adapters it actually skipped. An unprovable
      // probe is treated the same as a known-missing model.
      return {
        available: false,
        reason: 'no_offline_model',
        detail: 'This device could not confirm an offline speech model for this language.',
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

    listeners = [
      module.addListener('result', (payload) => {
        const results = payload.results as { transcript?: string; confidence?: number }[] | undefined;
        const transcript = results?.[0]?.transcript ?? '';
        const confidence = results?.[0]?.confidence ?? null;
        latestTranscript = transcript;
        latestConfidence = confidence;
        onPartial(transcript);
      }),
      module.addListener('error', (payload) => {
        const code = String(payload.error ?? '');
        // Our own cancel() aborts the recogniser, which reports itself as an
        // error the same way a real failure would. It is not one.
        if (code === 'aborted') return;

        const message = String(payload.message ?? (code || 'Recognition failed.'));
        if (pending) {
          pending.reject(new Error(message));
          pending = null;
          return;
        }
        // No stop() is in flight, so this arrived mid-session — the one place
        // an error had nowhere to go before onSessionError existed, and so
        // was silently dropped, leaving the screen stuck on "Listening".
        onSessionError?.(mapErrorCode(code));
      }),
      module.addListener('end', () => {
        if (!pending) return;
        pending.resolve({
          text: latestTranscript,
          confidence: latestConfidence,
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
      androidRecognitionServicePackage: ANDROID_SERVICE_PACKAGE,
    });

    // The platform recogniser hands back text, not a file. There is no audio
    // for Mise to hold, and therefore none to delete.
    return { audioUri: null };
  },

  async stop(): Promise<TranscriptionResult> {
    const module = loadModule();
    if (!module) throw new Error('Speech recognition is not available in this build.');

    return new Promise<TranscriptionResult>((resolve, reject) => {
      pending = { resolve, reject };
      module.stop();
    }).finally(() => {
      teardownListeners();
    });
  },

  async cancel(): Promise<void> {
    pending = null;
    teardownListeners();
    loadModule()?.abort();
  },
};

/** Compares BCP-47 tags on their primary subtag only: en-GB serves en-US. */
function sameLanguage(a: string, b: string): boolean {
  const head = (tag: string) => tag.toLowerCase().split(/[-_]/)[0];
  return head(a) === head(b);
}
