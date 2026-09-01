import { chosenModelForLanguage, type SpeechModel } from '@/media/speech/models';
import { installedModelPath } from '@/media/speech/modelStore';
import type {
  DrivenTranscriptionAdapter,
  TranscriptionAvailability,
  TranscriptionResult,
} from '@/media/speech/types';

/**
 * A downloaded on-device model — Parakeet TDT 0.6b v3 for European speech,
 * SenseVoice Small for Chinese, Cantonese, Japanese, Korean, and English.
 *
 * This is the fallback the product owner asked for: something to offer when
 * Apple's or Samsung's own recogniser cannot serve the user. It runs entirely
 * on the device, so it keeps the local-first promise that a cloud transcription
 * would spend.
 *
 * **No audio file is ever written.** `createPcmLiveStream` delivers 16 kHz mono
 * float PCM straight from the microphone, which is exactly what
 * `transcribeSamples` wants, so the recording exists only as a buffer in memory
 * and is dropped when the session ends. That is a stronger position than the
 * native recogniser path and strictly stronger than anything involving a file:
 * there is no `deleteAudio` to forget to call, because there is nothing on disk
 * to delete.
 *
 * Both registered models are *offline* recognisers rather than streaming ones,
 * so there is no live transcript while the user is talking — the text arrives
 * when they finish. The adapter says so through `providesLiveTranscript: false`
 * and the session surface shows "Mise writes it down when you finish" instead
 * of an empty box that looks broken.
 */

/** Ids the user has downloaded. Injected so the adapter stays testable. */
export interface InstalledModels {
  has(modelId: string): boolean;
}

/** Nothing downloaded — the state of a fresh install. */
export const NO_MODELS_INSTALLED: InstalledModels = { has: () => false };

/* -------------------------------------------------------------------------- */
/* The native side, probed rather than imported                                */
/* -------------------------------------------------------------------------- */

interface SttEngine {
  transcribeSamples(
    samples: number[],
    sampleRate: number,
  ): Promise<{ text: string; tokens: string[]; lang: string }>;
  destroy(): Promise<void>;
}

interface SherpaModule {
  createSTT(options: {
    modelPath: { type: 'file'; path: string };
    /**
     * Left as `'auto'` deliberately. `react-native-sherpa-onnx`'s real
     * `STTModelType` union is architecture-specific down to a level this app
     * has no reliable way to state from the outside — a plain sherpa-onnx
     * transducer and a NeMo-exported one (which Parakeet is) are two
     * different values, and getting that one guess wrong would silently
     * misconfigure decoding, the same way `'sensevoice'` here previously
     * guessed wrong against the real `'sense_voice'`. `detectSttModel()`
     * exists in the library specifically so callers do not have to know this;
     * `'auto'` uses that detection.
     */
    modelType?: 'auto';
    modelOptions?: {
      senseVoice?: { language?: string; useItn?: boolean };
    };
  }): Promise<SttEngine>;
}

interface PcmStream {
  start(): Promise<void>;
  stop(): Promise<void>;
  onData(callback: (samples: Float32Array, sampleRate: number) => void): () => void;
  onError(callback: (message: string) => void): () => void;
}

interface AudioModule {
  createPcmLiveStream(options?: {
    sampleRate?: number;
    channelCount?: number;
  }): PcmStream;
}

let sherpaOverrideForTesting: SherpaModule | null | undefined;
let audioOverrideForTesting: AudioModule | null | undefined;

function loadSherpa(): SherpaModule | null {
  if (sherpaOverrideForTesting !== undefined) return sherpaOverrideForTesting;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('react-native-sherpa-onnx/stt') as SherpaModule;
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      return require('react-native-sherpa-onnx') as SherpaModule;
    } catch {
      return null;
    }
  }
}

function loadAudio(): AudioModule | null {
  if (audioOverrideForTesting !== undefined) return audioOverrideForTesting;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('react-native-sherpa-onnx/audio') as AudioModule;
  } catch {
    return null;
  }
}

export function hasLocalRuntime(): boolean {
  return loadSherpa() !== null && loadAudio() !== null;
}

/**
 * Test-only seam, matching `__setNativeModuleForTesting` in `native.ts` and
 * `__resetDatabaseLifecycleForTests` in `src/db/index.ts`: `vi.mock` cannot
 * reliably intercept this file's runtime `require()` of an installed native
 * package, so the adapter's real call shape — `createSTT`'s exact option
 * keys, `createPcmLiveStream`'s subscription shape — is exercised here
 * against a fake built from the package's own `.d.ts` rather than left
 * unverified until a device finds the next wrong field name.
 */
export function __setSherpaModuleForTesting(module: SherpaModule | null | undefined): void {
  sherpaOverrideForTesting = module;
}

export function __setAudioModuleForTesting(module: AudioModule | null | undefined): void {
  audioOverrideForTesting = module;
}

/** What sherpa-onnx wants, and what these models were exported at. */
const SAMPLE_RATE = 16_000;

/**
 * The longest sweep held in memory before Finish is forced.
 *
 * At 16 kHz mono float that is about 3.8 MB a minute, so ten minutes is roughly
 * 38 MB — comfortable, and far longer than anyone spends naming a fridge. The
 * cap exists so a session left running by accident cannot grow without bound.
 */
export const MAX_SESSION_SECONDS = 600;

/* -------------------------------------------------------------------------- */
/* The adapter                                                                 */
/* -------------------------------------------------------------------------- */

export function createLocalModelAdapter(
  installed: InstalledModels = NO_MODELS_INSTALLED,
  preferredModelId?: string | null,
): DrivenTranscriptionAdapter {
  let stream: PcmStream | null = null;
  let unsubscribe: (() => void)[] = [];
  let samples: number[] = [];
  let activeModel: SpeechModel | null = null;

  const teardown = async () => {
    for (const off of unsubscribe) off();
    unsubscribe = [];
    try {
      await stream?.stop();
    } catch {
      // Stopping a stream that already stopped is not an error worth raising.
    }
    stream = null;
    samples = [];
    activeModel = null;
  };

  return {
    id: 'local-model',
    mode: 'local_model',
    label: 'Downloaded speech model',
    privacyLine:
      'A model on this device turns your speech into text. Nothing is sent anywhere, and no recording is saved.',
    canStartProgrammatically: true,
    providesLiveTranscript: false,
    sendsAudioOffDevice: false,

    async isAvailable(language: string): Promise<TranscriptionAvailability> {
      const model = chosenModelForLanguage(language, preferredModelId);
      if (!model) {
        return {
          available: false,
          reason: 'language_unsupported',
          detail: `No on-device model covers ${language}. Your keyboard’s microphone may still handle it.`,
        };
      }
      if (!hasLocalRuntime()) {
        return {
          available: false,
          reason: 'module_missing',
          detail:
            'This build cannot run downloaded speech models. The keyboard microphone works instead.',
        };
      }
      if (!installed.has(model.id)) {
        return {
          available: false,
          reason: 'model_not_downloaded',
          detail: `${model.name} would cover ${language}, but it has not been downloaded.`,
        };
      }
      return { available: true, onDevice: true };
    },

    async start({ language }) {
      const model = chosenModelForLanguage(language, preferredModelId);
      if (!model) throw new Error('No on-device model covers that language.');

      const audio = loadAudio();
      if (!audio) throw new Error('This build cannot record for on-device models.');

      activeModel = model;
      samples = [];

      const live = audio.createPcmLiveStream({
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
      });
      stream = live;

      unsubscribe = [
        live.onData((chunk) => {
          if (samples.length >= SAMPLE_RATE * MAX_SESSION_SECONDS) return;
          // Copied into a plain array because `transcribeSamples` crosses the
          // bridge and a Float32Array does not survive the trip.
          for (let index = 0; index < chunk.length; index += 1) {
            samples.push(chunk[index]!);
          }
        }),
        live.onError(() => {
          void teardown();
        }),
      ];

      await live.start();

      // Nothing on disk, so nothing for the session to delete afterwards.
      return { audioUri: null };
    },

    async stop(): Promise<TranscriptionResult> {
      const model = activeModel;
      const captured = samples;
      const sherpa = loadSherpa();

      for (const off of unsubscribe) off();
      unsubscribe = [];
      try {
        await stream?.stop();
      } catch {
        // Already stopped.
      }
      stream = null;
      samples = [];
      activeModel = null;

      if (!model || !sherpa) throw new Error('The on-device model is not available.');
      if (captured.length === 0) {
        return { text: '', confidence: null, mode: 'local_model' };
      }

      const path = await installedModelPath(model.id);
      if (!path) throw new Error(`${model.name} is not installed.`);

      const engine = await sherpa.createSTT({
        modelPath: { type: 'file', path },
        // 'auto' rather than naming an architecture: see the SherpaModule
        // interface above for why this app does not guess that value.
        modelType: 'auto',
        // Harmless to supply unconditionally — the native side documents
        // that only the block matching the model actually loaded is read, so
        // this has no effect when Parakeet (a transducer) is what auto-detect
        // finds. `language: 'auto'` rather than the session's chosen tag
        // because a kitchen sweep is exactly where someone code-switches
        // mid-sentence, and forcing one language would drop the other half.
        modelOptions: { senseVoice: { language: 'auto', useItn: true } },
      });
      try {
        const result = await engine.transcribeSamples(captured, SAMPLE_RATE);
        return {
          text: result.text,
          // These recognisers report no per-utterance confidence. Null is the
          // honest answer; a fabricated 1.0 would make review trust it more
          // than the native path, which does report one.
          confidence: null,
          mode: 'local_model',
        };
      } finally {
        await engine.destroy();
      }
    },

    async cancel(): Promise<void> {
      await teardown();
    },
  };
}

export const localModelAdapter = createLocalModelAdapter();
