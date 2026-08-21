import { afterEach, expect, test, vi } from 'vitest';

import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_MODEL,
  estimateWithGemini,
} from '../src/api/gemini';

afterEach(() => vi.unstubAllGlobals());

test('uses the high-quota lite model and falls back after a rate limit', async () => {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input);
    urls.push(url);
    if (urls.length === 1) {
      return new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
        status: 429,
        headers: { 'retry-after': '1' },
      });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"mealName":"Rice","items":[]}' }] } }],
    }), { status: 200 });
  }));

  await expect(estimateWithGemini('key', 'base64')).resolves.toContain('Rice');
  expect(urls[0]).toContain(`/models/${GEMINI_MODEL}:generateContent`);
  expect(urls[1]).toContain(`/models/${GEMINI_FALLBACK_MODEL}:generateContent`);
});
