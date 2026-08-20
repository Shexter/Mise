import { beforeEach, describe, expect, test } from 'vitest';

import { clearApiKey, PROVIDERS, setApiKey } from '@/api/keyStore';
import {
  DEFAULT_RATE_LIMIT_RETRY_MS as transportRetryMs,
  resolveTransport,
  retryRateLimitedOnce as transportRetry,
  TRANSPORTS,
} from '@/api/transport';
import {
  DEFAULT_RATE_LIMIT_RETRY_MS as visionRetryMs,
  retryRateLimitedOnce as visionRetry,
  TRANSPORTS as visionTransports,
} from '@/api/vision';

describe('provider transport facade', () => {
  beforeEach(async () => {
    await clearApiKey();
  });

  test('is exhaustive for every Provider and every operation', () => {
    expect(Object.keys(TRANSPORTS).sort()).toEqual(Object.keys(PROVIDERS).sort());
    for (const transport of Object.values(TRANSPORTS)) {
      expect(typeof transport.estimate).toBe('function');
      expect(typeof transport.completeVision).toBe('function');
      expect(typeof transport.verify).toBe('function');
    }
  });

  test('vision compatibility exports reference the single facade', () => {
    expect(visionTransports).toBe(TRANSPORTS);
    expect(visionRetry).toBe(transportRetry);
    expect(visionRetryMs).toBe(transportRetryMs);
  });

  test('resolves each recognised stored key through the exhaustive map', async () => {
    const keys = {
      anthropic: 'sk-ant-abcdefghijklmnopqrstuvwxyz',
      openai: 'sk-abcdefghijklmnopqrstuvwxyz',
      gemini: 'AIzaabcdefghijklmnopqrstuvwxyz',
    } as const;
    for (const [provider, key] of Object.entries(keys)) {
      await setApiKey(key);
      await expect(resolveTransport()).resolves.toMatchObject({
        apiKey: key,
        provider,
        transport: TRANSPORTS[provider as keyof typeof TRANSPORTS],
      });
    }
  });

  test('keeps missing, unknown, and cancelled key resolution distinct', async () => {
    await expect(resolveTransport()).rejects.toMatchObject({ kind: 'no_key' });
    await setApiKey('not-a-provider-key');
    await expect(resolveTransport()).rejects.toMatchObject({ kind: 'no_key' });

    const controller = new AbortController();
    controller.abort();
    await expect(resolveTransport(controller.signal)).rejects.toMatchObject({ kind: 'cancelled' });
  });
});
