import {
  completeVisionWithAnthropic,
  estimateWithAnthropic,
  verifyAnthropicKey,
} from '@/api/anthropic';
import { VisionError } from '@/api/errors';
import { completeVisionWithGemini, estimateWithGemini, verifyGeminiKey } from '@/api/gemini';
import { getApiKey, getOpenAIEndpoint, PROVIDERS, providerForKey, type Provider } from '@/api/keyStore';
import { completeVisionWithOpenAI, estimateWithOpenAI, verifyOpenAIKey } from '@/api/openai';
import { parseEstimate } from '@/api/parse';
import type { MealEstimate } from '@/types';

/**
 * The vision facade. Screens call `estimateMeal` and `verifyApiKey` here; this
 * module picks the provider from the stored key and dispatches to the matching
 * transport, then parses the shared JSON shape. The Anthropic and Gemini
 * modules own their own request/error details.
 */

export { VisionError } from '@/api/errors';
export type { VisionErrorKind } from '@/api/errors';

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

/** Exhaustive by design: a new provider cannot compile without a transport. */
export const TRANSPORTS: Record<Provider, Transport> = {
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
};

export const DEFAULT_RATE_LIMIT_RETRY_MS = 2_000;

export async function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new VisionError('cancelled', 'Estimate cancelled.');
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timeout = setTimeout(finish, delayMs);
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      reject(new VisionError('cancelled', 'Estimate cancelled.'));
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

/**
 * Estimates a meal from a base64 JPEG.
 *
 * Retries once on a provider-requested rate-limit delay. Malformed output is
 * not retried because another paid request cannot make a bad response reliable.
 *
 * Preconditions:
 * base64Jpeg is the raw base64 payload, without a data URI prefix
 */
export async function estimateMeal(
  base64Jpeg: string,
  signal?: AbortSignal,
  onRetryWait?: (delayMs: number) => void,
): Promise<MealEstimate> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new VisionError('no_key', 'No API key is set.');
  }
  const provider = providerForKey(apiKey);

  if (!provider) {
    throw new VisionError('no_key', 'The saved API key is not recognised.');
  }
  const request = () => TRANSPORTS[provider].estimate(apiKey, base64Jpeg, signal);

  try {
    return parseEstimate(await retryRateLimitedOnce(request, signal, onRetryWait));
  } catch (error) {
    if (error instanceof VisionError) error.provider = provider;
    throw error;
  }
}

/** Sends one image request with a caller-supplied prompt through the selected provider. */
export async function completeVision(
  base64Jpeg: string,
  system: string,
  user: string,
  signal?: AbortSignal,
  onRetryWait?: (delayMs: number) => void,
): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new VisionError('no_key', 'No API key is set.');
  const provider = providerForKey(apiKey);
  if (!provider) throw new VisionError('no_key', 'The saved API key is not recognised.');

  const request = () => TRANSPORTS[provider].completeVision(apiKey, system, user, base64Jpeg, signal);
  try {
    return await retryRateLimitedOnce(request, signal, onRetryWait);
  } catch (error) {
    if (error instanceof VisionError) error.provider = provider;
    throw error;
  }
}

/** Confirms the stored key works, for the "Test key" button. */
export async function verifyApiKey(): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new VisionError('no_key', 'No API key is set.');
  }
  const provider = providerForKey(apiKey);
  if (provider) return TRANSPORTS[provider].verify(apiKey);
  throw new VisionError('no_key', 'The saved API key is not recognised.');
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

export interface VisionErrorCopy {
  title: string;
  detail: string;
  /** Label for the primary recovery action, when one applies. */
  action: 'retry' | 'settings' | 'manual';
}

/** Errors say what happened and what to do. They do not apologise. */
export function copyForError(error: unknown, provider?: Provider | null): VisionErrorCopy {
  const kind = error instanceof VisionError ? error.kind : 'malformed';
  const resolvedProvider = provider ?? (error instanceof VisionError ? error.provider : null);
  switch (kind) {
    case 'no_key':
      return {
        title: 'No API key yet',
        detail: 'Add your key in Settings to estimate from photos.',
        action: 'settings',
      };
    case 'unauthorized':
      return {
        title: 'Your API key was rejected',
        detail: 'Add a new one in Settings.',
        action: 'settings',
      };
    case 'billing':
      if (resolvedProvider) {
        const meta = PROVIDERS[resolvedProvider];
        return {
          title: `Your ${meta.displayName} account is out of credits`,
          detail: `The key works, but the account has no API credits. Add credits at ${meta.billingLocation}, then try again.`,
          action: 'retry',
        };
      }
      return {
        title: 'Your account is out of credits',
        detail: 'The key works, but the account has no API credits. Add credits, then try again.',
        action: 'retry',
      };
    case 'rate_limited':
      return {
        title: 'Rate limited',
        detail: 'Your key is over its request limit. Try again in a moment.',
        action: 'retry',
      };
    case 'server':
    case 'network':
      return {
        title: "Couldn't reach the service",
        detail: 'Your photo is saved. Check your connection and try again.',
        action: 'retry',
      };
    case 'timeout':
      return {
        title: 'The estimate took too long',
        detail: 'Your photo is saved. Try again.',
        action: 'retry',
      };
    case 'cancelled':
      return {
        title: 'Estimate cancelled',
        detail: 'Your photo is saved.',
        action: 'retry',
      };
    case 'malformed':
    default:
      return {
        title: "The estimate didn't come back readable",
        detail: 'Enter this meal by hand — the photo is attached.',
        action: 'manual',
      };
  }
}
