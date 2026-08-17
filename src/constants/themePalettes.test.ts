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
    expect(resolveThemeId('test-lab')).toBe('test-lab');
    expect(resolveThemeId('coolors')).toBe('coolors');
    expect(resolveThemeId('midnight-organic')).toBe('midnight-organic');
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

  test('Soft Studio is an explicit opt-in palette with a distinct action colour', () => {
    expect(themePalettes['test-lab'].action).toBe('#8B6F8D');
    expect(themePalettes['test-lab'].action).not.toBe(themePalettes.organic.action);
  });

  test('Misted Mint keeps the softened palette in semantic roles', () => {
    expect(themePalettes.coolors).toMatchObject({
      ground: '#EEF5F3',
      surface: '#E2EFEC',
      action: '#9A6378',
      ink: '#313B3A',
    });
  });

  test('Midnight Organic keeps text and actions warm but readable on dark surfaces', () => {
    expect(themePalettes['midnight-organic']).toMatchObject({
      ground: '#1D211F', surface: '#272D2A', ink: '#F4F1EA', action: '#D08A68',
    });
  });
});
