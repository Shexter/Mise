import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../src/api/suggest', () => ({
  generateSuggestions: vi.fn(),
}));
vi.mock('../src/api/keyStore', () => ({
  hasApiKey: vi.fn(),
}));

import { generateSuggestions } from '../src/api/suggest';
import { hasApiKey } from '../src/api/keyStore';
import { loadSeedData } from '../src/db/queries';
import { getOrGenerateSuggestions } from '../src/logic/suggestionService';
import { localDateString } from '../src/logic/dates';
import type { Suggestion } from '../src/types';
import { openTestDatabase } from './stubs/db';

/**
 * The cache-or-generate decision in `suggestionService.ts`: reuse when
 * nothing material has changed, regenerate when it has, and only an
 * explicit refresh spends a call outside that rule (decision 40).
 */

const FAKE_SUGGESTION: Suggestion = {
  dish: 'Test stir-fry',
  reasons: [{ kind: 'clears_stock', label: 'clears an expiring item' }],
  kcalPerServing: 400,
  servings: 2,
  effortMinutes: 15,
  uses: [{ canonicalId: 'soy-sauce', qty: 10, unit: 'ml' }],
  missing: [],
  method: [],
};

beforeEach(async () => {
  openTestDatabase();
  await loadSeedData();
  vi.mocked(generateSuggestions).mockReset();
  vi.mocked(hasApiKey).mockReset();
  vi.mocked(generateSuggestions).mockResolvedValue({
    suggestions: [FAKE_SUGGESTION],
    shortfall: null,
  });
});

describe('getOrGenerateSuggestions caching', () => {
  test('generates and caches on a cold cache', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();

    const result = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.fromCache).toBe(false);
      expect(result.set.suggestions[0]?.dish).toBe('Test stir-fry');
    }
    expect(generateSuggestions).toHaveBeenCalledTimes(1);
  });

  test('reopening the surface with nothing changed makes no request', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();

    const first = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(first.status).toBe('ready');
    expect(generateSuggestions).toHaveBeenCalledTimes(1);

    const second = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(second.status).toBe('ready');
    if (second.status === 'ready') {
      expect(second.fromCache).toBe(true);
    }
    // Still just the one call from the first, cold-cache request.
    expect(generateSuggestions).toHaveBeenCalledTimes(1);
  });

  test('an explicit refresh spends a call even though nothing changed', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(true);
    const localDate = localDateString();

    await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(generateSuggestions).toHaveBeenCalledTimes(1);

    const refreshed = await getOrGenerateSuggestions({
      localDate,
      mode: 'tonight',
      forceRefresh: true,
    });
    expect(refreshed.status).toBe('ready');
    expect(generateSuggestions).toHaveBeenCalledTimes(2);
  });

  test('no key and no cache reports no_key without ever calling the model', async () => {
    vi.mocked(hasApiKey).mockResolvedValue(false);
    const localDate = localDateString();

    const result = await getOrGenerateSuggestions({ localDate, mode: 'tonight' });
    expect(result.status).toBe('no_key');
    expect(generateSuggestions).not.toHaveBeenCalled();
  });
});
