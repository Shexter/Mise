import { VisionError } from '@/api/errors';
import { PROVIDERS, type Provider } from '@/api/keyStore';
import { parseEstimate } from '@/api/parse';
import { verifyStoredApiKey, withResolvedTransport } from '@/api/transport';
import type { MealEstimate } from '@/types';

/**
 * The vision facade. Screens call `estimateMeal` and `verifyApiKey` here; this
 * module picks the provider from the stored key and dispatches to the matching
 * transport, then parses the shared JSON shape. The Anthropic and Gemini
 * modules own their own request/error details.
 */

export { VisionError } from '@/api/errors';
export type { VisionErrorKind } from '@/api/errors';
export {
  completeVision,
  DEFAULT_RATE_LIMIT_RETRY_MS,
  DEFAULT_TRANSIENT_RETRY_MS,
  retryRateLimitedOnce,
  retryTransientOnce,
  TRANSPORTS,
  waitForRetry,
} from '@/api/transport';
export type { Transport } from '@/api/transport';

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
  return withResolvedTransport(
    async ({ apiKey, transport }) => parseEstimate(
      await transport.estimate(apiKey, base64Jpeg, signal),
    ),
    signal,
    onRetryWait,
  );
}

/** Confirms the stored key works, for the "Test key" button. */
export async function verifyApiKey(): Promise<void> {
  return verifyStoredApiKey();
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
      if (resolvedProvider === 'gemini') {
        return {
          title: 'Gemini free tier limit reached',
          detail: 'The free tier allows a limited number of requests per minute and per day. Wait a minute and try again, or enter the meal by hand.',
          action: 'retry',
        };
      }
      return {
        title: 'Rate limited',
        detail: 'Your key is over its request limit. Try again in a moment or enter the meal by hand.',
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
