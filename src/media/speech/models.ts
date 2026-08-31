/**
 * Speech models the user can download when the device's own recogniser cannot
 * serve their language.
 *
 * The product owner asked for Parakeet v3 as the fallback "in case Apple
 * Intelligence or Samsung's native alternative fails". Checking its model card
 * turned that into two entries rather than one: Parakeet TDT 0.6b v3 covers 25
 * European languages and **no Asian language at all**, and deep Asian
 * ingredient coverage is the thing Mise is differentiated on. Offering it to
 * someone who names their pantry in Cantonese would be offering a download that
 * cannot help them.
 *
 * So this is a registry keyed by language, and it answers "nothing available"
 * for a language nothing covers. That is a worse-sounding answer and a much
 * better one than a 487 MB download that transcribes 米粉 as noise.
 *
 * Every URL and byte size below was read from the GitHub release asset list of
 * `k2-fsa/sherpa-onnx` (tag `asr-models`), not from a README. The int8 builds
 * are the ones chosen: the fp16 Parakeet build is 1.1 GB, which is not a
 * download to offer someone standing in their kitchen.
 */

export interface SpeechModel {
  id: string;
  /** Shown to the user. The real name, so they can look it up. */
  name: string;
  /** Who published it, shown alongside the licence. */
  publisher: string;
  licence: string;
  /** BCP-47 primary subtags the model actually handles. */
  languages: readonly string[];
  /**
   * Download size in megabytes, read from the release asset itself.
   *
   * Never a figure from a README. A size shown before a download is a promise
   * about someone's data allowance, and these are large enough that the promise
   * matters: `describeDownload` leads with it rather than burying it.
   */
  sizeMb: number;
  /** The archive `downloadModel` fetches and unpacks. */
  url: string;
  /** The directory name the archive unpacks into. */
  directoryName: string;
  /** One line on what it is good for. */
  summary: string;
}

/**
 * The 25 European languages Parakeet TDT 0.6b v3 covers, per its model card.
 * Written out rather than summarised so the gap is visible at the call site.
 */
const PARAKEET_V3_LANGUAGES = [
  'bg', 'hr', 'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr', 'de', 'el', 'hu',
  'it', 'lv', 'lt', 'mt', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'es', 'sv', 'uk',
] as const;

/** SenseVoice covers the languages Parakeet v3 does not, for this app. */
const SENSE_VOICE_LANGUAGES = ['zh', 'yue', 'en', 'ja', 'ko'] as const;

const RELEASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models';

export const SPEECH_MODELS: readonly SpeechModel[] = [
  {
    id: 'parakeet-tdt-0.6b-v3',
    name: 'Parakeet TDT 0.6b v3',
    publisher: 'NVIDIA',
    licence: 'CC-BY-4.0',
    languages: PARAKEET_V3_LANGUAGES,
    sizeMb: 487,
    url: `${RELEASE}/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2`,
    directoryName: 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
    summary: '25 European languages, recognised entirely on this device.',
  },
  {
    id: 'sense-voice-small',
    name: 'SenseVoice Small',
    publisher: 'FunAudioLLM',
    licence: 'Apache-2.0',
    languages: SENSE_VOICE_LANGUAGES,
    sizeMb: 166,
    url: `${RELEASE}/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09.tar.bz2`,
    directoryName: 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09',
    summary: 'Chinese, Cantonese, Japanese, Korean, and English, on this device.',
  },
];

export function modelById(id: string): SpeechModel | null {
  return SPEECH_MODELS.find((model) => model.id === id) ?? null;
}

/** Whether a model handles a BCP-47 tag, comparing primary subtags only. */
export function modelCovers(model: SpeechModel, language: string): boolean {
  const primary = primarySubtag(language);
  if (primary === 'zh' || primary === 'yue') {
    // zh-Hant, zh-HK, and yue all land on the same acoustic model.
    return model.languages.includes('zh') || model.languages.includes('yue');
  }
  return model.languages.includes(primary);
}

export function primarySubtag(language: string): string {
  return language.toLowerCase().split(/[-_]/)[0] ?? language.toLowerCase();
}

/**
 * The model to offer for a language, or null when nothing covers it.
 *
 * Returning null is the important branch. Every alternative — offering the
 * biggest model, offering the first one, offering Parakeet because it is the
 * default — transcribes the user's speech with a model that has never seen
 * their language, and the result reaches the pantry as confident nonsense.
 */
export function modelForLanguage(language: string): SpeechModel | null {
  return SPEECH_MODELS.find((model) => modelCovers(model, language)) ?? null;
}

/** Every language any registered model can serve, for the language picker. */
export function downloadableLanguages(): string[] {
  return [...new Set(SPEECH_MODELS.flatMap((model) => model.languages))].sort();
}

export interface DownloadOffer {
  model: SpeechModel;
  /** The heading, naming the model rather than "a speech model". */
  title: string;
  /** The size, first, because it is the part that costs the user something. */
  size: string;
  /** Publisher and licence — what they are putting on their device. */
  detail: string;
  /** Why it is being offered, in terms of what just failed. */
  reason: string;
  /** The one thing that is easy to get wrong about a download this size. */
  caution: string;
}

/**
 * The offer shown when the device's own recogniser cannot serve a language.
 *
 * Names the model, its publisher, its licence, and its real size before
 * anything downloads, on the same principle as the provider disclosure: the
 * user is agreeing to put a specific artefact from a specific publisher on
 * their device, and "download a speech model" does not tell them what that is.
 *
 * Half a gigabyte is enough that the caution is not boilerplate. It is the
 * difference between a download someone starts deliberately on their own
 * network and one they discover on a mobile bill.
 */
export function describeDownload(
  language: string,
  languageName: string,
): DownloadOffer | null {
  const model = modelForLanguage(language);
  if (!model) return null;

  return {
    model,
    title: `Download ${model.name}`,
    size: `${model.sizeMb} MB`,
    detail: `From ${model.publisher}, licensed ${model.licence}. Stored on this device and used only here.`,
    reason: `This device cannot recognise ${languageName} on its own. This model runs entirely here — nothing is sent anywhere, before or after the download.`,
    caution:
      model.sizeMb >= 250
        ? 'This is a large download. Use Wi-Fi and leave Mise open while it runs.'
        : 'Use Wi-Fi if you can, and leave Mise open while it runs.',
  };
}

/**
 * What to say when no model covers the language.
 *
 * Kept as its own function so the honest answer has a home. The keyboard's own
 * dictation may still handle the language even when Mise has no model for it,
 * so this points there first rather than treating the language as unsupported.
 */
export function noModelMessage(languageName: string): string {
  return `Mise has no on-device speech model for ${languageName} yet. Your keyboard's microphone may still handle it, and typing always works.`;
}
