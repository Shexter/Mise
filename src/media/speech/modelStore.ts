import Storage from 'expo-sqlite/kv-store';

import {
  recordSpeechDiagnostic,
  type ModelReadiness,
  type ProvenSpeechMode,
} from '@/media/speech/diagnostics';
import { SPEECH_MODELS, modelById, type SpeechModel } from '@/media/speech/models';
import { validateSpeechModelRuntime } from '@/media/speech/runtimeValidation';

const STATE_STORAGE_KEY = 'mise.speech.model-state.v2';

export interface DownloadProgress {
  percent: number;
  phase: 'downloading' | 'extracting' | 'validating';
}

export type ModelInstallState =
  | { status: 'absent' }
  | { status: 'downloading'; percent: number; phase: 'downloading' }
  | { status: 'paused'; percent: number }
  | { status: 'extracting'; percent: number }
  | { status: 'validating'; path: string }
  | { status: 'ready'; path: string; registryId: string }
  | { status: 'repair'; message: string }
  | { status: 'incompatible'; message: string }
  | { status: 'failed'; message: string };

type Category = 'stt';

interface RegistryModel {
  id: string;
  displayName?: string;
  downloadUrl: string;
  archiveExt?: 'tar.bz2' | 'onnx';
  bytes: number;
}

interface OperationState {
  modelId: string;
  phase: 'downloading' | 'extracting';
  bytesDownloaded?: number;
  totalBytes?: number;
  model: RegistryModel;
}

interface DownloadModule {
  refreshModelsByCategory(
    category: Category,
    options?: { forceRefresh?: boolean },
  ): Promise<RegistryModel[]>;
  listDownloadedModelsByCategory(category: Category): Promise<RegistryModel[]>;
  getLocalModelPathByCategory(category: Category, id: string): Promise<string | null>;
  deleteModelByCategory(category: Category, id: string): Promise<void>;
  getIncompleteDownloads(category: Category): Promise<OperationState[]>;
  getIncompleteExtractions(category: Category): Promise<OperationState[]>;
  deleteIncompleteDownload(category: Category, id: string): Promise<void>;
  deleteIncompleteExtraction(category: Category, id: string): Promise<void>;
  configureModelDownloadBackgroundDownloader(options: Record<string, unknown>): void;
  ensureModelByCategory(
    category: Category,
    id: string,
    options?: {
      onProgress?: (progress: {
        percent: number;
        phase?: 'downloading' | 'extracting';
      }) => void;
      signal?: AbortSignal;
      deleteArchiveAfterExtract?: boolean;
      overwrite?: boolean;
    },
  ): Promise<{ modelId: string; localPath: string }>;
}

interface BackgroundTask {
  id: string;
  state: string;
  bytesDownloaded: number;
  bytesTotal: number;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
}

interface BackgroundDownloader {
  getExistingDownloadTasks(): Promise<BackgroundTask[]>;
}

let downloadsOverrideForTesting: DownloadModule | null | undefined;
let backgroundOverrideForTesting: BackgroundDownloader | null | undefined;

export function __setModelDownloadModuleForTesting(
  module: DownloadModule | null | undefined,
): void {
  downloadsOverrideForTesting = module;
}

export function __setBackgroundDownloaderForTesting(
  module: BackgroundDownloader | null | undefined,
): void {
  backgroundOverrideForTesting = module;
}

export function __resetModelStoreForTesting(): void {
  states.clear();
  bindings.clear();
  installedIds.clear();
  activeControllers.clear();
  activeOperations.clear();
  downloaderConfigured = false;
  try { Storage.removeItemSync(STATE_STORAGE_KEY); } catch {}
}

function loadDownloads(): DownloadModule | null {
  if (downloadsOverrideForTesting !== undefined) return downloadsOverrideForTesting;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('react-native-sherpa-onnx/download') as DownloadModule;
  } catch {
    return null;
  }
}

function loadBackgroundDownloader(): BackgroundDownloader | null {
  if (backgroundOverrideForTesting !== undefined) return backgroundOverrideForTesting;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('@kesha-antonov/react-native-background-downloader') as BackgroundDownloader;
  } catch {
    return null;
  }
}

export function hasModelDownloader(): boolean {
  return loadDownloads() !== null;
}

let downloaderConfigured = false;

export function configureSpeechModelDownloads(): void {
  if (downloaderConfigured) return;
  const downloads = loadDownloads();
  if (!downloads) return;
  downloads.configureModelDownloadBackgroundDownloader({
    showNotificationsEnabled: true,
    showCompletionNotification: true,
    showCancelAction: true,
    notificationsGrouping: {
      enabled: false,
      mode: 'individual',
      texts: {
        downloadTitle: 'Mise speech model',
        downloadStarting: 'Starting speech model download…',
        downloadProgress: 'Downloading speech model… {progress}%',
      },
    },
  });
  downloaderConfigured = true;
}

const states = new Map<string, ModelInstallState>();
const bindings = new Map<string, { registryId: string; path: string }>();
const activeControllers = new Map<string, AbortController>();
const activeOperations = new Map<string, Promise<ModelInstallState>>();

const installedIds = new Set<string>();
export const installedModels = {
  has: (modelId: string): boolean => installedIds.has(modelId),
};

function diagnosticMode(modelId: string): ProvenSpeechMode {
  return modelId === 'parakeet-tdt-0.6b-v3' ? 'parakeet' : 'sensevoice';
}

function readinessFor(state: ModelInstallState): ModelReadiness {
  switch (state.status) {
    case 'failed': return 'repair';
    default: return state.status;
  }
}

function setState(modelId: string, state: ModelInstallState): ModelInstallState {
  states.set(modelId, state);
  if (state.status === 'ready') installedIds.add(modelId);
  else installedIds.delete(modelId);
  if (['paused', 'repair', 'incompatible', 'failed'].includes(state.status)) {
    persistDurableState(modelId, state);
  } else if (['ready', 'absent'].includes(state.status)) {
    removeDurableState(modelId);
  }
  return state;
}

export function getKnownSpeechModelState(modelId: string): ModelInstallState {
  return states.get(modelId) ?? readDurableState(modelId) ?? { status: 'absent' };
}

/** Local manifests, ready markers/paths, and interrupted-operation files only. */
export async function reconcileSpeechModels(): Promise<Record<string, ModelInstallState>> {
  const downloads = loadDownloads();
  if (!downloads) {
    installedIds.clear();
    for (const model of SPEECH_MODELS) setState(model.id, { status: 'absent' });
    return Object.fromEntries(states);
  }
  configureSpeechModelDownloads();
  const [downloaded, incompleteDownloads, incompleteExtractions, backgroundTasks] =
    await Promise.all([
      downloads.listDownloadedModelsByCategory('stt').catch(() => []),
      downloads.getIncompleteDownloads('stt').catch(() => []),
      downloads.getIncompleteExtractions('stt').catch(() => []),
      loadBackgroundDownloader()?.getExistingDownloadTasks().catch(() => []) ?? [],
    ]);

  for (const model of SPEECH_MODELS) {
    await reconcileOne(
      downloads, model, downloaded, incompleteDownloads, incompleteExtractions, backgroundTasks,
    );
  }
  return Object.fromEntries(SPEECH_MODELS.map((model) => [
    model.id, getKnownSpeechModelState(model.id),
  ]));
}

async function reconcileOne(
  downloads: DownloadModule,
  model: SpeechModel,
  downloaded: RegistryModel[],
  incompleteDownloads: OperationState[],
  incompleteExtractions: OperationState[],
  backgroundTasks: BackgroundTask[],
): Promise<ModelInstallState> {
  const complete = downloaded.find((entry) => matchesAppModel(model, entry));
  const legacyIds = [complete?.id, model.directoryName].filter(
    (id, index, all): id is string => Boolean(id) && all.indexOf(id) === index,
  );
  for (const registryId of legacyIds) {
    const path = await downloads.getLocalModelPathByCategory('stt', registryId).catch(() => null);
    if (!path) continue;
    bindings.set(model.id, { registryId, path });
    return validateReadyModel(model, registryId, path);
  }

  bindings.delete(model.id);
  const extraction = incompleteExtractions.find((entry) => matchesAppModel(model, entry.model));
  if (extraction) return setState(model.id, { status: 'extracting', percent: 0 });
  const transfer = incompleteDownloads.find((entry) => matchesAppModel(model, entry.model));
  if (transfer) {
    const task = backgroundTasks.find((entry) => entry.id === `stt:${transfer.modelId}`);
    const total = task?.bytesTotal || transfer.totalBytes || model.sizeMb * 1024 * 1024;
    const completeBytes = task?.bytesDownloaded ?? transfer.bytesDownloaded ?? 0;
    const percent = total > 0 ? Math.round((completeBytes / total) * 100) : 0;
    const paused = task?.state.toLowerCase().includes('paused') ||
      readDurableState(model.id)?.status === 'paused';
    return setState(model.id, paused
      ? { status: 'paused', percent }
      : { status: 'downloading', phase: 'downloading', percent });
  }
  const durable = readDurableState(model.id);
  return setState(model.id, durable ?? { status: 'absent' });
}

async function validateReadyModel(
  model: SpeechModel,
  registryId: string,
  path: string,
): Promise<ModelInstallState> {
  setState(model.id, { status: 'validating', path });
  recordSpeechDiagnostic({
    boundary: 'model_validation', outcome: 'started', mode: diagnosticMode(model.id),
    modelId: registryId, modelReadiness: 'validating',
  });
  const validation = await validateSpeechModelRuntime(model.id, path);
  if (validation.status === 'ready') {
    const ready = setState(model.id, { status: 'ready', path, registryId });
    recordSpeechDiagnostic({
      boundary: 'model_validation', outcome: 'succeeded', mode: diagnosticMode(model.id),
      modelId: registryId, modelReadiness: 'ready',
    });
    return ready;
  }
  const failure = setState(model.id, validation);
  recordSpeechDiagnostic({
    boundary: 'model_validation', outcome: 'failed', mode: diagnosticMode(model.id),
    modelId: registryId, modelReadiness: readinessFor(failure),
    nativeErrorCode: validation.message,
  });
  return failure;
}

export async function refreshInstalledModels(): Promise<string[]> {
  await reconcileSpeechModels();
  return [...installedIds];
}

export async function isModelInstalled(modelId: string): Promise<boolean> {
  const model = modelById(modelId);
  if (!model) return false;
  await reconcileSpeechModels();
  return getKnownSpeechModelState(modelId).status === 'ready';
}

export async function installedModelPath(modelId: string): Promise<string | null> {
  if (!bindings.has(modelId)) await reconcileSpeechModels();
  return getKnownSpeechModelState(modelId).status === 'ready'
    ? bindings.get(modelId)?.path ?? null
    : null;
}

async function registryIdForNewDownload(model: SpeechModel): Promise<string | null> {
  const downloads = loadDownloads();
  if (!downloads) return null;
  const find = (available: RegistryModel[]) =>
    available.find((entry) => entry.downloadUrl === model.url)?.id ??
    available.find((entry) => entry.id === model.directoryName)?.id ?? null;
  try {
    const cached = await downloads.refreshModelsByCategory('stt');
    return find(cached) ?? find(await downloads.refreshModelsByCategory('stt', { forceRefresh: true }));
  } catch {
    return null;
  }
}

export function downloadSpeechModel(
  modelId: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  overwrite = false,
): Promise<ModelInstallState> {
  const existing = activeOperations.get(modelId);
  if (existing) return existing;
  const operation = runSpeechModelDownload(modelId, onProgress, signal, overwrite);
  activeOperations.set(modelId, operation);
  void operation.finally(() => {
    if (activeOperations.get(modelId) === operation) activeOperations.delete(modelId);
  });
  return operation;
}

async function runSpeechModelDownload(
  modelId: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
  overwrite = false,
): Promise<ModelInstallState> {
  const model = modelById(modelId);
  const downloads = loadDownloads();
  if (!model) return { status: 'failed', message: 'Unknown speech model.' };
  if (!downloads) {
    return setState(modelId, {
      status: 'failed', message: 'This build cannot download speech models.',
    });
  }
  configureSpeechModelDownloads();
  const registryId = await registryIdForNewDownload(model);
  if (!registryId) {
    return setState(modelId, {
      status: 'failed', message: `${model.name} is not offered for download right now.`,
    });
  }

  const controller = new AbortController();
  activeControllers.set(modelId, controller);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  setState(modelId, { status: 'downloading', percent: 0, phase: 'downloading' });
  recordSpeechDiagnostic({
    boundary: 'model_download', outcome: 'started', mode: diagnosticMode(modelId),
    modelId: registryId, modelReadiness: 'downloading',
  });
  try {
    const result = await downloads.ensureModelByCategory('stt', registryId, {
      onProgress: (progress) => {
        const percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
        const phase = progress.phase ?? 'downloading';
        setState(modelId, phase === 'extracting'
          ? { status: 'extracting', percent }
          : { status: 'downloading', phase: 'downloading', percent });
        onProgress?.({ percent, phase });
      },
      signal: controller.signal,
      deleteArchiveAfterExtract: true,
      overwrite,
    });
    bindings.set(modelId, { registryId: result.modelId, path: result.localPath });
    setState(modelId, { status: 'validating', path: result.localPath });
    onProgress?.({ percent: 100, phase: 'validating' });
    return await validateReadyModel(model, result.modelId, result.localPath);
  } catch (error) {
    if (controller.signal.aborted) {
      const previous = getKnownSpeechModelState(modelId);
      const percent = 'percent' in previous ? previous.percent : 0;
      recordSpeechDiagnostic({
        boundary: 'model_download', outcome: 'cancelled', mode: diagnosticMode(modelId),
        modelId: registryId, modelReadiness: 'paused',
      });
      return setState(modelId, { status: 'paused', percent });
    }
    const message = error instanceof Error ? error.message : 'The model download failed.';
    recordSpeechDiagnostic({
      boundary: 'model_download', outcome: 'failed', mode: diagnosticMode(modelId),
      modelId: registryId, modelReadiness: 'repair', nativeErrorCode: message,
    });
    return setState(modelId, { status: 'repair', message });
  } finally {
    signal?.removeEventListener('abort', abortFromCaller);
    activeControllers.delete(modelId);
  }
}

export async function pauseSpeechModelDownload(modelId: string): Promise<ModelInstallState> {
  const task = await findBackgroundTask(modelId);
  if (task) await task.pause();
  const previous = getKnownSpeechModelState(modelId);
  const percent = task && task.bytesTotal > 0
    ? Math.round((task.bytesDownloaded / task.bytesTotal) * 100)
    : 'percent' in previous ? previous.percent : 0;
  return setState(modelId, { status: 'paused', percent });
}

export async function resumeSpeechModelDownload(
  modelId: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<ModelInstallState> {
  // `ensureModelByCategory` reattaches to the native background task or its
  // incomplete extraction record, so Resume is resumable across a JS restart.
  const task = await findBackgroundTask(modelId);
  if (task) await task.resume();
  const active = activeOperations.get(modelId);
  if (active) return active;
  return downloadSpeechModel(modelId, onProgress);
}

export async function cancelSpeechModelDownload(modelId: string): Promise<void> {
  activeControllers.get(modelId)?.abort();
  const task = await findBackgroundTask(modelId);
  if (task) await task.stop().catch(() => undefined);
  const active = activeOperations.get(modelId);
  if (active) await settleWithin(active, 1_500);
  const downloads = loadDownloads();
  const registryId = await localOperationRegistryId(modelId);
  if (downloads && registryId) {
    await downloads.deleteIncompleteDownload('stt', registryId).catch(() => undefined);
    await downloads.deleteIncompleteExtraction('stt', registryId).catch(() => undefined);
  }
  setState(modelId, { status: 'absent' });
}

export async function repairSpeechModel(
  modelId: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<ModelInstallState> {
  return downloadSpeechModel(modelId, onProgress, undefined, true);
}

export async function removeSpeechModel(modelId: string): Promise<void> {
  const model = modelById(modelId);
  const downloads = loadDownloads();
  if (!model || !downloads) {
    setState(modelId, { status: 'absent' });
    return;
  }
  await cancelSpeechModelDownload(modelId);
  const local = await downloads.listDownloadedModelsByCategory('stt').catch(() => []);
  const ids = [
    ...local.filter((entry) => matchesAppModel(model, entry)).map((entry) => entry.id),
    model.directoryName,
  ];
  for (const id of new Set(ids)) {
    await downloads.deleteModelByCategory('stt', id).catch(() => undefined);
  }
  bindings.delete(modelId);
  setState(modelId, { status: 'absent' });
}

export async function removeAllSpeechModels(): Promise<void> {
  const downloads = loadDownloads();
  activeControllers.forEach((controller) => controller.abort());
  const background = loadBackgroundDownloader();
  if (background) {
    const tasks = await background.getExistingDownloadTasks().catch(() => []);
    for (const task of tasks.filter((entry) => entry.id.startsWith('stt:'))) {
      await task.stop().catch(() => undefined);
    }
  }
  const operations = [...activeOperations.values()];
  await Promise.all(operations.map((operation) => settleWithin(operation, 1_500)));
  if (downloads) {
    const [downloaded, transfers, extractions] = await Promise.all([
      downloads.listDownloadedModelsByCategory('stt').catch(() => []),
      downloads.getIncompleteDownloads('stt').catch(() => []),
      downloads.getIncompleteExtractions('stt').catch(() => []),
    ]);
    for (const entry of downloaded) {
      await downloads.deleteModelByCategory('stt', entry.id).catch(() => undefined);
    }
    for (const entry of transfers) {
      await downloads.deleteIncompleteDownload('stt', entry.modelId).catch(() => undefined);
    }
    for (const entry of extractions) {
      await downloads.deleteIncompleteExtraction('stt', entry.modelId).catch(() => undefined);
    }
    for (const model of SPEECH_MODELS) {
      await downloads.deleteModelByCategory('stt', model.directoryName).catch(() => undefined);
    }
  }
  bindings.clear();
  installedIds.clear();
  states.clear();
  activeControllers.clear();
  activeOperations.clear();
  try { Storage.removeItemSync(STATE_STORAGE_KEY); } catch {}
}

async function settleWithin(operation: Promise<unknown>, timeoutMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await new Promise<void>((resolve) => {
    timeout = setTimeout(resolve, timeoutMs);
    void operation.then(() => resolve(), () => resolve());
  });
  if (timeout) clearTimeout(timeout);
}

async function findBackgroundTask(modelId: string): Promise<BackgroundTask | null> {
  const background = loadBackgroundDownloader();
  if (!background) return null;
  const registryId = await localOperationRegistryId(modelId);
  if (!registryId) return null;
  const tasks = await background.getExistingDownloadTasks().catch(() => []);
  return tasks.find((task) => task.id === `stt:${registryId}`) ?? null;
}

async function localOperationRegistryId(modelId: string): Promise<string | null> {
  const model = modelById(modelId);
  const downloads = loadDownloads();
  if (!model || !downloads) return null;
  const [downloaded, transfers, extractions] = await Promise.all([
    downloads.listDownloadedModelsByCategory('stt').catch(() => []),
    downloads.getIncompleteDownloads('stt').catch(() => []),
    downloads.getIncompleteExtractions('stt').catch(() => []),
  ]);
  return downloaded.find((entry) => matchesAppModel(model, entry))?.id ??
    transfers.find((entry) => matchesAppModel(model, entry.model))?.modelId ??
    extractions.find((entry) => matchesAppModel(model, entry.model))?.modelId ??
    null;
}

function matchesAppModel(model: SpeechModel, entry: RegistryModel): boolean {
  return entry.downloadUrl === model.url || entry.id === model.directoryName;
}

type DurableState = Extract<ModelInstallState,
  { status: 'paused' | 'repair' | 'incompatible' | 'failed' }>;

function readDurableStates(): Record<string, DurableState> {
  try {
    const value: unknown = JSON.parse(Storage.getItemSync(STATE_STORAGE_KEY) ?? '{}');
    return value && typeof value === 'object' ? value as Record<string, DurableState> : {};
  } catch {
    return {};
  }
}

function readDurableState(modelId: string): DurableState | null {
  const state = readDurableStates()[modelId];
  if (!state || !['paused', 'repair', 'incompatible', 'failed'].includes(state.status)) return null;
  return state;
}

function persistDurableState(modelId: string, state: ModelInstallState): void {
  if (!['paused', 'repair', 'incompatible', 'failed'].includes(state.status)) return;
  try {
    Storage.setItemSync(STATE_STORAGE_KEY, JSON.stringify({
      ...readDurableStates(), [modelId]: state,
    }));
  } catch {}
}

function removeDurableState(modelId: string): void {
  try {
    const values = readDurableStates();
    delete values[modelId];
    if (Object.keys(values).length === 0) Storage.removeItemSync(STATE_STORAGE_KEY);
    else Storage.setItemSync(STATE_STORAGE_KEY, JSON.stringify(values));
  } catch {}
}
