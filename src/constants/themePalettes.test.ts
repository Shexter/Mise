import { describe, expect, test } from 'vitest';

import {
  DEFAULT_THEME_ID,
  THEME_IDS,
  resolveThemeId,
  themePalettes,
} from '@/constants/themePalettes';
import { contrastRatio } from '@/logic/contrast';

const TINT_ROLES = ['tintPaprika', 'tintBlue', 'tintOlive', 'tintWheat'] as const;

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

  // The tints exist to group a row by meaning. A tint that cannot carry body
  // text is not a quieter tint, it is a broken row — so the floor is the same
  // 4.5:1 body-text ratio the rest of the app is held to, in every theme.
  test('body text clears 4.5:1 on every tint in every theme', () => {
    for (const themeId of THEME_IDS) {
      const palette = themePalettes[themeId];
      for (const role of TINT_ROLES) {
        const ratio = contrastRatio(palette[role], palette.ink);
        expect(ratio, `${themeId}/${role} under ink`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // The hero numeral is large text, which WCAG clears at 3:1, but it is the one
  // figure the whole screen is built around — hold it to the body-text ratio so
  // it stays readable in sunlight and at reduced brightness.
  test('the positive hero figure clears 4.5:1 on its own ground', () => {
    for (const themeId of THEME_IDS) {
      const palette = themePalettes[themeId];
      const ratio = contrastRatio(palette.ground, palette.positive);
      expect(ratio, `${themeId}/positive on ground`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // A meter's percentage renders in `measure`, so the fill colour has to clear
  // the body-text ratio on the surfaces a meter can sit on — not merely be
  // visible as a bar.
  test('the meter fill carries text on ground and on raised surfaces', () => {
    for (const themeId of THEME_IDS) {
      const { measure, ground, raised } = themePalettes[themeId];
      expect(contrastRatio(ground, measure), `${themeId}/measure on ground`)
        .toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(raised, measure), `${themeId}/measure on raised`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  // A nav bar that resolves to the same value as `ground` has no edge, and the
  // hairline is then the only thing separating it from content that scrolls
  // under it. Both have to be distinguishable for the bar to read as a bar.
  test('the nav bar is separable from the ground it sits on', () => {
    for (const themeId of THEME_IDS) {
      const { raised, raisedLine, ink } = themePalettes[themeId];
      expect(raised, `${themeId}/raised`).not.toBe(raisedLine);
      expect(
        contrastRatio(raised, ink),
        `${themeId}/ink on raised`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
