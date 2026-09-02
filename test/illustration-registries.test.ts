import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
  APPLIANCE_ILLUSTRATIONS,
  GOAL_ILLUSTRATIONS,
  GOAL_ILLUSTRATION_BY_INTENT,
  GOAL_ILLUSTRATION_IDS,
} from '@/media/onboardingIllustrations';
import {
  ACTION_ILLUSTRATIONS,
  ACTION_ILLUSTRATION_IDS,
} from '@/media/actionIllustrations';
import {
  STATE_ILLUSTRATIONS,
  STATE_ILLUSTRATION_IDS,
} from '@/media/stateIllustrations';
import {
  TECHNIQUE_IDS,
  TECHNIQUE_ILLUSTRATIONS,
  TECHNIQUE_LABELS,
  TECHNIQUE_PHRASE_TABLES,
  isTechniqueId,
  normalizeStepText,
  resolveTechnique,
  type TechniqueId,
} from '@/media/techniqueIllustrations';
import { APPLIANCE_CATALOGUE } from '@/types';

const ASSET_DIR = 'assets/illustrations';

interface ManifestAsset {
  set: string;
  assetId: string;
  fileName: string;
  sourceModel: string;
  license: string;
  promptRecipe: string;
  seed: number;
  workflowVersion: string;
  reviewDate: string;
  reviewedBy: string;
  outputChecksum: string;
}

interface Manifest {
  schemaVersion: string;
  description: string;
  assets: Record<string, ManifestAsset>;
}

function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(ASSET_DIR, 'manifest.json'), 'utf8')) as Manifest;
}

function manifestIds(set: string): string[] {
  return Object.entries(readManifest().assets)
    .filter(([key]) => key.startsWith(`${set}/`))
    .map(([, meta]) => meta.assetId)
    .sort();
}

/**
 * Each registry against the set it draws from. Metro can only bundle static
 * literals, so these maps are generated rather than derived at runtime; the
 * parity checks below are what stop a promotion that wrote one and not the
 * other from shipping half an asset.
 */
const REGISTRIES: readonly { set: string; keys: readonly string[] }[] = [
  { set: 'appliance', keys: Object.keys(APPLIANCE_ILLUSTRATIONS) },
  { set: 'onboarding', keys: Object.keys(GOAL_ILLUSTRATIONS) },
  { set: 'state', keys: Object.keys(STATE_ILLUSTRATIONS) },
  { set: 'technique', keys: Object.keys(TECHNIQUE_ILLUSTRATIONS) },
  { set: 'action', keys: Object.keys(ACTION_ILLUSTRATIONS) },
];

describe('Bundled illustration provenance', () => {
  test('the manifest is well-formed and declares the schema it is validated against', () => {
    const manifest = readManifest();

    expect(manifest.schemaVersion).toBe('1.0.0');
    expect(manifest.description.length).toBeGreaterThan(0);
    expect(existsSync(join(ASSET_DIR, 'manifest.schema.json'))).toBe(true);
  });

  test('every promoted asset records complete, verified provenance', () => {
    const manifest = readManifest();
    expect(Object.keys(manifest.assets).length).toBeGreaterThan(0);

    for (const [key, meta] of Object.entries(manifest.assets)) {
      expect(key, key).toBe(`${meta.set}/${meta.assetId}`);
      expect(meta.fileName, key).toBe(`${meta.set}/${meta.assetId}.webp`);
      expect(meta.sourceModel?.length, key).toBeGreaterThan(0);
      expect(meta.license?.length, key).toBeGreaterThan(0);
      expect(meta.promptRecipe?.length, key).toBeGreaterThan(0);
      expect(Number.isInteger(meta.seed), key).toBe(true);
      expect(meta.workflowVersion?.length, key).toBeGreaterThan(0);
      expect(meta.reviewDate, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(meta.reviewedBy?.length, key).toBeGreaterThan(0);
      expect(meta.outputChecksum, key).toMatch(/^sha256:[0-9a-f]{64}$/);

      // Provenance is only worth recording if it describes the actual bytes.
      const filePath = join(ASSET_DIR, meta.fileName);
      expect(existsSync(filePath), filePath).toBe(true);
      const actual = createHash('sha256').update(readFileSync(filePath)).digest('hex');
      expect(`sha256:${actual}`, filePath).toBe(meta.outputChecksum);
    }
  });

  test('provenance names the locked recipe rather than a pipeline that did not run', () => {
    for (const meta of Object.values(readManifest().assets)) {
      expect(meta.sourceModel, meta.assetId).toContain('Draw Things CLI');
      expect(meta.sourceModel, meta.assetId).toContain('flux_2_klein_4b_q8p.ckpt');
      expect(meta.workflowVersion, meta.assetId).toBe('2.0.0');
    }
  });

  test.each(REGISTRIES)('the $set manifest and require registry cannot drift apart', ({ set, keys }) => {
    expect([...keys].sort()).toEqual(manifestIds(set));
  });

  test('no image ships from assets/illustrations without a provenance entry', () => {
    const declared = Object.values(readManifest().assets).map((meta) => meta.fileName);
    const onDisk = readdirSync(ASSET_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((dir) =>
        readdirSync(join(ASSET_DIR, dir.name))
          .filter((name) => /\.(png|webp|jpg|jpeg)$/i.test(name))
          .map((name) => `${dir.name}/${name}`),
      );

    expect(onDisk.sort()).toEqual(declared.sort());
  });

  test('every appliance in the catalogue has artwork, and no orphan does', () => {
    expect(Object.keys(APPLIANCE_ILLUSTRATIONS).sort()).toEqual(
      APPLIANCE_CATALOGUE.map((appliance) => appliance.id).sort(),
    );
  });

  test('the goal and state registries cover exactly their approved roles', () => {
    expect(Object.keys(GOAL_ILLUSTRATIONS).sort()).toEqual([...GOAL_ILLUSTRATION_IDS].sort());
    expect(Object.keys(STATE_ILLUSTRATIONS).sort()).toEqual([...STATE_ILLUSTRATION_IDS].sort());
    expect(Object.values(GOAL_ILLUSTRATION_BY_INTENT).sort()).toEqual(
      [...GOAL_ILLUSTRATION_IDS].sort(),
    );
  });

  test('the action registry covers exactly the ways into Mise', () => {
    expect(Object.keys(ACTION_ILLUSTRATIONS).sort()).toEqual([...ACTION_ILLUSTRATION_IDS].sort());
  });

  test('the technique registry covers exactly the bounded vocabulary', () => {
    expect(Object.keys(TECHNIQUE_ILLUSTRATIONS).sort()).toEqual([...TECHNIQUE_IDS].sort());
    expect(Object.keys(TECHNIQUE_LABELS).sort()).toEqual([...TECHNIQUE_IDS].sort());
  });

  test('staging is never a runtime dependency', () => {
    const modules = [
      'src/media/foodVisuals.ts',
      'src/media/onboardingIllustrations.ts',
      'src/media/stateIllustrations.ts',
      'src/media/techniqueIllustrations.ts',
      'src/media/actionIllustrations.ts',
      'src/components/AddSheet.tsx',
      'src/components/StateIllustration.tsx',
      'src/components/TechniqueIllustration.tsx',
      'app/onboarding/goals.tsx',
      'app/onboarding/appliances.tsx',
      'app/recipe/[id].tsx',
      'metro.config.js',
    ];

    for (const path of modules) {
      expect(readFileSync(path, 'utf8'), path).not.toContain('.art-staging');
    }
  });

  test('screens read artwork from a registry rather than requiring assets themselves', () => {
    const screens = [
      'app/onboarding/goals.tsx',
      'app/onboarding/appliances.tsx',
      'app/recipe/[id].tsx',
      'app/(tabs)/pantry.tsx',
      'app/(tabs)/index.tsx',
      'app/dinner.tsx',
      'app/pantry-capture-review.tsx',
      'src/components/StateIllustration.tsx',
      'src/components/TechniqueIllustration.tsx',
      'src/components/AddSheet.tsx',
    ];

    for (const path of screens) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/require\(["'].*assets\//);
    }
  });
});

describe('Technique matching', () => {
  test('an explicitly stored technique id wins outright', () => {
    // Stored intent beats inference, and the text is not consulted at all.
    expect(resolveTechnique({ techniqueId: 'steam', instruction: 'Chop the onions.' })).toBe('steam');
  });

  test('an unrecognised stored id is ignored rather than trusted', () => {
    expect(resolveTechnique({ techniqueId: 'flambe', instruction: 'Simmer for 20 minutes.' })).toBe(
      'simmer',
    );
    expect(resolveTechnique({ techniqueId: 'flambe', instruction: 'Combine everything.' })).toBeNull();
  });

  test.each([
    ['Chop the onions finely.', 'chop'],
    ['Slice the mushrooms.', 'chop'],
    ['Sauté the garlic until fragrant.', 'saute'],
    ['Stir-fry the beef for two minutes.', 'saute'],
    ['Boil the kettle.', 'boil'],
    ['Roast at 200C.', 'roast'],
    ['Steam the buns.', 'steam'],
    ['Simmer for 20 minutes.', 'simmer'],
    ['Marinate overnight.', 'marinate'],
    ['Blend until smooth.', 'blend'],
    ['Bake for 25 minutes.', 'bake'],
    ['Grill the fish skin-side down.', 'grill'],
    ['Rest the meat before carving.', 'rest'],
    ['Serve with steamed rice.', 'serve'],
  ] as const)('%s leads with a recognised verb', (instruction, expected) => {
    expect(resolveTechnique({ instruction })).toBe(expected);
  });

  test('a leading adverbial is skipped to reach the real verb', () => {
    expect(resolveTechnique({ instruction: 'Then simmer for 10 minutes.' })).toBe('simmer');
    expect(resolveTechnique({ instruction: 'Meanwhile, chop the parsley.' })).toBe('chop');
    expect(resolveTechnique({ instruction: 'Gently fry the shallots.' })).toBe('saute');
  });

  test('a step spanning two techniques gets none, rather than the first one mentioned', () => {
    // "Add the chopped tomatoes and simmer" is a simmer step, not a chop step.
    // Picking either would misdescribe it, so the step stays text.
    expect(
      resolveTechnique({ instruction: 'Bring the water to a boil, then add the pasta and simmer.' }),
    ).toBeNull();
    expect(resolveTechnique({ instruction: 'Cover and simmer, then serve hot.' })).toBeNull();
  });

  test('an ingredient adjective is not a technique the step performs', () => {
    // "marinated pork" describes what went into the pan, not what this step
    // does, so `marinate` carries no mid-sentence phrase for it to match. The
    // step is a grill step and gets the grill.
    expect(
      resolveTechnique({ instruction: 'Add the marinated pork and grill for six minutes.' }),
    ).toBe('grill');
    expect(
      resolveTechnique({ instruction: 'Add the chopped tomatoes and simmer gently.' }),
    ).toBe('simmer');
  });

  test('a single mid-sentence mention is enough when it is the only one', () => {
    expect(resolveTechnique({ instruction: 'Cover and simmer for 20 minutes.' })).toBe('simmer');
    expect(resolveTechnique({ instruction: 'Let the meat rest for 10 minutes.' })).toBe('rest');
    expect(resolveTechnique({ instruction: 'Divide between bowls and serve.' })).toBe('serve');
  });

  test.each([
    'Add the rest of the sauce to the pan.',
    'Whisk in the baking powder and a pinch of salt.',
    'Line a baking tray with parchment.',
    'This makes 340 kcal per serving.',
    'Preheat the oven.',
    'Season generously with salt and pepper.',
    'Combine everything in a large bowl.',
    '',
    '   ',
  ])('no illustration is invented for %j', (instruction) => {
    expect(resolveTechnique({ instruction })).toBeNull();
  });

  test('matching is deterministic and insensitive to case, accents, and punctuation', () => {
    const variants = ['Sauté the onions', 'saute the onions', 'SAUTE  THE  ONIONS!', 'Sauté-the-onions'];
    for (const instruction of variants) {
      expect(resolveTechnique({ instruction }), instruction).toBe('saute');
    }

    const step = 'Simmer for 20 minutes.';
    expect(resolveTechnique({ instruction: step })).toBe(resolveTechnique({ instruction: step }));
  });

  test('normalisation collapses everything that is not a letter or a digit', () => {
    expect(normalizeStepText('  Stir-fry: 2 mins!  ')).toBe('stir fry 2 mins');
    expect(normalizeStepText('Sauté')).toBe('saute');
  });

  test('isTechniqueId only accepts the bounded vocabulary', () => {
    expect(isTechniqueId('chop')).toBe(true);
    expect(isTechniqueId('flambe')).toBe(false);
    expect(isTechniqueId(null)).toBe(false);
    expect(isTechniqueId(7)).toBe(false);
  });

  test('no phrase is claimed by two techniques, so a match is never arbitrary', () => {
    const owner = new Map<string, TechniqueId>();
    for (const table of [TECHNIQUE_PHRASE_TABLES.verbs, TECHNIQUE_PHRASE_TABLES.mentions]) {
      for (const id of TECHNIQUE_IDS) {
        for (const phrase of table[id]) {
          const existing = owner.get(phrase);
          expect(existing === undefined || existing === id, `${phrase} (${existing} vs ${id})`).toBe(
            true,
          );
          owner.set(phrase, id);
        }
      }
    }
  });

  test('every phrase is already normalised, so it can actually be matched', () => {
    for (const table of [TECHNIQUE_PHRASE_TABLES.verbs, TECHNIQUE_PHRASE_TABLES.mentions]) {
      for (const id of TECHNIQUE_IDS) {
        for (const phrase of table[id]) {
          expect(normalizeStepText(phrase), `${id}: ${phrase}`).toBe(phrase);
        }
      }
    }
  });

  test('a realistic method resolves several steps and leaves the rest as text', () => {
    const method = [
      'Chop the onion, carrot and celery.',
      'Heat a splash of oil in a heavy pan.',
      'Sauté the vegetables until softened.',
      'Add the tomatoes and season well.',
      'Simmer for 40 minutes, stirring now and then.',
      'Serve with crusty bread.',
    ];

    expect(method.map((instruction) => resolveTechnique({ instruction }))).toEqual([
      'chop',
      null,
      'saute',
      null,
      'simmer',
      'serve',
    ]);
  });
});
