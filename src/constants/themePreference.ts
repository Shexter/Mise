import Storage from 'expo-sqlite/kv-store';

import { DEFAULT_THEME_ID, resolveThemeId, type ThemeId } from '@/constants/themePalettes';

const THEME_STORAGE_KEY = 'mise.appearance.theme';

/** Synchronous by design: static React Native styles read the palette at import time. */
export function readThemePreference(): ThemeId {
  try {
    return resolveThemeId(Storage.getItemSync(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function writeThemePreference(themeId: ThemeId): void {
  Storage.setItemSync(THEME_STORAGE_KEY, themeId);
}
