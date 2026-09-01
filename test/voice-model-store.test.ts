import Storage from 'expo-sqlite/kv-store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  __resetModelStoreForTesting,
  __setBackgroundDownloaderForTesting,
  __setModelDownloadModuleForTesting,
  cancelSpeechModelDownload,
  downloadSpeechModel,
  getKnownSpeechModelState,
  installedModelPath,
  pauseSpeechModelDownload,
  reconcileSpeechModels,
  refreshInstalledModels,
  removeAllSpeechModels,
  removeSpeechModel,
  resumeSpeechModelDownload,
} from '../src/media/speech/modelStore';
import {
  __setSttValidationRuntimeForTesting,
  validateSpeechModelRuntime,
} from '../src/media/speech/runtimeValidation';

const SENSE_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09.tar.bz2';
const PARAKEET_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2';

function registry(id: string, downloadUrl: string) {
  return { id, downloadUrl, bytes: 100 };
}

function createRuntime(options: { incompatible?: boolean; detectFailure?: boolean } = {}) {
  const engine = { destroy: vi.fn(async () => undefined) };
  return {
    engine,
    detectSttModel: vi.fn(async () => options.detectFailure ? {
      success: false,
      error: options.incompatible ? 'hardware unsupported' : 'missing encoder.onnx',
      detectedModels: [],
      isHardwareSpecificUnsupported: options.incompatible,
    } : {
      success: true,
      detectedModels: [{ type: 'transducer', modelDir: '/models/current' }],
      modelType: 'transducer',
    }),
    createSTT: vi.fn(async (_options: Record<string, unknown>) => engine),
  };
}

function createDownloads(options: {
  downloaded?: ReturnType<typeof registry>[];
  transfers?: { modelId: string; model: ReturnType<typeof registry>; bytesDownloaded?: number; totalBytes?: number }[];
  extractions?: { modelId: string; model: ReturnType<typeof registry> }[];
  paths?: Record<string, string | null>;
  refreshError?: boolean;
} = {}) {
  const module = {
    refreshModelsByCategory: vi.fn(async () => {
      if (options.refreshError) throw new Error('airplane mode');
      return [registry('sense-registry-id', SENSE_URL), registry('parakeet-registry-id', PARAKEET_URL)];
    }),
    listDownloadedModelsByCategory: vi.fn(async () => options.downloaded ?? []),
    getLocalModelPathByCategory: vi.fn(async (_category: string, id: string) =>
      options.paths?.[id] ?? null),
    deleteModelByCategory: vi.fn(async () => undefined),
    getIncompleteDownloads: vi.fn(async () => (options.transfers ?? []).map((item) => ({
      ...item, phase: 'downloading' as const,
    }))),
    getIncompleteExtractions: vi.fn(async () => (options.extractions ?? []).map((item) => ({
      ...item, phase: 'extracting' as const,
    }))),
    deleteIncompleteDownload: vi.fn(async () => undefined),
    deleteIncompleteExtraction: vi.fn(async () => undefined),
    configureModelDownloadBackgroundDownloader: vi.fn(() => undefined),
    ensureModelByCategory: vi.fn(async (
      _category: string,
      id: string,
      config?: { onProgress?: (progress: { percent: number; phase: 'downloading' | 'extracting' }) => void },
    ) => {
      config?.onProgress?.({ percent: 50, phase: 'downloading' });
      config?.onProgress?.({ percent: 100, phase: 'extracting' });
      return { modelId: id, localPath: `/models/${id}` };
    }),
  };
  return module;
}

beforeEach(() => {
  Storage.removeItemSync('mise.speech.model-state.v2');
  __resetModelStoreForTesting();
  __setBackgroundDownloaderForTesting({ getExistingDownloadTasks: vi.fn(async () => []) });
  __setSttValidationRuntimeForTesting(createRuntime());
});

afterEach(() => {
  __setModelDownloadModuleForTesting(undefined);
  __setBackgroundDownloaderForTesting(undefined);
  __setSttValidationRuntimeForTesting(undefined);
});

describe('local evidence is the installed-state authority', () => {
  test('a completed local manifest is discovered in airplane mode without refreshing the registry', async () => {
    const downloads = createDownloads({
      downloaded: [registry('sense-local-id', SENSE_URL)],
      paths: { 'sense-local-id': '/models/sense' },
      refreshError: true,
    });
    __setModelDownloadModuleForTesting(downloads as never);

    await expect(refreshInstalledModels()).resolves.toEqual(['sense-voice-small']);
    await expect(installedModelPath('sense-voice-small')).resolves.toBe('/models/sense');
    expect(downloads.refreshModelsByCategory).not.toHaveBeenCalled();
    expect(getKnownSpeechModelState('sense-voice-small')).toMatchObject({ status: 'ready' });
  });

  test('a legacy ready-marker directory is found without a manifest or registry', async () => {
    const downloads = createDownloads({
      paths: { 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8': '/models/legacy-parakeet' },
      refreshError: true,
    });
    __setModelDownloadModuleForTesting(downloads as never);
    await expect(refreshInstalledModels()).resolves.toEqual(['parakeet-tdt-0.6b-v3']);
    expect(downloads.refreshModelsByCategory).not.toHaveBeenCalled();
  });

  test('interrupted transfer and extraction reconcile to durable recovery states', async () => {
    const downloads = createDownloads({
      transfers: [{
        modelId: 'sense-transfer', model: registry('sense-transfer', SENSE_URL),
        bytesDownloaded: 40, totalBytes: 100,
      }],
      extractions: [{
        modelId: 'parakeet-extract', model: registry('parakeet-extract', PARAKEET_URL),
      }],
    });
    __setModelDownloadModuleForTesting(downloads as never);
    const states = await reconcileSpeechModels();
    expect(states['sense-voice-small']).toMatchObject({ status: 'downloading', percent: 40 });
    expect(states['parakeet-tdt-0.6b-v3']).toMatchObject({ status: 'extracting' });
  });
});

describe('download completion is followed by runtime proof', () => {
  test('fresh download reports downloading, extracting, validating, then Ready', async () => {
    const downloads = createDownloads();
    const runtime = createRuntime();
    __setModelDownloadModuleForTesting(downloads as never);
    __setSttValidationRuntimeForTesting(runtime);
    const progress: string[] = [];
    const result = await downloadSpeechModel('sense-voice-small', (value) => {
      progress.push(value.phase);
    });
    expect(progress).toEqual(['downloading', 'extracting', 'validating']);
    expect(result).toMatchObject({ status: 'ready', registryId: 'sense-registry-id' });
    expect(runtime.detectSttModel).toHaveBeenCalled();
    expect(runtime.createSTT).toHaveBeenCalledWith(expect.objectContaining({
      modelType: 'auto',
      modelOptions: { senseVoice: { language: 'auto', useItn: true } },
    }));
    expect(runtime.engine.destroy).toHaveBeenCalledOnce();
  });

  test('hardware incompatibility is never labelled Ready and survives restart', async () => {
    const downloads = createDownloads({
      downloaded: [registry('sense-local-id', SENSE_URL)],
      paths: { 'sense-local-id': '/models/sense' },
    });
    __setModelDownloadModuleForTesting(downloads as never);
    __setSttValidationRuntimeForTesting(createRuntime({ detectFailure: true, incompatible: true }));
    await reconcileSpeechModels();
    expect(getKnownSpeechModelState('sense-voice-small')).toMatchObject({ status: 'incompatible' });
    __resetModelStoreForTesting();
    // The local files are still present, so restart validates them again and
    // reaches the same truthful result rather than reverting to Download.
    await reconcileSpeechModels();
    expect(getKnownSpeechModelState('sense-voice-small')).toMatchObject({ status: 'incompatible' });
  });

  test('Parakeet initialization omits SenseVoice-only options', async () => {
    const runtime = createRuntime();
    __setSttValidationRuntimeForTesting(runtime);
    await validateSpeechModelRuntime('parakeet-tdt-0.6b-v3', '/models/parakeet');
    expect(runtime.createSTT.mock.calls[0]?.[0]).not.toHaveProperty('modelOptions');
  });
});

describe('background pause, resume, cancel, and removal', () => {
  test('Pause uses the persistent native task and Cancel removes partial state', async () => {
    const transfer = {
      modelId: 'sense-transfer', model: registry('sense-transfer', SENSE_URL),
      bytesDownloaded: 25, totalBytes: 100,
    };
    const downloads = createDownloads({ transfers: [transfer] });
    const task = {
      id: 'stt:sense-transfer', state: 'RUNNING', bytesDownloaded: 25, bytesTotal: 100,
      pause: vi.fn(async () => undefined), resume: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
    };
    __setModelDownloadModuleForTesting(downloads as never);
    __setBackgroundDownloaderForTesting({ getExistingDownloadTasks: vi.fn(async () => [task]) });
    await expect(pauseSpeechModelDownload('sense-voice-small')).resolves.toEqual({
      status: 'paused', percent: 25,
    });
    expect(task.pause).toHaveBeenCalled();
    await cancelSpeechModelDownload('sense-voice-small');
    expect(task.stop).toHaveBeenCalled();
    expect(downloads.deleteIncompleteDownload).toHaveBeenCalledWith('stt', 'sense-transfer');
    expect(getKnownSpeechModelState('sense-voice-small')).toEqual({ status: 'absent' });
  });

  test('Resume reattaches through ensureModel and removal deletes the real local id', async () => {
    const downloads = createDownloads({
      downloaded: [registry('sense-local-id', SENSE_URL)],
      paths: { 'sense-local-id': '/models/sense' },
    });
    __setModelDownloadModuleForTesting(downloads as never);
    await resumeSpeechModelDownload('sense-voice-small');
    expect(downloads.ensureModelByCategory).toHaveBeenCalled();
    await removeSpeechModel('sense-voice-small');
    expect(downloads.deleteModelByCategory).toHaveBeenCalledWith('stt', 'sense-local-id');
  });

  test('Delete all stops persistent tasks and removes complete and partial files', async () => {
    const downloads = createDownloads({
      downloaded: [registry('sense-local-id', SENSE_URL)],
      transfers: [{
        modelId: 'sense-transfer', model: registry('sense-transfer', SENSE_URL),
        bytesDownloaded: 25, totalBytes: 100,
      }],
      extractions: [{
        modelId: 'parakeet-extract', model: registry('parakeet-extract', PARAKEET_URL),
      }],
    });
    const task = {
      id: 'stt:sense-transfer', state: 'RUNNING', bytesDownloaded: 25, bytesTotal: 100,
      pause: vi.fn(async () => undefined), resume: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
    };
    __setModelDownloadModuleForTesting(downloads as never);
    __setBackgroundDownloaderForTesting({ getExistingDownloadTasks: vi.fn(async () => [task]) });
    await removeAllSpeechModels();
    expect(task.stop).toHaveBeenCalledOnce();
    expect(downloads.deleteModelByCategory).toHaveBeenCalledWith('stt', 'sense-local-id');
    expect(downloads.deleteIncompleteDownload).toHaveBeenCalledWith('stt', 'sense-transfer');
    expect(downloads.deleteIncompleteExtraction).toHaveBeenCalledWith('stt', 'parakeet-extract');
  });
});
