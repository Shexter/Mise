import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { SPORTS, isSportId, sportLabel, sportsDailyBurn } from '@/constants/sports';
import { ACTIVITY_LEVELS } from '@/constants/activityLevels';
import { totalDailyEnergyExpenditure, totalDailyEnergyExpenditureWithSports } from '@/logic/bmr';

const GLYPHS: Record<string, number> = JSON.parse(
  readFileSync(
    'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json',
    'utf8',
  ),
);

describe('the sports catalogue', () => {
  test('every entry names a glyph the icon font actually ships', () => {
    const missing = SPORTS.filter((sport) => !(sport.icon in GLYPHS));
    expect(missing.map((sport) => `${sport.value}: ${sport.icon}`)).toEqual([]);
  });

  test('ids are unique and recognised', () => {
    const ids = SPORTS.map((sport) => sport.value);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(isSportId)).toBe(true);
    expect(isSportId('quidditch')).toBe(false);
    expect(isSportId('rowing')).toBe(true);
  });

  test('intensities stay inside the compendium range', () => {
    for (const sport of SPORTS) {
      expect(sport.met).toBeGreaterThan(1);
      expect(sport.met).toBeLessThan(15);
    }
  });

  test('labels resolve', () => {
    expect(sportLabel('pickleball')).toBe('Pickleball');
  });
});

describe('the sports burn estimate', () => {
  test('is zero until there is something to estimate from', () => {
    expect(sportsDailyBurn([], 'moderate', 70)).toBe(0);
    expect(sportsDailyBurn(['running'], null, 70)).toBe(0);
    expect(sportsDailyBurn(['running'], 'moderate', null)).toBe(0);
    expect(sportsDailyBurn(['running'], 'moderate', Number.NaN)).toBe(0);
    expect(sportsDailyBurn(['running'], 'moderate', -70)).toBe(0);
  });

  test('rises with intensity at a fixed frequency', () => {
    const yoga = sportsDailyBurn(['yoga'], 'moderate', 70);
    const running = sportsDailyBurn(['running'], 'moderate', 70);
    expect(running).toBeGreaterThan(yoga);
    expect(yoga).toBeGreaterThan(0);
  });

  test('rises with frequency at a fixed intensity', () => {
    const levels = ACTIVITY_LEVELS.map((level) =>
      sportsDailyBurn(['soccer'], level.value, 70),
    );
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]!).toBeGreaterThan(levels[i - 1]!);
    }
  });

  test('rises with body mass', () => {
    expect(sportsDailyBurn(['soccer'], 'active', 90)).toBeGreaterThan(
      sportsDailyBurn(['soccer'], 'active', 60),
    );
  });

  test('averages a mixed week rather than summing it', () => {
    const yoga = sportsDailyBurn(['yoga'], 'moderate', 70);
    const running = sportsDailyBurn(['running'], 'moderate', 70);
    const both = sportsDailyBurn(['yoga', 'running'], 'moderate', 70);
    expect(both).toBeCloseTo((yoga + running) / 2, 6);
    expect(both).toBeLessThan(running);
  });

  test('lands in a plausible daily range for a real profile', () => {
    // 80 kg, soccer, six-to-seven days a week.
    const burn = sportsDailyBurn(['soccer'], 'active', 80);
    expect(burn).toBeGreaterThan(300);
    expect(burn).toBeLessThan(700);
  });

  test('ignores unknown ids without collapsing the estimate', () => {
    const mixed = sportsDailyBurn(
      ['running', 'sepak-takraw' as never],
      'moderate',
      70,
    );
    expect(mixed).toBeCloseTo(sportsDailyBurn(['running'], 'moderate', 70), 6);
  });

  test('sport-enhanced TDEE preserves the baseline and adds the weekly sport burn', () => {
    const input = { sex: 'male' as const, age: 35, heightCm: 180, weightKg: 80 };
    const baseline = totalDailyEnergyExpenditure(input, 'moderate');
    expect(totalDailyEnergyExpenditureWithSports(input, 'moderate', [])).toBe(baseline);
    expect(totalDailyEnergyExpenditureWithSports(input, 'moderate', ['running']))
      .toBeCloseTo(baseline + sportsDailyBurn(['running'], 'moderate', 80), 8);
  });
});
