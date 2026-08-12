import { describe, expect, test } from 'vitest';

import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  resolveThemeId,
  themePalettes,
} from '@/constants/themePalettes';

describe('theme palettes', () => {
  test('Organic is the default and invalid preferences fall back to it', () => {
    expect(DEFAULT_THEME_ID).toBe('organic');
    expect(resolveThemeId('utility')).toBe('utility');
    expect(resolveThemeId('cool-organic')).toBe('cool-organic');
    expect(resolveThemeId('unknown')).toBe('organic');
    expect(resolveThemeId(null)).toBe('organic');
  });

  test('every theme exposes the same semantic colour roles', () => {
    const expectedRoles = Object.keys(themePalettes.organic).sort();

    for (const themeId of THEME_IDS) {
      expect(Object.keys(themePalettes[themeId]).sort()).toEqual(expectedRoles);
    }
  });

  test('reduced-warmth Organic keeps its cream and terracotta identity', () => {
    expect(themePalettes.organic).toMatchObject({
      ground: '#F3EDE4',
      surface: '#EBE3D8',
      action: '#A95A35',
      olive: '#74825F',
    });
    expect(themePalettes.organic).not.toEqual(themePalettes['cool-organic']);
  });
});
