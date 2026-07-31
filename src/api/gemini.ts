import { VisionError } from '@/api/errors';
import { SYSTEM_PROMPT, USER_PROMPT } from '@/api/prompt';

/**
 * Google Gemini transport.
 *
 * Uses the Generative Language API with the key as a query parameter (the AI
 * Studio style). `gemini-flash-latest` is chosen because it has vision and
 * carries a free-tier quota, so the app works without a funded account. The
 * task prompt goes in `systemInstruction`; the image and the per-request ask go
 * in `contents`. `responseMimeType: application/json` makes the model return a
 * bare JSON object, which the shared parser then reads.
 */

const MODEL = 'gemini-flash-latest';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 30_000;

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
}

/** Sends the image and returns the model's raw text (expected to be JSON). */
export async function estimateWithGemini(
  apiKey: string,
  base64Jpeg: string,
  signal?: AbortSignal,
): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } },
          { text: USER_PROMPT },
        ],
      },
    ],
    generationConfig: { responseMimeType: 'application/json' },
  };

  const response = await post(`${ENDPOINT}?key=${apiKey}`, body, signal);
  const text = firstPartText(response);
  if (!text) {
    throw new VisionError('malformed', 'The estimate came back empty.');
  }
  return text;
}

/**
 * Validates the key by listing models — no generate quota is spent, which
 * matters on the free tier where request-per-day limits are tight.
 */
export async function verifyGeminiKey(apiKey: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${MODELS_ENDPOINT}?key=${apiKey}`, {
      signal: controller.signal,
    });
  } catch {
    throw controller.signal.aborted
      ? new VisionError('timeout', 'The check timed out.')
      : new VisionError('network', 'Could not reach the service.');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw await errorForResponse(response);
  }
}

async function post(
  url: string,
  body: unknown,
  signal: AbortSignal | undefined,
): Promise<GeminiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    return (await response.json()) as GeminiResponse;
  } catch {
    throw new VisionError('malformed', 'The estimate could not be read.');
  }
}

async function errorForResponse(response: Response): Promise<VisionError> {
  const status = response.status;
  let apiMessage = '';
  try {
    const parsed = (await response.json()) as { error?: { message?: string } };
    apiMessage = parsed.error?.message ?? '';
  } catch {
    // No JSON body; fall back to status alone.
  }

  if (status === 400 && /api key not valid|invalid.*key/i.test(apiMessage)) {
    return new VisionError('unauthorized', 'Your API key was rejected.');
  }
  if (status === 401 || status === 403) {
    return new VisionError('unauthorized', 'Your API key was rejected.');
  }
  if (status === 429) {
    // Gemini's free tier reports rate and daily limits here.
    return new VisionError(
      'rate_limited',
      'This key has hit its Gemini free-tier limit. Try again later.',
    );
  }
  if (status >= 500) {
    return new VisionError('server', 'The service is unavailable.');
  }
  return new VisionError(
    'malformed',
    apiMessage || `The request was rejected (${status}).`,
  );
}

function firstPartText(response: GeminiResponse): string | null {
  const parts = response.candidates?.[0]?.content?.parts;
  const withText = parts?.find((part) => typeof part.text === 'string');
  return withText?.text ?? null;
}
