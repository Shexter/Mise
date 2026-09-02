import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const config = readFileSync('app.config.ts', 'utf8');
const processing = readFileSync('src/components/ProcessingIndicator.tsx', 'utf8');
const stateIllustration = readFileSync('src/components/StateIllustration.tsx', 'utf8');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('brand asset and component contracts', () => {
  test('Expo points at the selected untouched PNG collection', () => {
    const iosLight = './assets/brand/icon-concepts/dark-glass/mise-icon-dark-glass-navy-sage.png';
    const iosDark = './assets/brand/icon-concepts/dark-glass/mise-icon-dark-glass-monochrome.png';
    const android = './assets/brand/icon-concepts/light-organic/mise-icon-light-organic-sage-orange.png';

    for (const asset of [iosLight, iosDark, android]) {
      expect(existsSync(asset.slice(2))).toBe(true);
      expect(config).toContain(asset);
    }
    expect(config).not.toMatch(/tinted\s*:/);
    expect(config).not.toMatch(/monochromeImage\s*:/);
  });

  test('food analysis has one semantic, reduced-motion processing primitive', () => {
    expect(processing).toContain('macroColor.protein');
    expect(processing).toContain('macroColor.carbs');
    expect(processing).toContain('macroColor.fat');
    expect(processing).toContain('useReducedMotion');
    expect(processing).toContain('accessibilityState={{ busy: true }}');
    expect(processing).toContain('accessibilityLabel={label}');

    for (const route of [
      'app/capture.tsx',
      'app/review.tsx',
      'app/receipt-capture.tsx',
      'app/pantry-capture.tsx',
    ]) {
      const source = readFileSync(route, 'utf8');
      // Either shared primitive is fine — both announce themselves as busy
      // and both honour reduced motion. A bare ActivityIndicator does neither.
      expect(source, route).toMatch(/<(ProcessingIndicator|ReviewSkeleton|ReceiptReviewSkeleton|MealSuggestionSkeleton)/);
      expect(source, route).not.toContain('<ActivityIndicator');
    }
  });

  test('screens and components do not introduce raw colour or font values', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('src')]
      .filter((path) => ![
        'src/constants/theme.ts',
        'src/constants/themePalettes.ts',
        'src/constants/themePalettes.test.ts',
      ].includes(path));

    for (const path of files) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\s*\(/i);
      expect(source, path).not.toMatch(/fontFamily\s*:\s*['"]/);
      expect(source, path).not.toMatch(/borderRadius\s*:\s*999\b/);
    }
  });

  test('themes share semantic roles and screens do not fork by theme', () => {
    const paletteSource = readFileSync('src/constants/themePalettes.ts', 'utf8');
    const preferenceSource = readFileSync('src/constants/themePreference.ts', 'utf8');
    const settingsSource = readFileSync('app/(tabs)/settings.tsx', 'utf8');
    const themeSheetSource = readFileSync('src/components/settings/ThemeSheet.tsx', 'utf8');

    expect(paletteSource).toContain("DEFAULT_THEME_ID: ThemeId = 'organic'");
    expect(preferenceSource).toContain('getItemSync');
    expect(preferenceSource).toContain('setItemSync');
    expect(settingsSource).toContain('<ThemeSheet');
    expect(themeSheetSource).toContain('reloadAppAsync');

    const themedUi = [...sourceFiles('app'), ...sourceFiles('src/components')]
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(themedUi).not.toMatch(/themeId\s*===|switch\s*\(\s*themeId/);
  });

  test('primary brand surfaces inherit shared tokens without changing their task flow', () => {
    const surfaces = [
      'app/(tabs)/index.tsx',
      'app/(tabs)/pantry.tsx',
      'app/capture.tsx',
      'app/review.tsx',
      'app/recipes.tsx',
      'app/onboarding/welcome.tsx',
      'app/(tabs)/settings.tsx',
    ];

    for (const path of surfaces) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).toMatch(/@\/components\//);
      expect(source, path).not.toMatch(/themeId\s*===|switch\s*\(\s*themeId/);
    }

    expect(readFileSync('app/capture.tsx', 'utf8')).toContain('<CameraView');
    expect(readFileSync('app/review.tsx', 'utf8')).toContain('resizeMode="cover"');
  });

  test('brand trust copy distinguishes local storage from provider analysis', () => {
    const welcome = readFileSync('app/onboarding/welcome.tsx', 'utf8');
    const settings = readFileSync('app/(tabs)/settings.tsx', 'utf8');

    expect(welcome).toContain('no Mise account or server');
    // The welcome copy was rewritten around the daily target
    // (improve-onboarding-cohesion-and-scan-intake, task 7.1). The boundary it
    // has to draw is unchanged: the diary is local, and only something the
    // person chooses to analyse is sent to their own provider.
    expect(welcome).toContain('you choose to analyse is sent to the provider');
    expect(settings).toContain('stored on this device');
    expect(settings).toContain('configured provider');
    expect(`${welcome}\n${settings}`).not.toContain('Everything stays on this phone');
  });

  test('the approved empty-Pantry illustration is static, semantic, and accessible', () => {
    const pantry = readFileSync('app/(tabs)/pantry.tsx', 'utf8');

    expect(stateIllustration).toContain('EmptyPantryIllustration');
    expect(stateIllustration).toContain('accessibilityRole="image"');
    expect(stateIllustration).toContain('accessibilityLabel={accessibilityLabel}');
    expect(stateIllustration).toContain('color.olive');
    // `connect-generated-illustrations` added the image-backed variant, so the
    // file now holds an `<Image>`. What this assertion protects is unchanged:
    // the artwork is static, so reduced motion needs no alternate rendering.
    expect(stateIllustration).not.toMatch(/Animated|useReducedMotion/);
    // And it degrades rather than breaking — a bundled image that fails to load
    // falls back to the procedural shelf instead of a broken-image box.
    expect(stateIllustration).toContain('STATE_ILLUSTRATIONS');
    expect(stateIllustration).toContain('onError');
    expect(pantry).toContain('<StateIllustration');
    expect(pantry).toContain('name="empty-pantry"');
    expect(pantry).toContain("Add what's already in your kitchen, or let a receipt do it.");
  });
});
