import {
  completeVisionWithAnthropic,
  estimateWithAnthropic,
  verifyAnthropicKey,
} from '@/api/anthropic';
import { VisionError } from '@/api/errors';
import {
  completeVisionWithGemini,
  estimateWithGemini,
  verifyGeminiKey,
} from '@/api/gemini';
import {
  getApiKey,
  getOpenAIEndpoint,
  providerForKey,
  type Provider,
} from '@/api/keyStore';
import {
  completeVisionWithOpenAI,
  estimateWithOpenAI,
  verifyOpenAIKey,
} from '@/api/openai';

export interface Transport {
  estimate: (apiKey: string, base64Jpeg: string, signal?: AbortSignal) => Promise<string>;
  completeVision: (
    apiKey: string,
    system: string,
    user: string,
    base64Jpeg: string,
    signal?: AbortSignal,
  ) => Promise<string>;
  verify: (apiKey: string) => Promise<void>;
}

/** Exhaustive by design: adding a Provider requires a complete transport. */
export const TRANSPORTS = {
  anthropic: {
    estimate: estimateWithAnthropic,
    completeVision: completeVisionWithAnthropic,
    verify: verifyAnthropicKey,
  },
  gemini: {
    estimate: estimateWithGemini,
    completeVision: completeVisionWithGemini,
    verify: verifyGeminiKey,
  },
  openai: {
    estimate: async (apiKey, base64Jpeg, signal) =>
      estimateWithOpenAI(apiKey, base64Jpeg, signal, await getOpenAIEndpoint()),
    completeVision: async (apiKey, system, user, base64Jpeg, signal) =>
      completeVisionWithOpenAI(
        apiKey,
        system,
        user,
        base64Jpeg,
        signal,
        await getOpenAIEndpoint(),
      ),
    verify: async (apiKey) => verifyOpenAIKey(apiKey, await getOpenAIEndpoint()),
  },
} satisfies Record<Provider, Transport>;

export interface ResolvedTransport {
  apiKey: string;
  provider: Provider;
  transport: Transport;
}

export const DEFAULT_RATE_LIMIT_RETRY_MS = 2_000;
export const DEFAULT_TRANSIENT_RETRY_MS = 750;

export async function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  throwIfCancelled(signal);
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timeout = setTimeout(finish, delayMs);
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      reject(cancelledError());
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function retryRateLimitedOnce<T>(
  request: () => Promise<T>,
  signal?: AbortSignal,
  onRetryWait?: (delayMs: number) => void,
  wait: (delayMs: number, signal?: AbortSignal) => Promise<void> = waitForRetry,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof VisionError) || error.kind !== 'rate_limited') throw error;
    const delayMs = error.retryAfterMs ?? DEFAULT_RATE_LIMIT_RETRY_MS;
    onRetryWait?.(delayMs);
    await wait(delayMs, signal);
    return request();
  }
}

/** Mobile networks regularly drop one request; retry transient failures once. */
export async function retryTransientOnce<T>(
  request: () => Promise<T>,
  signal?: AbortSignal,
  onRetryWait?: (delayMs: number) => void,
  wait: (delayMs: number, signal?: AbortSignal) => Promise<void> = waitForRetry,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof VisionError) || !['network', 'server', 'timeout'].includes(error.kind)) {
      throw error;
    }
    onRetryWait?.(DEFAULT_TRANSIENT_RETRY_MS);
    await wait(DEFAULT_TRANSIENT_RETRY_MS, signal);
    return request();
  }
}

/** Resolves the stored key exactly once for one provider request. */
export async function resolveTransport(signal?: AbortSignal): Promise<ResolvedTransport> {
  throwIfCancelled(signal);
  const apiKey = await getApiKey();
  throwIfCancelled(signal);
  if (!apiKey) throw new VisionError('no_key', 'No API key is set.');

  const provider = providerForKey(apiKey);
  if (!provider) throw new VisionError('no_key', 'The saved API key is not recognised.');
  return { apiKey, provider, transport: TRANSPORTS[provider] };
}

/**
 * Runs one provider operation with shared key resolution, bounded rate-limit
 * retry, cancellation, and provider attribution.
 */
export async function withResolvedTransport<T>(
  request: (resolved: ResolvedTransport) => Promise<T>,
  signal?: AbortSignal,
  onRetryWait?: (delayMs: number) => void,
): Promise<T> {
  const resolved = await resolveTransport(signal);
  try {
    return await retryTransientOnce(
      () => retryRateLimitedOnce(() => request(resolved), signal, onRetryWait),
      signal,
      onRetryWait,
    );
  } catch (error) {
    if (error instanceof VisionError) error.provider = resolved.provider;
    throw error;
  }
}

/** Sends one image request with a caller-supplied prompt. */
export async function completeVision(
  base64Jpeg: string,
  system: string,
  user: string,
  signal?: AbortSignal,
  onRetryWait?: (delayMs: number) => void,
): Promise<string> {
  return withResolvedTransport(
    ({ apiKey, transport }) => transport.completeVision(
      apiKey,
      system,
      user,
      base64Jpeg,
      signal,
    ),
    signal,
    onRetryWait,
  );
}

/** Confirms the stored key works without retrying or changing provider rules. */
export async function verifyStoredApiKey(): Promise<void> {
  const resolved = await resolveTransport();
  return resolved.transport.verify(resolved.apiKey);
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancelledError();
}

function cancelledError(): VisionError {
  return new VisionError('cancelled', 'Estimate cancelled.');
}
