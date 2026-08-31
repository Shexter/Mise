import { keyboardDictationAdapter } from '@/media/speech/adapters/keyboard';
import { createLocalModelAdapter, type InstalledModels } from '@/media/speech/adapters/localModel';
import { nativeRecognitionAdapter } from '@/media/speech/adapters/native';
import { installedModels } from '@/media/speech/modelStore';
import { selectRoute, type RouteCandidate, type TranscriptionRoute } from '@/media/speech/routing';

export { keyboardDictationAdapter, KEYBOARD_START_HINT } from '@/media/speech/adapters/keyboard';
export { nativeRecognitionAdapter } from '@/media/speech/adapters/native';
export {
  createLocalModelAdapter,
  hasLocalRuntime,
  localModelAdapter,
  MAX_SESSION_SECONDS,
} from '@/media/speech/adapters/localModel';
export { createCloudAdapter } from '@/media/speech/adapters/cloud';
export * from '@/media/speech/models';
export * from '@/media/speech/modelStore';
export * from '@/media/speech/routing';
export * from '@/media/speech/session';
export * from '@/media/speech/types';
export { deleteAudio, newAudioPath, purgeAllAudio } from '@/media/speech/audio';

/**
 * The ladder, in order, with cloud deliberately absent.
 *
 *   1. **The platform's own recogniser**, because it is the best experience
 *      when it works and costs the user nothing.
 *   2. **A downloaded model**, but only once it is actually installed.
 *   3. **The keyboard's microphone**, which is always there.
 *
 * The downloaded model sits *above* the keyboard, which is not the order this
 * started in. The keyboard reports itself available unconditionally — it has to,
 * since Mise cannot see which languages someone's keyboard handles — so putting
 * it second meant a model the user had deliberately waited 487 MB for could
 * never be selected. A verified match on the language beats an unverifiable one.
 *
 * The keyboard remains the floor, and remains the answer whenever nothing above
 * it can serve the language.
 */
export async function resolveTranscriptionRoute(
  language: string,
  languageName: string,
  models: InstalledModels = installedModels,
): Promise<TranscriptionRoute> {
  const adapters = [
    nativeRecognitionAdapter,
    createLocalModelAdapter(models),
    keyboardDictationAdapter,
  ];

  const candidates: RouteCandidate[] = [];
  for (const adapter of adapters) {
    candidates.push({ adapter, availability: await adapter.isAvailable(language) });
  }
  return selectRoute(candidates, language, languageName);
}

/**
 * Recognition languages offered in the picker.
 *
 * Shown and chosen explicitly rather than taken from the app's UI language:
 * someone runs Mise in English and names their pantry in Cantonese, and
 * switching the recogniser under them without saying so is the silent language
 * change the spec forbids.
 */
export const RECOGNITION_LANGUAGES: readonly { tag: string; name: string }[] = [
  { tag: 'en-US', name: 'English (US)' },
  { tag: 'en-GB', name: 'English (UK)' },
  { tag: 'zh-Hans', name: '简体中文' },
  { tag: 'zh-Hant', name: '繁體中文' },
  { tag: 'yue-HK', name: '廣東話' },
  { tag: 'ja-JP', name: '日本語' },
  { tag: 'ko-KR', name: '한국어' },
  { tag: 'es-ES', name: 'Español' },
  { tag: 'fr-FR', name: 'Français' },
  { tag: 'de-DE', name: 'Deutsch' },
  { tag: 'it-IT', name: 'Italiano' },
  { tag: 'pt-PT', name: 'Português' },
  { tag: 'nl-NL', name: 'Nederlands' },
  { tag: 'id-ID', name: 'Bahasa Indonesia' },
  { tag: 'ms-MY', name: 'Bahasa Melayu' },
  { tag: 'th-TH', name: 'ไทย' },
  { tag: 'vi-VN', name: 'Tiếng Việt' },
];

export function languageName(tag: string): string {
  return RECOGNITION_LANGUAGES.find((entry) => entry.tag === tag)?.name ?? tag;
}
