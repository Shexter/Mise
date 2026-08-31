import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  __setNativeModuleForTesting,
  nativeRecognitionAdapter as adapter,
} from '../src/media/speech/adapters/native';
import { SpeechPermissionDeniedError } from '../src/media/speech/types';

/**
 * Regression coverage for two bugs found only by a real device: this adapter
 * called `addSpeechRecognitionListener`, a method that does not exist
 * anywhere in `expo-speech-recognition` — the package extends Expo's ordinary
 * `EventEmitter`, whose method is `addListener`. That typo meant `start()`
 * threw before the native recogniser was ever asked to start, on every
 * device, regardless of whether the OS permission was granted — and the
 * screen's catch-all reported that thrown error as "permission denied",
 * which sent a correctly-configured phone to Settings for nothing.
 *
 * `test/voice-session.test.ts` only exercises the `module_missing` branch,
 * because under Node the real package's native side never loads — that is
 * the right behaviour for that file, but it is also exactly why a typo in the
 * method actually used to drive a *present* module went uncaught. This file
 * closes that gap with a fake module shaped like the installed package's own
 * `.d.ts`, so the adapter's calls are checked against real method names
 * rather than against whatever the test double happens to also get wrong.
 */

interface FakeEvent {
  result: { results: { transcript?: string; confidence?: number }[] };
  error: { error: string; message?: string };
  end: undefined;
}

function createFakeModule(overrides: { granted?: boolean } = {}) {
  const handlers = new Map<keyof FakeEvent, ((payload: unknown) => void)[]>();
  const calls: { start: Record<string, unknown>[]; getSupportedLocales: unknown[] } = {
    start: [],
    getSupportedLocales: [],
  };

  const module = {
    requestPermissionsAsync: vi.fn(async () => ({ granted: overrides.granted ?? true })),
    supportsOnDeviceRecognition: vi.fn(() => true),
    getSupportedLocales: vi.fn(async (options: unknown) => {
      calls.getSupportedLocales.push(options);
      return { locales: ['en-GB'], installedLocales: ['en-GB'] };
    }),
    start: vi.fn((options: Record<string, unknown>) => {
      calls.start.push(options);
    }),
    stop: vi.fn(() => undefined),
    abort: vi.fn(() => undefined),
    // The real method: Expo's EventEmitter.addListener, not a bespoke name.
    addListener: vi.fn((event: keyof FakeEvent, listener: (payload: unknown) => void) => {
      const bucket = handlers.get(event) ?? [];
      bucket.push(listener);
      handlers.set(event, bucket);
      return { remove: vi.fn(() => {
        const remaining = (handlers.get(event) ?? []).filter((entry) => entry !== listener);
        handlers.set(event, remaining);
      }) };
    }),
  };

  return {
    module,
    calls,
    emit: <K extends keyof FakeEvent>(event: K, payload: FakeEvent[K]) => {
      for (const listener of handlers.get(event) ?? []) listener(payload);
    },
    listenerCount: (event: keyof FakeEvent) => (handlers.get(event) ?? []).length,
  };
}

let fake: ReturnType<typeof createFakeModule>;

beforeEach(() => {
  fake = createFakeModule();
  __setNativeModuleForTesting(fake.module);
});

afterEach(async () => {
  // Defensive: a test that asserts on a thrown start() never reaches stop(),
  // so this clears any listeners/pending state before the next test's start().
  await adapter.cancel();
  __setNativeModuleForTesting(undefined);
});

describe('the real module is reached through its real methods', () => {
  test('listening is wired through addListener, not a method the package does not have', async () => {
    await adapter.start({ language: 'en-GB', onPartial: () => {} });

    expect(fake.module.addListener).toHaveBeenCalledWith('result', expect.any(Function));
    expect(fake.module.addListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(fake.module.addListener).toHaveBeenCalledWith('end', expect.any(Function));
    // Nothing in the fake defines addSpeechRecognitionListener at all; if the
    // adapter still called it, `start()` would already have thrown above.
  });

  test('the same on-device service is checked in isAvailable and used in start', async () => {
    await adapter.isAvailable('en-GB');
    await adapter.start({ language: 'en-GB', onPartial: () => {} });

    expect(fake.calls.getSupportedLocales[0]).toEqual({
      androidRecognitionServicePackage: 'com.google.android.as',
    });
    expect(fake.calls.start[0]).toMatchObject({
      androidRecognitionServicePackage: 'com.google.android.as',
      requiresOnDeviceRecognition: true,
    });
  });

  test('a live partial transcript reaches onPartial as words come in', async () => {
    const partials: string[] = [];
    await adapter.start({ language: 'en-GB', onPartial: (text) => partials.push(text) });

    fake.emit('result', { results: [{ transcript: 'six eggs', confidence: 0.9 }] });

    expect(partials).toEqual(['six eggs']);
  });
});

describe('permission failures are told apart from everything else', () => {
  test('a refused permission throws the dedicated error, before any listener is attached', async () => {
    fake = createFakeModule({ granted: false });
    __setNativeModuleForTesting(fake.module);

    await expect(
      adapter.start({ language: 'en-GB', onPartial: () => {} }),
    ).rejects.toBeInstanceOf(SpeechPermissionDeniedError);
    expect(fake.module.addListener).not.toHaveBeenCalled();
    expect(fake.module.start).not.toHaveBeenCalled();
  });
});

describe('a mid-session native error is not silently dropped', () => {
  test('an error while listening reaches onError, not a swallowed promise', async () => {
    const failures: string[] = [];
    await adapter.start({
      language: 'en-GB',
      onPartial: () => {},
      onError: (kind) => failures.push(kind),
    });

    // No stop() is in flight — this is the exact situation the earlier
    // version dropped, because its listener only checked a `pending` object
    // that only existed inside stop().
    fake.emit('error', { error: 'audio-capture', message: 'mic lost' });

    expect(failures).toEqual(['microphone_unavailable']);
  });

  test('every mapped error code lands on a distinguishable failure', async () => {
    const cases: [string, string][] = [
      ['not-allowed', 'permission_denied'],
      ['no-speech', 'no_speech'],
      ['speech-timeout', 'no_speech'],
      ['audio-capture', 'microphone_unavailable'],
      ['busy', 'microphone_unavailable'],
      ['language-not-supported', 'offline_model_missing'],
      ['service-not-allowed', 'service_unavailable'],
      ['network', 'service_unavailable'],
      ['client', 'transcription_failed'],
    ];

    for (const [code, expected] of cases) {
      fake = createFakeModule();
      __setNativeModuleForTesting(fake.module);
      const failures: string[] = [];
      await adapter.start({ language: 'en-GB', onPartial: () => {}, onError: (k) => failures.push(k) });
      fake.emit('error', { error: code });
      expect(failures).toEqual([expected]);
    }
  });

  test('our own cancel() reports as aborted, and aborted is not a failure', async () => {
    const failures: string[] = [];
    await adapter.start({ language: 'en-GB', onPartial: () => {}, onError: (k) => failures.push(k) });

    await adapter.cancel();
    fake.emit('error', { error: 'aborted' });

    expect(failures).toEqual([]);
  });

  test('an error that arrives while stop() is pending rejects stop(), not onError', async () => {
    const failures: string[] = [];
    await adapter.start({ language: 'en-GB', onPartial: () => {}, onError: (k) => failures.push(k) });

    const stopping = adapter.stop();
    fake.emit('error', { error: 'client', message: 'boom' });

    await expect(stopping).rejects.toThrow('boom');
    expect(failures).toEqual([]);
  });
});

describe('stop() resolves from the accumulated transcript', () => {
  test('the last partial before end() is the final result', async () => {
    await adapter.start({ language: 'en-GB', onPartial: () => {} });

    fake.emit('result', { results: [{ transcript: 'six eggs', confidence: 0.7 }] });
    fake.emit('result', { results: [{ transcript: 'six eggs, actually seven', confidence: 0.9 }] });

    const stopping = adapter.stop();
    fake.emit('end', undefined);
    const result = await stopping;

    expect(result).toEqual({
      text: 'six eggs, actually seven',
      confidence: 0.9,
      mode: 'on_device',
    });
  });

  test('a final result delivered before Finish is not discarded by stop()', async () => {
    // The exact shape of the bug: Android's `continuous: true` commonly
    // delivers its final (isFinal: true) result before the user presses
    // Finish. If `stop()` only captured text from events that arrive after it
    // is called, no further `result` event would ever come, and `end` would
    // resolve with the empty string it started from — silently discarding
    // speech the user already saw echoed on screen and reporting the session
    // as though nothing had been heard.
    await adapter.start({ language: 'en-GB', onPartial: () => {} });

    fake.emit('result', { results: [{ transcript: 'six eggs', confidence: 0.95 }] });
    // No further 'result' event — this is the whole point of the test.

    const stopping = adapter.stop();
    fake.emit('end', undefined);

    expect(await stopping).toEqual({
      text: 'six eggs',
      confidence: 0.95,
      mode: 'on_device',
    });
  });

  test('a session that heard nothing still resolves cleanly', async () => {
    await adapter.start({ language: 'en-GB', onPartial: () => {} });

    const stopping = adapter.stop();
    fake.emit('end', undefined);

    expect(await stopping).toEqual({ text: '', confidence: null, mode: 'on_device' });
  });

  test('a new session starts clean, not carrying the previous one’s transcript', async () => {
    await adapter.start({ language: 'en-GB', onPartial: () => {} });
    fake.emit('result', { results: [{ transcript: 'leftover from last time', confidence: 0.9 }] });
    await adapter.cancel();

    await adapter.start({ language: 'en-GB', onPartial: () => {} });
    const stopping = adapter.stop();
    fake.emit('end', undefined);

    expect(await stopping).toEqual({ text: '', confidence: null, mode: 'on_device' });
  });

  test('listeners are removed once the session ends', async () => {
    await adapter.start({ language: 'en-GB', onPartial: () => {} });
    expect(fake.listenerCount('result')).toBeGreaterThan(0);

    const stopping = adapter.stop();
    fake.emit('end', undefined);
    await stopping;

    expect(fake.listenerCount('result')).toBe(0);
    expect(fake.listenerCount('error')).toBe(0);
    expect(fake.listenerCount('end')).toBe(0);
  });
});
