import { retryAfterMs, VisionError } from '@/api/errors';
import { DEFAULT_OPENAI_ENDPOINT } from '@/api/keyStore';
import { SYSTEM_PROMPT, USER_PROMPT } from '@/api/prompt';

/** Kept local so changing an OpenAI-compatible deployment is one setting. */
export const OPENAI_MODEL = 'gpt-4.1-mini';
export const VISION_TIMEOUT_MS = 45_000;

interface OpenAIResponse {
  choices?: { message?: { content?: string | null } }[];
}

export async function estimateWithOpenAI(
  apiKey: string,
  base64Jpeg: string,
  signal?: AbortSignal,
  endpoint = DEFAULT_OPENAI_ENDPOINT,
): Promise<string> {
  return completeVisionWithOpenAI(apiKey, SYSTEM_PROMPT, USER_PROMPT, base64Jpeg, signal, endpoint);
}

/** A vision completion with a caller-supplied JSON prompt. */
export async function completeVisionWithOpenAI(
  apiKey: string,
  system: string,
  user: string,
  base64Jpeg: string,
  signal?: AbortSignal,
  endpoint = DEFAULT_OPENAI_ENDPOINT,
): Promise<string> {
  return complete(apiKey, system, [
    { type: 'text', text: user },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` } },
  ], signal, endpoint);
}

/** A text-only completion with the same response and error handling. */
export async function completeWithOpenAI(
  apiKey: string,
  system: string,
  user: string,
  signal?: AbortSignal,
  endpoint = DEFAULT_OPENAI_ENDPOINT,
): Promise<string> {
  return complete(apiKey, system, user, signal, endpoint);
}

/** Uses the configured endpoint, but intentionally does not preflight it. */
export async function verifyOpenAIKey(apiKey: string, endpoint = DEFAULT_OPENAI_ENDPOINT): Promise<void> {
  const response = await fetch(`${endpoint}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw await errorForResponse(response);
}

async function complete(
  apiKey: string,
  system: string,
  user: string | { type: string; [key: string]: unknown }[],
  signal: AbortSignal | undefined,
  endpoint: string,
): Promise<string> {
  const response = await request(`${endpoint}/chat/completions`, apiKey, {
    model: OPENAI_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }, signal);
  const body = await json<OpenAIResponse>(response);
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new VisionError('malformed', 'The response came back empty.');
  return text;
}

async function request(url: string, apiKey: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  try {
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) throw await errorForResponse(response);
    return response;
  } catch (error) {
    if (error instanceof VisionError) throw error;
    if (controller.signal.aborted) throw new VisionError(signal?.aborted ? 'cancelled' : 'timeout', signal?.aborted ? 'Estimate cancelled.' : 'The estimate timed out.');
    throw new VisionError('network', 'Could not reach the service.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

async function json<T>(response: Response): Promise<T> {
  try { return await response.json() as T; } catch { throw new VisionError('malformed', 'The response could not be read.'); }
}

async function errorForResponse(response: Response): Promise<VisionError> {
  const body: { error?: { code?: string; message?: string } } = await json<{ error?: { code?: string; message?: string } }>(response).catch(() => ({}));
  if (response.status === 401 || response.status === 403) return new VisionError('unauthorized', 'Your API key was rejected.');
  if (response.status === 429) return new VisionError(
    body.error?.code === 'insufficient_quota' ? 'billing' : 'rate_limited',
    body.error?.message ?? 'Rate limited.',
    retryAfterMs(response.headers),
  );
  if (response.status >= 500) return new VisionError('server', 'The service is unavailable.');
  return new VisionError('malformed', body.error?.message ?? `The request was rejected (${response.status}).`);
}
