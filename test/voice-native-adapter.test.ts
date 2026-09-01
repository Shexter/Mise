import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  __setNativeModuleForTesting,
  androidOfflineRecognitionAdapter,
  getAndroidOfflineLanguageStatus,
  installAndroidOfflineLanguage,
  NativeSpeechRecognitionError,
  phoneSpeechAdapter,
} from '../src/media/speech/adapters/native';
import { SpeechPermissionDeniedError } from '../src/media/speech/types';

interface FakeEvent {
  result: { results: { transcript?: string; confidence?: number }[] };
  error: { error: string; message?: string };
  end: undefined;
}

function createFakeModule(options: {
  granted?: boolean;
  onDevice?: boolean;
  recognitionAvailable?: boolean;
  installedLocales?: string[];
  installStatus?: 'download_success' | 'opened_dialog' | 'download_canceled';
} = {}) {
  const handlers = new Map<keyof FakeEvent, ((payload: unknown) => void)[]>();
  const module = {
    requestPermissionsAsync: vi.fn(async () => ({ granted: options.granted ?? true })),
    supportsOnDeviceRecognition: vi.fn(() => options.onDevice ?? true),
    isRecognitionAvailable: vi.fn(() => options.recognitionAvailable ?? true),
    getSpeechRecognitionServices: vi.fn(() => [
      'com.samsung.android.bixby.agent', 'com.google.android.as',
    ]),
    getDefaultRecognitionService: vi.fn(() => ({
      packageName: 'com.samsung.android.bixby.agent',
    })),
    getSupportedLocales: vi.fn(async (_request: Record<string, unknown>) => ({
      locales: ['en-GB', 'fr-FR'],
      installedLocales: options.installedLocales ?? ['en-GB'],
    })),
    androidTriggerOfflineModelDownload: vi.fn(async (_request: { locale: string }) => ({
      status: options.installStatus ?? 'download_success', message: 'result',
    })),
    start: vi.fn((_request: Record<string, unknown>) => undefined),
    stop: vi.fn(() => undefined),
    abort: vi.fn(() => undefined),
    addListener: vi.fn((event: keyof FakeEvent, listener: (payload: unknown) => void) => {
      const bucket = handlers.get(event) ?? [];
      bucket.push(listener);
      handlers.set(event, bucket);
      return { remove: vi.fn(() => {
        handlers.set(event, (handlers.get(event) ?? []).filter((item) => item !== listener));
      }) };
    }),
  };
  return {
    module,
    emit<K extends keyof FakeEvent>(event: K, payload: FakeEvent[K]) {
      for (const handler of [...(handlers.get(event) ?? [])]) handler(payload);
    },
    listenerCount(event: keyof FakeEvent) {
      return handlers.get(event)?.length ?? 0;
    },
  };
}

let fake: ReturnType<typeof createFakeModule>;

beforeEach(() => {
  fake = createFakeModule();
  __setNativeModuleForTesting(fake.module);
});
afterEach(async () => {
  await phoneSpeechAdapter.cancel();
  await androidOfflineRecognitionAdapter.cancel();
  __setNativeModuleForTesting(undefined);
});

describe('Android recognition precedence is explicit', () => {
  test('Phone speech asks for the system default and never names Samsung or another package', async () => {
    expect(await phoneSpeechAdapter.isAvailable('en-GB')).toEqual({
      available: true, onDevice: false,
    });
    await phoneSpeechAdapter.start({ language: 'en-GB', onPartial: () => {} });
    expect(fake.module.start).toHaveBeenCalledWith(expect.objectContaining({
      requiresOnDeviceRecognition: false,
    }));
    expect(fake.module.start.mock.calls[0]?.[0]).not.toHaveProperty(
      'androidRecognitionServicePackage',
    );
    expect(fake.module.getSupportedLocales).not.toHaveBeenCalled();
  });

  test('Offline only uses the generic on-device branch and still omits a package', async () => {
    expect(await androidOfflineRecognitionAdapter.isAvailable('en-GB')).toEqual({
      available: true, onDevice: true,
    });
    expect(fake.module.getSupportedLocales).toHaveBeenCalledWith({});
    await androidOfflineRecognitionAdapter.start({ language: 'en-GB', onPartial: () => {} });
    expect(fake.module.start).toHaveBeenCalledWith(expect.objectContaining({
      requiresOnDeviceRecognition: true,
    }));
    expect(fake.module.start.mock.calls[0]?.[0]).not.toHaveProperty(
      'androidRecognitionServicePackage',
    );
  });

  test('a missing offline locale and an unsupported on-device API are distinct', async () => {
    fake = createFakeModule({ installedLocales: [] });
    __setNativeModuleForTesting(fake.module);
    await expect(androidOfflineRecognitionAdapter.isAvailable('en-GB')).resolves.toMatchObject({
      available: false, reason: 'no_offline_model',
    });
    fake = createFakeModule({ onDevice: false });
    __setNativeModuleForTesting(fake.module);
    await expect(androidOfflineRecognitionAdapter.isAvailable('en-GB')).resolves.toMatchObject({
      available: false, reason: 'platform_unsupported',
    });
  });
});

describe('permission, start, partial, stop, cancel, and late events', () => {
  test('permission refusal is the dedicated error and does not start', async () => {
    fake = createFakeModule({ granted: false });
    __setNativeModuleForTesting(fake.module);
    await expect(phoneSpeechAdapter.start({ language: 'en-GB', onPartial: () => {} }))
      .rejects.toBeInstanceOf(SpeechPermissionDeniedError);
    expect(fake.module.start).not.toHaveBeenCalled();
  });

  test('a synchronous native start error is surfaced and listeners are removed', async () => {
    fake.module.start.mockImplementationOnce(() => { throw new Error('bind failed'); });
    await expect(phoneSpeechAdapter.start({ language: 'en-GB', onPartial: () => {} }))
      .rejects.toThrow('bind failed');
    expect(fake.listenerCount('result')).toBe(0);
  });

  test('partial text survives a mid-session error with its native code', async () => {
    const errors: unknown[] = [];
    await phoneSpeechAdapter.start({
      language: 'en-GB', onPartial: () => {},
      onError: (...args) => errors.push(args),
    });
    fake.emit('result', { results: [{ transcript: 'six eggs', confidence: 0.9 }] });
    fake.emit('error', { error: 'network', message: 'offline' });
    expect(errors).toEqual([['service_unavailable', 'six eggs', 'network']]);
  });

  test('stop rejects with a typed error that retains safe partial text', async () => {
    await phoneSpeechAdapter.start({ language: 'en-GB', onPartial: () => {} });
    fake.emit('result', { results: [{ transcript: 'milk and eggs' }] });
    const stopping = phoneSpeechAdapter.stop();
    fake.emit('error', { error: 'client', message: 'recognizer died' });
    const error = await stopping.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(NativeSpeechRecognitionError);
    expect(error).toMatchObject({
      partialTranscript: 'milk and eggs', kind: 'transcription_failed', nativeCode: 'client',
    });
  });

  test('stop returns the last result and removes listeners', async () => {
    await androidOfflineRecognitionAdapter.start({ language: 'en-GB', onPartial: () => {} });
    fake.emit('result', { results: [{ transcript: 'seven eggs', confidence: 0.8 }] });
    const stopping = androidOfflineRecognitionAdapter.stop();
    fake.emit('end', undefined);
    await expect(stopping).resolves.toEqual({
      text: 'seven eggs', confidence: 0.8, mode: 'android_offline',
    });
    expect(fake.listenerCount('result')).toBe(0);
  });

  test('cancel aborts and a late aborted event cannot become a failure', async () => {
    const failures: string[] = [];
    await phoneSpeechAdapter.start({
      language: 'en-GB', onPartial: () => {}, onError: (kind) => failures.push(kind),
    });
    await phoneSpeechAdapter.cancel();
    fake.emit('error', { error: 'aborted' });
    expect(fake.module.abort).toHaveBeenCalled();
    expect(failures).toEqual([]);
  });
});

describe('Android official offline-language installation', () => {
  test('an installed locale does not reopen the dialog', async () => {
    await expect(getAndroidOfflineLanguageStatus('en-US')).resolves.toBe('installed');
    await expect(installAndroidOfflineLanguage('en-US')).resolves.toEqual({
      status: 'installed', recheck: false,
    });
    expect(fake.module.androidTriggerOfflineModelDownload).not.toHaveBeenCalled();
  });

  test.each([
    ['download_success', 'completed'],
    ['opened_dialog', 'dialog_opened'],
    ['download_canceled', 'cancelled'],
  ] as const)('maps %s and asks the UI to recheck', async (nativeStatus, status) => {
    fake = createFakeModule({ installedLocales: [], installStatus: nativeStatus });
    __setNativeModuleForTesting(fake.module);
    await expect(installAndroidOfflineLanguage('en-GB')).resolves.toEqual({
      status, recheck: true,
    });
    expect(fake.module.androidTriggerOfflineModelDownload).toHaveBeenCalledWith({ locale: 'en-GB' });
  });

  test('unsupported devices get an explicit terminal state', async () => {
    fake = createFakeModule({ installedLocales: [], onDevice: false });
    __setNativeModuleForTesting(fake.module);
    await expect(installAndroidOfflineLanguage('en-GB')).resolves.toMatchObject({
      status: 'unsupported', recheck: false,
    });
  });
});
