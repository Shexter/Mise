import { expect, test } from 'vitest';

import { VisionError } from '../src/api/errors';
import {
  DEFAULT_RATE_LIMIT_RETRY_MS,
  retryRateLimitedOnce,
} from '../src/api/vision';

test('retries a rate-limited request once after its stated delay', async () => {
  let calls = 0;
  const waits: number[] = [];
  const result = await retryRateLimitedOnce(
    async () => {
      calls += 1;
      if (calls === 1) throw new VisionError('rate_limited', 'wait', 3456);
      return 'ok';
    },
    undefined,
    undefined,
    async (delay) => { waits.push(delay); },
  );
  expect(result).toBe('ok');
  expect(calls).toBe(2);
  expect(waits).toEqual([3456]);
});

test('uses the bounded default and never retries a second rate limit', async () => {
  const waits: number[] = [];
  let calls = 0;
  await expect(retryRateLimitedOnce(
    async () => {
      calls += 1;
      throw new VisionError('rate_limited', 'wait');
    },
    undefined,
    undefined,
    async (delay) => { waits.push(delay); },
  )).rejects.toMatchObject({ kind: 'rate_limited' });
  expect(waits).toEqual([DEFAULT_RATE_LIMIT_RETRY_MS]);
  expect(calls).toBe(2);
});

test('does not retry a non-rate-limit error', async () => {
  let calls = 0;
  await expect(retryRateLimitedOnce(async () => {
    calls += 1;
    throw new VisionError('unauthorized', 'no');
  })).rejects.toMatchObject({ kind: 'unauthorized' });
  expect(calls).toBe(1);
});

test('cancelling during the wait makes no retry request', async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = retryRateLimitedOnce(
    async () => {
      calls += 1;
      throw new VisionError('rate_limited', 'wait', 1000);
    },
    controller.signal,
    undefined,
    (_delay, signal) => signal?.aborted
      ? Promise.reject(new VisionError('cancelled', 'cancelled'))
      : new Promise<void>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new VisionError('cancelled', 'cancelled')), { once: true });
        }),
  );
  controller.abort();
  await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  expect(calls).toBe(1);
});
