import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `installedModelPath` makes its own independent native probe
// (`modelStore.ts`'s own `require('react-native-sherpa-onnx/download')`),
// separate from this adapter's `loadSherpa`/`loadAudio`. Resolved through the
// `@/` alias for an internal module, `vi.mock` intercepts it reliably — unlike
// the runtime `require()` of an installed native package, which is why
// `native.ts` and this file's own adapter use an explicit override seam
// instead.
vi.mock('@/media/speech/modelStore', () => ({
  installedModelPath: vi.fn(async () => '/fake/models/downloaded-model'),
}));

import {
  __setAudioModuleForTesting,
  __setSherpaModuleForTesting,
  createLocalModelAdapter,
} from '../src/media/speech/adapters/localModel';

/**
 * Regression coverage for `createSTT`'s real option shape, found only by
 * reading `react-native-sherpa-onnx`'s own `.d.ts` after a sibling adapter's
 * hand-guessed API shape turned out wrong on a real device (`native.ts`,
 * `addSpeechRecognitionListener`).
 *
 * This file's own first draft had the same class of mistake, twice:
 * `modelType: 'sensevoice'` where the real `STTModelType` union spells it
 * `'sense_voice'`, and `modelOptions: { sensevoice: { useInverseTextNormalization } }`
 * where the real field is `{ senseVoice: { useItn } }`. Both would have
 * silently misconfigured decoding rather than throwing, so a test asserting
 * only "it calls createSTT" would have passed while shipping the wrong config.
 * These tests pin the literal field names and values instead.
 */

function createFakePcmStream() {
  const dataHandlers: ((samples: Float32Array, sampleRate: number) => void)[] = [];
  const errorHandlers: ((message: string) => void)[] = [];
  return {
    stream: {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      onData: vi.fn((cb: (samples: Float32Array, sampleRate: number) => void) => {
        dataHandlers.push(cb);
        return () => {
          const index = dataHandlers.indexOf(cb);
          if (index >= 0) dataHandlers.splice(index, 1);
        };
      }),
      onError: vi.fn((cb: (message: string) => void) => {
        errorHandlers.push(cb);
        return () => {
          const index = errorHandlers.indexOf(cb);
          if (index >= 0) errorHandlers.splice(index, 1);
        };
      }),
    },
    emitData: (samples: Float32Array) => {
      for (const handler of dataHandlers) handler(samples, 16_000);
    },
  };
}

function createFakeAudio(pcm: ReturnType<typeof createFakePcmStream>) {
  return { createPcmLiveStream: vi.fn(() => pcm.stream) };
}

interface CreateSTTOptions {
  modelPath: { type: 'file'; path: string };
  modelType?: 'auto';
  modelOptions?: { senseVoice?: { language?: string; useItn?: boolean } };
}

function createFakeSherpa(transcript = 'six eggs') {
  const engine = {
    transcribeSamples: vi.fn(async () => ({ text: transcript, tokens: [], lang: 'en' })),
    destroy: vi.fn(async () => undefined),
  };
  const createSTT = vi.fn(async (_options: CreateSTTOptions) => engine);
  return { createSTT, engine };
}

afterEach(() => {
  __setSherpaModuleForTesting(undefined);
  __setAudioModuleForTesting(undefined);
});

describe('createSTT is called with the real option shape', () => {
  let pcm: ReturnType<typeof createFakePcmStream>;
  let sherpa: ReturnType<typeof createFakeSherpa>;

  beforeEach(() => {
    pcm = createFakePcmStream();
    sherpa = createFakeSherpa();
    __setAudioModuleForTesting(createFakeAudio(pcm));
    __setSherpaModuleForTesting(sherpa);
  });

  test('modelType is auto, not a guessed architecture name', async () => {
    const adapter = createLocalModelAdapter({ has: () => true });
    await adapter.start({ language: 'yue-HK', onPartial: () => {} });
    pcm.emitData(new Float32Array([0.1, 0.2]));
    await adapter.stop();

    const call = sherpa.createSTT.mock.calls[0]![0];
    // Real STTModelType has no 'sensevoice' or 'transducer'-always answer this
    // app can give from the outside — 'auto' is the one value guaranteed not
    // to silently misconfigure decoding for either registered model.
    expect(call.modelType).toBe('auto');
  });

  test('the SenseVoice option block uses the real key and field name', async () => {
    const adapter = createLocalModelAdapter({ has: () => true });
    await adapter.start({ language: 'yue-HK', onPartial: () => {} });
    pcm.emitData(new Float32Array([0.1]));
    await adapter.stop();

    const call = sherpa.createSTT.mock.calls[0]![0];
    // Real shape: `SttModelOptions.senseVoice` (camelCase V) with `useItn`.
    // Not `sensevoice` and not `useInverseTextNormalization` — both wrong in
    // the first draft of this adapter, and both would have been silently
    // ignored by the native side rather than raising an error.
    expect(call.modelOptions).toEqual({
      senseVoice: { language: 'auto', useItn: true },
    });
  });

  test('the model path points at a directory, not a specific model file', async () => {
    const adapter = createLocalModelAdapter({ has: () => true });
    await adapter.start({ language: 'de-DE', onPartial: () => {} });
    pcm.emitData(new Float32Array([0.1]));
    await adapter.stop();

    const call = sherpa.createSTT.mock.calls[0]![0];
    expect(call.modelPath.type).toBe('file');
    expect(typeof call.modelPath.path).toBe('string');
  });

  test('the transcribed text reaches the caller as the resolved result', async () => {
    sherpa = createFakeSherpa('half a broccoli');
    __setSherpaModuleForTesting(sherpa);
    const adapter = createLocalModelAdapter({ has: () => true });

    await adapter.start({ language: 'de-DE', onPartial: () => {} });
    pcm.emitData(new Float32Array([0.1, 0.2, 0.3]));
    const result = await adapter.stop();

    expect(result).toEqual({
      text: 'half a broccoli',
      confidence: null,
      mode: 'local_model',
    });
  });

  test('the engine is destroyed after every transcription', async () => {
    const adapter = createLocalModelAdapter({ has: () => true });
    await adapter.start({ language: 'de-DE', onPartial: () => {} });
    pcm.emitData(new Float32Array([0.1]));
    await adapter.stop();

    expect(sherpa.engine.destroy).toHaveBeenCalledTimes(1);
  });
});

describe('recording with no captured audio never calls the model', () => {
  test('stopping immediately resolves empty without touching createSTT', async () => {
    const pcm = createFakePcmStream();
    const sherpa = createFakeSherpa();
    __setAudioModuleForTesting(createFakeAudio(pcm));
    __setSherpaModuleForTesting(sherpa);

    const adapter = createLocalModelAdapter({ has: () => true });
    await adapter.start({ language: 'de-DE', onPartial: () => {} });
    const result = await adapter.stop();

    expect(result).toEqual({ text: '', confidence: null, mode: 'local_model' });
    expect(sherpa.createSTT).not.toHaveBeenCalled();
  });
});

describe('no audio file is ever written', () => {
  test('start() reports no audioUri on this path', async () => {
    const pcm = createFakePcmStream();
    __setAudioModuleForTesting(createFakeAudio(pcm));
    __setSherpaModuleForTesting(createFakeSherpa());

    const adapter = createLocalModelAdapter({ has: () => true });
    const { audioUri } = await adapter.start({ language: 'de-DE', onPartial: () => {} });

    expect(audioUri).toBeNull();
  });
});
