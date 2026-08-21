import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const energy = readFileSync('app/onboarding/energy.tsx', 'utf8');
const layout = readFileSync('app/_layout.tsx', 'utf8');

describe('onboarding database guard', () => {
  test('measurement reads and final save are gated on shared readiness', () => {
    expect(energy).toContain("if (dbReadiness.phase !== 'ready' || !measured");
    expect(energy).toContain("if (dbReadiness.phase !== 'ready' || !valid || saving) return");
    expect(energy.indexOf("dbReadiness.phase !== 'ready'")).toBeLessThan(energy.indexOf('getBodyMeasurements().then'));
  });

  test('root navigation is not mounted while storage is opening or unavailable', () => {
    expect(layout).toContain("readiness.phase !== 'opening'");
    expect(layout).toContain("readiness.phase === 'unavailable'");
    expect(layout).not.toContain('Promise.race');
  });
});
