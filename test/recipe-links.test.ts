import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { clearApiKey, setApiKey } from '@/api/keyStore';
import { parseRecipeResponse } from '@/api/recipe';
import { getRecipe, insertRecipe, listRecipes, loadSeedData, updateRecipe } from '@/db/queries';
import {
  recipeIngredientsFromCapture,
  saveLinkAwaitingContent,
  saveRecipeFromCapture,
  saveRecipeFromText,
  sourceLinkFrom,
  splitSharedPayload,
} from '@/logic/recipeIntake';
import { openTestDatabase } from './stubs/db';

beforeEach(() => { openTestDatabase(); });

describe('saved recipe persistence', () => {
  test('keeps a source link and an intentionally missing quantity', async () => {
    const saved = await insertRecipe({
      title: 'Sesame noodles', sourceLink: 'https://example.com/recipe', steps: ['Mix.'],
      ingredients: [{ name: 'Sesame oil', quantity: null, unit: null, canonicalId: null }],
    });
    expect(saved.sourceLink).toBe('https://example.com/recipe');
    expect((await getRecipe(saved.id))?.ingredients[0]).toMatchObject({ name: 'Sesame oil', quantity: null });
    expect((await listRecipes()).map((recipe) => recipe.id)).toEqual([saved.id]);
  });

  test('editing ingredients retains the original source link', async () => {
    const saved = await insertRecipe({ title: 'Noodles', sourceLink: 'https://example.com/post' });
    const updated = await updateRecipe({ ...saved, title: 'Better noodles', ingredients: [] });
    expect(updated.sourceLink).toBe('https://example.com/post');
    expect((await getRecipe(saved.id))?.sourceLink).toBe('https://example.com/post');
  });
});

describe('recipe extraction parser', () => {
  test('keeps no quantity where the supplied recipe states none', () => {
    const parsed = parseRecipeResponse(JSON.stringify({
      is_recipe: true, title: 'Noodles',
      ingredients: [{ name: 'Sesame oil', quantity: null, unit: null }, { name: 'Noodles', quantity: 200, unit: 'g' }],
      steps: ['Mix.'],
    }));
    expect(parsed.ingredients).toEqual([
      { name: 'Sesame oil', quantity: null, unit: null },
      { name: 'Noodles', quantity: 200, unit: 'g' },
    ]);
  });

  test('reports non-recipe content instead of inventing a recipe', () => {
    expect(() => parseRecipeResponse('{"is_recipe":false}')).toThrow('No recipe was found');
  });
});

/* -------------------------------------------------------------------------- */
/* Task 3.5: the app never contacts the platform                               */
/* -------------------------------------------------------------------------- */

/**
 * The constraint the whole change is designed around, asserted rather than
 * trusted. Instagram and TikTok prohibit scraping, YouTube's API terms bind
 * anything using its API, and none of the three is compatible with an app
 * with no server and no accounts. So a link is a string Mise stores and
 * shows — never one it opens.
 *
 * These tests watch `fetch` itself rather than any one module, because the
 * failure they exist to catch is somebody later adding a "just fetch the
 * oEmbed title, it's only one request" convenience. Every request the save
 * path makes is inspected, and a platform host in any of them fails.
 */

const PLATFORM_HOSTS = [
  'instagram.com', 'www.instagram.com', 'graph.instagram.com',
  'tiktok.com', 'www.tiktok.com', 'open.tiktok.com', 'vm.tiktok.com',
  'youtube.com', 'www.youtube.com', 'youtu.be', 'youtubei.googleapis.com',
];

const PLATFORM_LINKS = [
  'https://www.instagram.com/reel/Cx1234abcd/',
  'https://www.tiktok.com/@cook/video/7300000000000000000',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ',
];

/** Hosts a request actually went to, so a failure names the offender. */
function requestedHosts(spy: ReturnType<typeof vi.fn>): string[] {
  return spy.mock.calls.map((call) => {
    const target = call[0];
    const href = typeof target === 'string' ? target : String((target as { url?: string })?.url ?? target);
    try {
      return new URL(href).host;
    } catch {
      return href;
    }
  });
}

function expectNoPlatformRequest(spy: ReturnType<typeof vi.fn>): void {
  for (const host of requestedHosts(spy)) {
    expect(PLATFORM_HOSTS, `a request was made to ${host}`).not.toContain(host);
    expect(host, `a request was made to ${host}`).not.toMatch(/instagram|tiktok|youtu/i);
  }
}

describe('no platform is ever contacted', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
    await clearApiKey();
    fetchSpy = vi.fn(async () => new Response(
      JSON.stringify({ content: [{ type: 'text', text: '{"is_recipe":false}' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  test.each(PLATFORM_LINKS)('saving the bare link %s makes no request at all', async (link) => {
    const recipe = await saveLinkAwaitingContent(link);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(recipe.sourceLink).toBe(link);
    expect(recipe.status).toBe('awaiting_content');
  });

  test('splitting a shared payload reads the link without resolving it', () => {
    const { link, content } = splitSharedPayload(
      'Best gochujang noodles https://www.tiktok.com/@cook/video/7300000000000000000 2 tbsp gochujang, 200g noodles',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(link).toBe('https://www.tiktok.com/@cook/video/7300000000000000000');
    expect(content).toContain('gochujang');
  });

  test.each(PLATFORM_LINKS)('processing a caption shared alongside %s reaches no platform host', async (link) => {
    await setApiKey('sk-ant-000000000000000000000000');
    const { link: parsed, content } = splitSharedPayload(`${link} 2 tbsp gochujang, 200 g noodles`);

    // The extraction itself is allowed to fail here — the assertion is about
    // where requests went, not whether the provider liked the payload.
    await saveRecipeFromText(content, parsed).catch(() => undefined);

    expectNoPlatformRequest(fetchSpy);
    for (const host of requestedHosts(fetchSpy)) {
      expect(host).toBe('api.anthropic.com');
    }
  });

  test('a screenshot-routed recipe keeps its platform link without requesting it', async () => {
    const link = 'https://www.instagram.com/reel/Cx1234abcd/';
    const result = await saveRecipeFromCapture({
      capture: {
        kind: 'items',
        items: [
          { name: 'Gochujang', quantity: 2, unit: 'tbsp' },
          { name: 'Sesame oil', quantity: null, unit: null },
        ],
      },
      imageUri: 'file://screenshot.jpg',
      link,
    });

    expectNoPlatformRequest(fetchSpy);
    expect(result.recipe.sourceLink).toBe(link);
    expect(result.recipe.imageUri).toBe('file://screenshot.jpg');
    expect(result.recipe.ingredients.map((ingredient) => ingredient.name))
      .toEqual(['Gochujang', 'Sesame oil']);
  });

  test('no module that can make a request names a platform host', async () => {
    const roots = ['src/api', 'src/logic', 'src/media', 'src/db'];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of await readdir(join(process.cwd(), root), { recursive: true })) {
        if (typeof file !== 'string' || !file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
        const source = await readFile(join(process.cwd(), root, file), 'utf8');
        // Comments are where the constraint is explained, so only real
        // string literals count as an attempt to reach a platform.
        const literals = source.match(/(['"`])[^'"`\n]*\1/g) ?? [];
        if (literals.some((literal) => /instagram\.com|tiktok\.com|youtube\.com|youtu\.be/i.test(literal))) {
          offenders.push(`${root}/${file}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Task 3.4: the screenshot route reuses the unified capture image path        */
/* -------------------------------------------------------------------------- */

/**
 * The screenshot case has no vision contract of its own. It takes whatever
 * `extractCapture` already returns for the pantry and reads it as an
 * ingredient list — so these tests are about the mapping, which is the only
 * new thing, and about the two results that are not a list.
 */
describe('routing a screenshot through the capture image path', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
    await clearApiKey();
  });

  test('an items capture becomes ingredients, quantities and all', () => {
    expect(recipeIngredientsFromCapture({
      kind: 'items',
      items: [
        { name: 'Gochujang', quantity: 2, unit: 'tbsp' },
        { name: 'Noodles', quantity: 200, unit: 'g' },
      ],
    })).toEqual([
      { name: 'Gochujang', quantity: 2, unit: 'tbsp', canonicalId: null },
      { name: 'Noodles', quantity: 200, unit: 'g', canonicalId: null },
    ]);
  });

  test('a written list read as a receipt still yields its food lines', () => {
    const ingredients = recipeIngredientsFromCapture({
      kind: 'receipt',
      receipt: {
        store: null, purchasedAt: '2026-08-19', receiptType: 'grocery',
        subtotalCents: null, taxCents: null, totalCents: null,
        lines: [
          { text: 'Gochujang', kind: 'food', qty: 2, unit: 'tbsp', quantityKind: 'measure', lineTotalCents: null, unitPriceCents: null, appliesToText: null },
          { text: 'TOTAL', kind: 'arithmetic', qty: null, unit: null, quantityKind: null, lineTotalCents: 500, unitPriceCents: null, appliesToText: null },
        ],
      },
    });

    expect(ingredients).toEqual([
      { name: 'Gochujang', quantity: 2, unit: 'tbsp', canonicalId: null },
    ]);
  });

  test.each(['nothing', 'unclear'] as const)('a %s capture yields no ingredients', (kind) => {
    expect(recipeIngredientsFromCapture({ kind })).toEqual([]);
  });

  test('an unreadable screenshot is kept as a recipe awaiting content, not discarded', async () => {
    const result = await saveRecipeFromCapture({
      capture: { kind: 'nothing' },
      imageUri: 'file://blurry.jpg',
      link: null,
    });

    expect(result.recipe.status).toBe('awaiting_content');
    expect(result.recipe.imageUri).toBe('file://blurry.jpg');
    expect((await getRecipe(result.recipe.id))?.imageUri).toBe('file://blurry.jpg');
  });

  test('an ingredient the matcher cannot place keeps its text and stays unresolved', async () => {
    const result = await saveRecipeFromCapture({
      capture: {
        kind: 'items',
        items: [{ name: 'Zzzqx paste', quantity: null, unit: null }],
      },
      imageUri: 'file://screenshot.jpg',
      link: null,
    });

    expect(result.recipe.status).toBe('ready');
    expect(result.recipe.ingredients[0]).toMatchObject({
      name: 'Zzzqx paste', quantity: null, canonicalId: null,
    });
  });
});

describe('reading a shared payload', () => {
  test('a payload with no link is all content', () => {
    expect(splitSharedPayload('2 tbsp gochujang, 200 g noodles')).toEqual({
      link: null, content: '2 tbsp gochujang, 200 g noodles',
    });
  });

  test('a bare link leaves no content behind', () => {
    const { link, content } = splitSharedPayload('  https://example.com/reel/1  ');
    expect(link).toBe('https://example.com/reel/1');
    expect(content).toBe('');
  });

  test('a non-http scheme is not treated as a source link', () => {
    expect(sourceLinkFrom('javascript:alert(1)')).toBeNull();
    expect(sourceLinkFrom('no link at all')).toBeNull();
  });
});
