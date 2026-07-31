import { estimateWithAnthropic, verifyAnthropicKey } from '@/api/anthropic';
import { VisionError } from '@/api/errors';
import { estimateWithGemini, verifyGeminiKey } from '@/api/gemini';
import { getApiKey, providerForKey } from '@/api/keyStore';
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

/**
 * Estimates a meal from a base64 JPEG.
 *
 * Retries once on malformed JSON, then gives up so the caller can fall back to
 * manual entry with the photo attached.
 *
 * Preconditions:
 * base64Jpeg is the raw base64 payload, without a data URI prefix
 */
export async function estimateMeal(
  base64Jpeg: string,
  signal?: AbortSignal,
): Promise<MealEstimate> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new VisionError('no_key', 'No API key is set.');
  }
  const provider = providerForKey(apiKey);

  const request = () =>
    provider === 'anthropic'
      ? estimateWithAnthropic(apiKey, base64Jpeg, signal)
      : estimateWithGemini(apiKey, base64Jpeg, signal);

  try {
    return parseEstimate(await request());
  } catch (error) {
    if (error instanceof VisionError && error.kind === 'malformed') {
      return parseEstimate(await request());
    }
    throw error;
  }
}

/** Confirms the stored key works, for the "Test key" button. */
export async function verifyApiKey(): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new VisionError('no_key', 'No API key is set.');
  }
  return providerForKey(apiKey) === 'anthropic'
    ? verifyAnthropicKey(apiKey)
    : verifyGeminiKey(apiKey);
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
export function copyForError(error: unknown): VisionErrorCopy {
  const kind = error instanceof VisionError ? error.kind : 'malformed';
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
      return {
        title: 'Your Anthropic account is out of credits',
        detail:
          'The key works, but the account has no API credits. Add credits at console.anthropic.com under Plans & Billing, then try again.',
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
