import { describe, expect, test } from 'vitest';

import { looksLikeApiKey, PROVIDERS, providerForKey } from '../src/api/keyStore';

describe('provider detection', () => {
  test('tests the Anthropic prefix before the OpenAI prefix', () => {
    expect(providerForKey(`sk-ant-${'a'.repeat(24)}`)).toBe('anthropic');
    expect(providerForKey(`sk-proj-${'a'.repeat(24)}`)).toBe('openai');
    expect(providerForKey(`sk-${'a'.repeat(24)}`)).toBe('openai');
  });

  test('accepts every registered provider and refuses unknown shapes', () => {
    expect(providerForKey(`AIza${'a'.repeat(24)}`)).toBe('gemini');
    expect(providerForKey('not-a-provider-key')).toBeNull();
    expect(looksLikeApiKey(`sk-ant-${'a'.repeat(24)}`)).toBe(true);
    expect(looksLikeApiKey('not-a-provider-key')).toBe(false);
    expect(Object.keys(PROVIDERS).sort()).toEqual(['anthropic', 'gemini', 'openai']);
  });
});
