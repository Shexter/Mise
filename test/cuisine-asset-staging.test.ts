import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { cuisineFilters } from '@/logic/cuisines';
import { CUISINE_ILLUSTRATIONS } from '@/media/cuisineIllustrations';
import { inventory, SET_TARGETS } from '../scripts/asset-inventory';

const manifest = () => JSON.parse(readFileSync('assets/illustrations/manifest.json', 'utf8'));
const cuisineKeys = () => Object.keys(manifest().assets).filter((key) => key.startsWith('cuisine/'));

describe('Cuisine artwork, accepted and shipped', () => {
  test('the previously accepted five-cuisine pack remains shipped together', () => {
    const expected = ['chinese', 'international', 'italian', 'japanese', 'mediterranean'];
    expect(Object.keys(CUISINE_ILLUSTRATIONS).sort()).toEqual(expected);
    expect(cuisineKeys().map((key) => key.slice('cuisine/'.length)).sort()).toEqual(expected);
    expect(readdirSync('assets/illustrations/cuisine')
      .filter((name) => /\.webp$/.test(name))
      .map((name) => name.replace(/\.webp$/, ''))
      .sort()).toEqual(expected);
    // A half-shipped accepted asset is the failure this inventory catches.
    for (const slot of inventory().filter(
      (slot) => slot.set === 'cuisine' && expected.includes(slot.id),
    )) {
      expect(slot.status, slot.id).toBe('done');
    }
  });

  test('every shipped cuisine is one the reviewed recipes actually support', () => {
    // One direction only, and deliberately. Artwork must not outrun the
    // recipes; recipes are free to outrun the artwork, which is exactly where
    // Korean sits after nine reviewed recipes established coverage and before
    // its staged tile receives named human acceptance.
    const supported = new Set(cuisineFilters().map((filter) => filter.id));
    for (const id of Object.keys(CUISINE_ILLUSTRATIONS)) {
      expect(supported.has(id), id).toBe(true);
    }
    expect(supported.has('korean')).toBe(true);
    expect(CUISINE_ILLUSTRATIONS.korean).toBeUndefined();
    // The concept art's other cuisines still have no recipes and no artwork.
    for (const absent of ['thai', 'vietnamese']) {
      expect(supported.has(absent), absent).toBe(false);
      expect(CUISINE_ILLUSTRATIONS[absent], absent).toBeUndefined();
    }
  });

  test('acceptance is recorded as a person, on the bytes that shipped', () => {
    for (const key of cuisineKeys()) {
      const meta = manifest().assets[key];
      expect(meta.reviewedBy, key).toBe('Timothy Lauw');
      expect(meta.reviewDate, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(meta.workflowVersion, key).toBe('2.0.0');
      expect(meta.sourceModel, key).toContain('flux_2_klein_4b_q8p.ckpt');
    }
  });

  test('the rail still has a labelled path for a cuisine with no artwork', () => {
    // A sixth cuisine can be added by a recipe long before anyone paints it.
    // `cuisines.ts` reads the recipes, the registry never gates the filter, and
    // the tile falls back to an initial under its real label.
    const rail = readFileSync('src/components/planner/CuisineRail.tsx', 'utf8');
    expect(rail).toContain('label.slice(0, 1).toUpperCase()');
    expect(readFileSync('src/logic/cuisines.ts', 'utf8')).not.toContain('cuisineIllustration');
    expect(readFileSync('src/media/cuisineIllustrations.ts', 'utf8')).not.toContain('PLANNER_CATALOGUE');
  });

  test('promotion still refuses to invent an approval', () => {
    const before = readFileSync('assets/illustrations/manifest.json', 'utf8');
    expect(() => execFileSync(process.execPath, [
      'node_modules/tsx/dist/cli.mjs', 'scripts/generate-illustrations.ts',
      '--set', 'cuisine', '--promote', 'chinese',
    ], { stdio: 'pipe' })).toThrow(/--reviewer is required/);
    // And an id with no reviewed recipe coverage cannot be shipped by naming it.
    expect(() => execFileSync(process.execPath, [
      'node_modules/tsx/dist/cli.mjs', 'scripts/generate-illustrations.ts',
      '--set', 'cuisine', '--promote', 'thai', '--reviewer', 'TEST-NOT-AN-APPROVAL',
    ], { stdio: 'pipe' })).toThrow(/thai is not a known cuisine slot/);
    expect(readFileSync('assets/illustrations/manifest.json', 'utf8')).toBe(before);
  });

  test('cuisine art uses the existing dish style and stays out of the food manifest', () => {
    const briefs = JSON.parse(readFileSync('assets/illustration-briefs.json', 'utf8'));
    expect(briefs.style.suffixBySet.cuisine).toBe(briefs.style.suffixBySet.dish);
    expect(briefs.workflowVersion).toBe('2.0.0');
    expect(SET_TARGETS.cuisine.manifestKey('chinese')).toBe('cuisine/chinese');
    expect(SET_TARGETS.cuisine.manifest).toBe('assets/illustrations/manifest.json');
    expect(Object.keys(briefs.sets.cuisine.subjects)).toContain('korean');
    // `All` is a drawn control, so it never becomes a generated asset.
    expect(Object.keys(briefs.sets.cuisine.subjects)).not.toContain('all');
  });

  test('the staging directory is never a runtime dependency', () => {
    expect(existsSync('.art-staging')).toBe(true);
    for (const path of [
      'src/media/cuisineIllustrations.ts',
      'src/media/plannerRecipeVisuals.ts',
      'src/components/planner/CuisineRail.tsx',
      'app/plan/picker.tsx',
    ]) {
      expect(readFileSync(path, 'utf8'), path).not.toContain('.art-staging');
    }
  });
});
