import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { mealSavedMessage, pantryItemsAddedMessage } from '@/logic/feedback';

const toast = readFileSync('src/components/Toast.tsx', 'utf8');
const dayRail = readFileSync('src/components/DayRail.tsx', 'utf8');
const mealCapture = readFileSync('app/capture.tsx', 'utf8');
const pantryCapture = readFileSync('app/pantry-capture.tsx', 'utf8');

describe('premium interaction boundaries', () => {
  test('confirmation copy is derived from completed local records only', () => {
    expect(mealSavedMessage(['Rice'])).toContain('Rice updated');
    expect(mealSavedMessage([])).not.toMatch(/pantry|quantity|estimate/i);
    expect(pantryItemsAddedMessage(2)).not.toMatch(/g|ml|estimate|quantity/i);
  });

  test('capture polish adds no tracking or network transport path', () => {
    for (const source of [mealCapture, pantryCapture]) {
      expect(source).not.toContain('getCurrentPositionAsync');
      expect(source).not.toContain('watchPositionAsync');
      expect(source).not.toContain('fetch(');
    }
  });

  test('changed feedback motion is centralized in existing motion primitives', () => {
    expect(toast).toContain('useReducedMotion');
    expect(toast).toContain('duration.quick');
    expect(toast).not.toContain('FadeInDown.duration(180)');
    expect(dayRail).toContain('useReducedMotion');
    expect(dayRail).toContain('duration.reduced');
  });
});
