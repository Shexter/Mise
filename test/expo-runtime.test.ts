import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('Expo development runtime', () => {
  test('contains the Android keep-awake lifecycle rejection', () => {
    const metro = readFileSync('metro.config.js', 'utf8');
    const shim = readFileSync('src/shims/expoKeepAwake.ts', 'utf8');

    expect(metro).toContain("moduleName === 'expo-keep-awake'");
    expect(metro).toContain('src/shims/expoKeepAwake.ts');
    expect(shim).toContain('activateKeepAwakeAsync(activeTag)');
    expect(shim).toMatch(/activateKeepAwakeAsync\(activeTag\)[\s\S]*?\.catch\(\(\) =>/);
    expect(shim).toMatch(/deactivateKeepAwake\(activeTag\)\.catch\(\(\) =>/);
  });
});
