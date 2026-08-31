import { SPEECH_MODELS, modelById, type SpeechModel } from '@/media/speech/models';

/**
 * Downloading, tracking, and removing on-device speech models.
 *
 * The bytes are handled by `react-native-sherpa-onnx/download`, which already
 * solves the parts that are tedious and easy to get wrong: resumable
 * downloads, `.tar.bz2` extraction, checksum validation, disk-space checks, and
 * recovering a download that died halfway. Reimplementing that against raw
 * `fetch` would be several hundred lines of worse.
 *
 * What this module keeps for itself is the part that is Mise's business:
 * **which** model is right for a language and **why** it is being offered.
 * `models.ts` is the source of truth for that, and the ids here are resolved
 * against the library's own registry by download URL — an exact match on the
 * release asset, so a renamed id upstream is a clean failure rather than a
 * silently wrong model.
 *
 * Every function is a probe-and-degrade. In the Node test environment, in Expo
 * Go, and in any build without the native side, the module resolves to null and
 * the callers report the model as unavailable rather than throwing.
 */

export interface DownloadProgress {
  /** 0–100. */
  percent: number;
  /** What the bar is currently doing — the unpack is not instant at 487 MB. */
  phase: 'downloading' | 'extracting';
}

export type ModelInstallState =
  | { status: 'absent' }
  | { status: 'downloading'; percent: number; phase: DownloadProgress['phase'] }
  | { status: 'installed'; path: string }
  | { status: 'failed'; message: string };

/* -------------------------------------------------------------------------- */
/* The native side, probed rather than imported                                */
/* -------------------------------------------------------------------------- */

type Category = 'stt';

interface RegistryModel {
  id: string;
  downloadUrl: string;
  bytes: number;
}

interface DownloadModule {
  listModelsByCategory(category: Category): Promise<RegistryModel[]>;
  isModelDownloadedByCategory(category: Category, id: string): Promise<boolean>;
  getLocalModelPathByCategory(category: Category, id: string): Promise<string | null>;
  deleteModelByCategory(category: Category, id: string): Promise<void>;
  ensureModelByCategory(
    category: Category,
    id: string,
    options?: {
      onProgress?: (progress: { percent: number; phase?: 'downloading' | 'extracting' }) => void;
      signal?: AbortSignal;
      deleteArchiveAfterExtract?: boolean;
    },
  ): Promise<{ modelId: string; localPath: string }>;
}

function loadDownloads(): DownloadModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('react-native-sherpa-onnx/download') as DownloadModule;
  } catch {
    return null;
  }
}

export function hasModelDownloader(): boolean {
  return loadDownloads() !== null;
}

/**
 * Finds the library registry's id for one of our models.
 *
 * Matched on the release asset URL rather than on a name. The registry is
 * fetched from upstream and its ids are not ours to assume; matching the exact
 * artefact means a rename upstream produces "not available" instead of
 * downloading a model with a similar name and a different language list.
 */
async function registryIdFor(model: SpeechModel): Promise<string | null> {
  const downloads = loadDownloads();
  if (!downloads) return null;
  try {
    const available = await downloads.listModelsByCategory('stt');
    const exact = available.find((entry) => entry.downloadUrl === model.url);
    if (exact) return exact.id;
    // Second chance on the archive stem, which is how these ids are usually
    // formed. Still an exact string, never a fuzzy match.
    return available.find((entry) => entry.id === model.directoryName)?.id ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Installed state                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A synchronous view of what is installed, refreshed by `refreshInstalled`.
 *
 * Synchronous because the routing ladder asks "is this available" while
 * deciding what to render, and an await there would flicker the whole surface
 * on every language change. The async check below is the authority; this is its
 * last known answer, and it starts empty, so the first render under-promises
 * rather than over-promising.
 */
const installedIds = new Set<string>();

export async function refreshInstalledModels(): Promise<string[]> {
  const downloads = loadDownloads();
  if (!downloads) {
    installedIds.clear();
    return [];
  }
  const present: string[] = [];
  for (const model of SPEECH_MODELS) {
    if (await isModelInstalled(model.id)) present.push(model.id);
  }
  installedIds.clear();
  for (const id of present) installedIds.add(id);
  return present;
}

export async function isModelInstalled(modelId: string): Promise<boolean> {
  const model = modelById(modelId);
  const downloads = loadDownloads();
  if (!model || !downloads) return false;
  try {
    const registryId = await registryIdFor(model);
    if (!registryId) return false;
    return await downloads.isModelDownloadedByCategory('stt', registryId);
  } catch {
    return false;
  }
}

export async function installedModelPath(modelId: string): Promise<string | null> {
  const model = modelById(modelId);
  const downloads = loadDownloads();
  if (!model || !downloads) return null;
  try {
    const registryId = await registryIdFor(model);
    if (!registryId) return null;
    return await downloads.getLocalModelPathByCategory('stt', registryId);
  } catch {
    return null;
  }
}

/** The `InstalledModels` shape the local-model adapter takes. */
export const installedModels = {
  has: (modelId: string): boolean => installedIds.has(modelId),
};

/* -------------------------------------------------------------------------- */
/* Downloading                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fetches and unpacks one model.
 *
 * `ensureModelByCategory` is idempotent and resumable by design — calling it on
 * a model that is already there returns the path, and calling it after an
 * interrupted download resumes rather than restarting. That matters at 487 MB:
 * a sweep interrupted by a phone call must not cost the user the whole download
 * a second time.
 *
 * The archive is deleted after extraction. Keeping it would roughly double the
 * disk cost of a feature that is already the largest thing in the app.
 */
export async function downloadSpeechModel(
  modelId: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<ModelInstallState> {
  const model = modelById(modelId);
  if (!model) return { status: 'failed', message: 'Unknown speech model.' };

  const downloads = loadDownloads();
  if (!downloads) {
    return {
      status: 'failed',
      message:
        'This build cannot download speech models. Your keyboard’s microphone works instead.',
    };
  }

  const registryId = await registryIdFor(model);
  if (!registryId) {
    return {
      status: 'failed',
      message: `${model.name} is not offered for download right now. Your keyboard’s microphone works instead.`,
    };
  }

  try {
    const result = await downloads.ensureModelByCategory('stt', registryId, {
      onProgress: (progress) =>
        onProgress?.({
          percent: Math.round(progress.percent),
          phase: progress.phase ?? 'downloading',
        }),
      signal,
      deleteArchiveAfterExtract: true,
    });
    installedIds.add(modelId);
    return { status: 'installed', path: result.localPath };
  } catch (error) {
    return {
      status: 'failed',
      message:
        error instanceof Error && error.message.length > 0
          ? error.message
          : 'The download did not finish. Nothing was installed.',
    };
  }
}

/** Deletes one model and everything it unpacked. */
export async function removeSpeechModel(modelId: string): Promise<void> {
  const model = modelById(modelId);
  const downloads = loadDownloads();
  installedIds.delete(modelId);
  if (!model || !downloads) return;
  try {
    const registryId = await registryIdFor(model);
    if (registryId) await downloads.deleteModelByCategory('stt', registryId);
  } catch {
    // A model that will not delete is not worth crashing Settings over; the
    // next attempt, or clearing app data, removes it.
  }
}

/** Removes every downloaded model. Part of "Delete all data". */
export async function removeAllSpeechModels(): Promise<void> {
  for (const model of SPEECH_MODELS) await removeSpeechModel(model.id);
}
