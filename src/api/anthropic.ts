import { VisionError } from '@/api/errors';
import { KEY_CHECK_PROMPT, SYSTEM_PROMPT, USER_PROMPT } from '@/api/prompt';

/**
 * Anthropic Messages API transport.
 *
 * A direct `fetch` — React Native has no CORS layer, so no proxy is needed. The
 * key is passed in by the facade (`vision.ts`); this module never reads storage.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;
const TIMEOUT_MS = 30_000;

interface AnthropicTextBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicTextBlock[];
}

/** Sends the image and returns the model's raw text (expected to be JSON). */
export async function estimateWithAnthropic(
  apiKey: string,
  base64Jpeg: string,
  signal?: AbortSignal,
): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Jpeg,
            },
          },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  };

  const response = await post(apiKey, body, signal);
  const text = firstTextBlock(response);
  if (!text) {
    throw new VisionError('malformed', 'The estimate came back empty.');
  }
  return text;
}

/** One-token round trip used by the "Test key" button. */
export async function verifyAnthropicKey(apiKey: string): Promise<void> {
  await post(
    apiKey,
    {
      model: MODEL,
      max_tokens: 1,
      messages: [{ role: 'user', content: KEY_CHECK_PROMPT }],
    },
    undefined,
  );
}

async function post(
  apiKey: string,
  body: unknown,
  signal: AbortSignal | undefined,
): Promise<AnthropicResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new VisionError(
        signal?.aborted ? 'cancelled' : 'timeout',
        signal?.aborted ? 'Estimate cancelled.' : 'The estimate timed out.',
      );
    }
    throw new VisionError('network', 'Could not reach the service.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  if (!response.ok) {
    throw await errorForResponse(response);
  }

  try {
    return (await response.json()) as AnthropicResponse;
  } catch {
    throw new VisionError('malformed', 'The estimate could not be read.');
  }
}

/**
 * Reads the error body so a "credit balance too low" 400 — a valid key on an
 * unfunded account — is reported as a billing problem, not a generic rejection.
 */
async function errorForResponse(response: Response): Promise<VisionError> {
  const status = response.status;
  let apiMessage = '';
  try {
    const parsed = (await response.json()) as { error?: { message?: string } };
    apiMessage = parsed.error?.message ?? '';
  } catch {
    // No JSON body; fall back to status alone.
  }

  if (isBillingMessage(apiMessage)) {
    return new VisionError('billing', 'This Anthropic account has no API credits.');
  }
  if (status === 401 || status === 403) {
    return new VisionError('unauthorized', 'Your API key was rejected.');
  }
  if (status === 429) {
    return new VisionError('rate_limited', 'Rate limited.');
  }
  if (status >= 500) {
    return new VisionError('server', 'The service is unavailable.');
  }
  return new VisionError(
    'malformed',
    apiMessage || `The request was rejected (${status}).`,
  );
}

function isBillingMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('credit balance') ||
    lower.includes('billing') ||
    lower.includes('purchase credits')
  );
}

function firstTextBlock(response: AnthropicResponse): string | null {
  const block = response.content?.find(
    (item) => item.type === 'text' && typeof item.text === 'string',
  );
  return block?.text ?? null;
}
