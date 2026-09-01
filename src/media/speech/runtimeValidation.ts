export type RuntimeValidationResult =
  | { status: 'ready' }
  | { status: 'repair'; message: string }
  | { status: 'incompatible'; message: string };

interface SttEngine {
  destroy(): Promise<void>;
}

interface SttRuntime {
  detectSttModel(
    path: { type: 'file'; path: string },
    options?: { modelType?: 'auto' },
  ): Promise<{
    success: boolean;
    error?: string;
    detectedModels: { type: string; modelDir: string }[];
    modelType?: string;
    isHardwareSpecificUnsupported?: boolean;
  }>;
  createSTT(options: {
    modelPath: { type: 'file'; path: string };
    modelType: 'auto';
    modelOptions?: { senseVoice: { language: string; useItn: boolean } };
  }): Promise<SttEngine>;
}

let runtimeOverrideForTesting: SttRuntime | null | undefined;

export function __setSttValidationRuntimeForTesting(
  runtime: SttRuntime | null | undefined,
): void {
  runtimeOverrideForTesting = runtime;
}

function loadRuntime(): SttRuntime | null {
  if (runtimeOverrideForTesting !== undefined) return runtimeOverrideForTesting;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    return require('react-native-sherpa-onnx/stt') as SttRuntime;
  } catch {
    return null;
  }
}

/** Detection plus a bounded initialize/destroy smoke test; no audio is used. */
export async function validateSpeechModelRuntime(
  appModelId: string,
  localPath: string,
  timeoutMs = 12_000,
): Promise<RuntimeValidationResult> {
  const runtime = loadRuntime();
  if (!runtime) {
    return { status: 'incompatible', message: 'This build has no local speech runtime.' };
  }
  try {
    const detection = await runtime.detectSttModel(
      { type: 'file', path: localPath },
      { modelType: 'auto' },
    );
    if (!detection.success || detection.detectedModels.length === 0) {
      const message = detection.error || 'The downloaded files are not a recognised speech model.';
      return detection.isHardwareSpecificUnsupported
        ? { status: 'incompatible', message }
        : { status: 'repair', message };
    }

    const initialization = runtime.createSTT({
      modelPath: { type: 'file', path: localPath },
      modelType: 'auto',
      ...(appModelId === 'sense-voice-small'
        ? { modelOptions: { senseVoice: { language: 'auto', useItn: true } } }
        : {}),
    });
    let engine: SttEngine;
    try {
      engine = await withTimeout(initialization, timeoutMs);
    } catch (error) {
      // Native initialization cannot be force-cancelled. If it finishes after
      // our UI timeout, destroy it immediately so a late engine cannot leak
      // memory or turn a stale validation into Ready.
      void initialization.then((lateEngine) => lateEngine.destroy()).catch(() => undefined);
      throw error;
    }
    await engine.destroy();
    return { status: 'ready' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The speech model could not start.';
    return /hardware|unsupported|memory|allocate|out of memory|oom/i.test(message)
      ? { status: 'incompatible', message }
      : { status: 'repair', message };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Speech model initialization timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
