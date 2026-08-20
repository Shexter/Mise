import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/media/photos', () => ({ photoBase64: vi.fn() }));
vi.mock('@/api/transport', () => ({ completeVision: vi.fn() }));

import { extractBodyComposition } from '@/api/bodyComposition';
import { VisionError, type VisionErrorKind } from '@/api/errors';
import { buildBodyCompositionPrompt } from '@/api/bodyCompositionPrompt';
import { completeVision } from '@/api/transport';
import { photoBase64 } from '@/media/photos';

const mockedPhotoBase64 = vi.mocked(photoBase64);
const mockedCompleteVision = vi.mocked(completeVision);

beforeEach(() => {
  mockedPhotoBase64.mockReset();
  mockedCompleteVision.mockReset();
  mockedPhotoBase64.mockResolvedValue('encoded-report');
});

describe('extractBodyComposition', () => {
  test('encodes the URI, sends the exact prompt, and normalises provider output', async () => {
    mockedCompleteVision.mockResolvedValue(JSON.stringify({
      provider: 'inbody',
      weightKg: '154 lb',
      bodyFatPct: null,
      leanTissueKg: null,
      boneMineralContentKg: null,
      fatFreeMassKg: '128.5 lb',
      bmrKcal: '1512 kcal',
      confidence: 'high',
    }));

    const result = await extractBodyComposition('file:///report.jpg');
    const prompt = buildBodyCompositionPrompt();
    expect(mockedPhotoBase64).toHaveBeenCalledWith('file:///report.jpg');
    expect(mockedCompleteVision).toHaveBeenCalledWith(
      'encoded-report', prompt.system, prompt.user, undefined,
    );
    expect(result).toMatchObject({
      provider: 'inbody',
      weightKg: 154 * 0.45359237,
      fatFreeMassKg: 128.5 * 0.45359237,
      bmrKcal: 1512,
      confidence: 'high',
      issues: [],
    });
  });

  test('does not call a provider when the URI is empty or cannot be read', async () => {
    await expect(extractBodyComposition('   ')).rejects.toMatchObject({ kind: 'malformed' });
    expect(mockedPhotoBase64).not.toHaveBeenCalled();

    mockedPhotoBase64.mockRejectedValueOnce(new TypeError('unreadable'));
    await expect(extractBodyComposition('file:///missing.jpg')).rejects.toMatchObject({
      kind: 'malformed',
    });
    expect(mockedCompleteVision).not.toHaveBeenCalled();
  });

  test('treats an empty encoded image as malformed without a provider request', async () => {
    mockedPhotoBase64.mockResolvedValue('');
    await expect(extractBodyComposition('file:///empty.jpg')).rejects.toMatchObject({
      kind: 'malformed',
    });
    expect(mockedCompleteVision).not.toHaveBeenCalled();
  });

  test('stops before reading a pre-cancelled request', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(extractBodyComposition('file:///report.jpg', controller.signal)).rejects.toMatchObject({
      kind: 'cancelled',
    });
    expect(mockedPhotoBase64).not.toHaveBeenCalled();
    expect(mockedCompleteVision).not.toHaveBeenCalled();
  });

  test('stops after encoding when cancellation happens during the media boundary', async () => {
    const controller = new AbortController();
    mockedPhotoBase64.mockImplementation(async () => {
      controller.abort();
      return 'encoded-report';
    });
    await expect(extractBodyComposition('file:///report.jpg', controller.signal)).rejects.toMatchObject({
      kind: 'cancelled',
    });
    expect(mockedCompleteVision).not.toHaveBeenCalled();
  });

  test('threads cancellation into an in-flight provider request', async () => {
    const controller = new AbortController();
    mockedCompleteVision.mockImplementation(async (_base64, _system, _user, signal) =>
      new Promise<string>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new VisionError('cancelled', 'cancelled'));
        }, { once: true });
      }));

    const pending = extractBodyComposition('file:///report.jpg', controller.signal);
    await vi.waitFor(() => expect(mockedCompleteVision).toHaveBeenCalled());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
    expect(mockedCompleteVision.mock.calls[0]?.[3]).toBe(controller.signal);
  });

  test('turns malformed provider content into the shared malformed error', async () => {
    mockedCompleteVision.mockResolvedValue('not a JSON object');
    await expect(extractBodyComposition('file:///report.jpg')).rejects.toMatchObject({
      kind: 'malformed',
    });
  });

  test.each([
    ['missing key', 'no_key', 'No API key is set.', undefined],
    ['unknown key', 'no_key', 'The saved API key is not recognised.', undefined],
    ['unauthorized', 'unauthorized', 'rejected', 'anthropic'],
    ['billing', 'billing', 'credits', 'openai'],
    ['rate limit', 'rate_limited', 'wait', 'gemini'],
    ['server', 'server', 'down', 'anthropic'],
    ['network', 'network', 'offline', 'gemini'],
    ['timeout', 'timeout', 'slow', 'openai'],
    ['cancelled', 'cancelled', 'cancelled', 'anthropic'],
  ] as const)(
    'preserves %s VisionError classification and provider metadata',
    async (_label, kind, message, provider) => {
      const error = new VisionError(kind as VisionErrorKind, message);
      if (provider !== undefined) error.provider = provider;
      mockedCompleteVision.mockRejectedValue(error);

      let caught: unknown;
      try {
        await extractBodyComposition('file:///report.jpg');
      } catch (value) {
        caught = value;
      }
      expect(caught).toBe(error);
      expect(caught).toMatchObject({ kind, provider });
    },
  );
});
