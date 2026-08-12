import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const checklist = readFileSync('docs/owner-app-test-checklist.md', 'utf8');
const prose = checklist.replace(/\s+/g, ' ');

describe('premium real-device acceptance matrix', () => {
  it('covers Today progressive disclosure on both supported platforms', () => {
    expect(checklist).toContain('### Today and nutrition-detail matrix');
    expect(checklist).toContain('supported iOS device');
    expect(checklist).toContain('supported Android device');
    expect(checklist).toContain('must not display the unknown contribution as zero');
    expect(prose).toContain('the previously selected Today date remains selected');
    expect(checklist).toContain('VoiceOver or TalkBack');
  });

  it('covers every configurable chart and report boundary', () => {
    expect(checklist).toContain('### Nutrition Analytics chart and report matrix');
    for (const phrase of [
      '7-day, 30-day, 90-day, and custom ranges',
      'daily and weekly grouping',
      'bar and line forms',
      'recorded target',
      'sparse history',
      'Organic, Utility, and Cool-Organic',
      'Reduce Motion',
      'ordered value table',
    ]) expect(prose).toContain(phrase);
  });

  it('keeps Stock and Recipes acceptance separate and accessible', () => {
    expect(checklist).toContain('### Pantry Stock and Recipes matrix');
    expect(checklist).toContain('pending work stays scoped to Stock');
    expect(checklist).toContain('Test empty Stock with populated Recipes');
    expect(checklist).toContain('hidden subsection actions');
    expect(checklist).toContain('Organic, Utility, and Cool-Organic');
  });
});
