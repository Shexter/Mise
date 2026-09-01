import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * The only module that touches provider credentials.
 *
 * The key lives in the device Keychain / Keystore via `expo-secure-store`. It is
 * never written to SQLite, never put in a Zustand store, never logged, and never
 * included in the JSON export. Everything else in the app asks for it here, at
 * call time, and lets it go immediately.
 *
 * There are two ways a key gets in:
 *
 *   1. The user pastes it — during onboarding or in Settings. This is the path
 *      that matters for anyone running a published build.
 *   2. `MISE_DEV_API_KEY` in a local `.env`, surfaced only when
 *      `MISE_BUNDLE_DEV_API_KEY=true` explicitly opts into bundling it through
 *      `app.config.ts` (see `.env.example`). On first launch it is copied into
 *      secure storage once and never read again.
 */

const STORAGE_KEY = 'provider_api_key';
const LEGACY_STORAGE_KEY = 'anthropic_api_key';
const SEEDED_FLAG = 'anthropic_api_key_seeded';
const OPENAI_ENDPOINT_KEY = 'openai_endpoint';
const GEMINI_MODEL_PREFERENCE_KEY = 'gemini_model_preference';

/** Base URL for OpenAI-compatible chat and model endpoints. */
export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1';

export type Provider = 'anthropic' | 'gemini' | 'openai';

export const GEMINI_MODELS = [
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    benefit: 'Fast · up to 500 requests/day',
    quotaBadge: '500 RPD',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    benefit: 'Balanced · up to 500 requests/day',
    quotaBadge: '500 RPD',
  },
  {
    id: 'gemma-4-31b',
    label: 'Gemma 4 31B',
    benefit: 'Massive quota · up to 14,400 requests/day',
    quotaBadge: '14.4k RPD',
  },
] as const;

export type GeminiModel = typeof GEMINI_MODELS[number]['id'];
export const DEFAULT_GEMINI_MODEL: GeminiModel = 'gemini-3.1-flash-lite';

export interface ProviderMeta {
  displayName: string;
  keyPattern: RegExp;
  specificity: number;
  keyFormat: string;
  consoleUrl: string;
  freeTier: boolean;
  billingLocation: string;
}

/** One provider record drives detection, key-entry copy, and error copy. */
export const PROVIDERS: Record<Provider, ProviderMeta> = {
  anthropic: {
    displayName: 'Anthropic', keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    specificity: 7, keyFormat: 'sk-ant-…',
    consoleUrl: 'https://console.anthropic.com/settings/keys', freeTier: false,
    billingLocation: 'console.anthropic.com under Plans & Billing',
  },
  openai: {
    displayName: 'OpenAI', keyPattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    specificity: 3, keyFormat: 'sk-…',
    consoleUrl: 'https://platform.openai.com/api-keys', freeTier: false,
    billingLocation: 'platform.openai.com',
  },
  gemini: {
    displayName: 'Google Gemini', keyPattern: /^(AIza|AQ\.)[A-Za-z0-9_.\-]{10,}$/,
    specificity: 4, keyFormat: 'AIza… or AQ.…',
    consoleUrl: 'https://aistudio.google.com/apikey', freeTier: true,
    billingLocation: 'Google AI Studio',
  },
};

function bundledDevKey(): string | null {
  const value = Constants.expoConfig?.extra?.['devApiKey'];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

async function secureGet(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (isWeb) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/**
 * Syncs the `.env` key (`MISE_DEV_API_KEY`, via app.config.ts) into
 * secure storage. When present it is treated as authoritative and written on
 * every launch, so an explicitly opted-in development build "just works" with
 * no onboarding key step. Release builds leave the bundling opt-in false —
 * users then supply their own key in-app, and this is a no-op.
 *
 * `SEEDED_FLAG` is still cleared/kept only for backwards compatibility with
 * older installs; the env key now wins whenever it is set.
 */
export async function seedFromEnvironment(): Promise<void> {
  const devKey = bundledDevKey();
  if (!devKey) return;

  const existing = await getApiKey();
  if (existing !== devKey) {
    await secureSet(STORAGE_KEY, devKey);
  }
  await secureSet(SEEDED_FLAG, 'true');
}

export async function getApiKey(): Promise<string | null> {
  const key = await secureGet(STORAGE_KEY);
  if (key) return key;
  const legacy = await secureGet(LEGACY_STORAGE_KEY);
  if (!legacy) return null;
  await secureSet(STORAGE_KEY, legacy);
  await secureDelete(LEGACY_STORAGE_KEY);
  return legacy;
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey()) !== null;
}

export async function setApiKey(value: string): Promise<void> {
  await secureSet(STORAGE_KEY, value.trim());
}

export async function clearApiKey(): Promise<void> {
  await secureDelete(STORAGE_KEY);
  await secureDelete(LEGACY_STORAGE_KEY);
}

/** An optional OpenAI-compatible endpoint. It stays in secure storage with the
 * key and is never persisted with app data. No request is made to validate it. */
export async function getOpenAIEndpoint(): Promise<string> {
  return (await secureGet(OPENAI_ENDPOINT_KEY)) ?? DEFAULT_OPENAI_ENDPOINT;
}

export async function setOpenAIEndpoint(value: string): Promise<void> {
  const endpoint = value.trim().replace(/\/+$/, '');
  if (endpoint) await secureSet(OPENAI_ENDPOINT_KEY, endpoint);
  else await secureDelete(OPENAI_ENDPOINT_KEY);
}

export async function clearOpenAIEndpoint(): Promise<void> {
  await secureDelete(OPENAI_ENDPOINT_KEY);
}

export async function getGeminiModelPreference(): Promise<GeminiModel> {
  const stored = await secureGet(GEMINI_MODEL_PREFERENCE_KEY);
  return GEMINI_MODELS.some((model) => model.id === stored)
    ? stored as GeminiModel
    : DEFAULT_GEMINI_MODEL;
}

export async function setGeminiModelPreference(model: GeminiModel): Promise<void> {
  if (!GEMINI_MODELS.some((option) => option.id === model)) return;
  await secureSet(GEMINI_MODEL_PREFERENCE_KEY, model);
}

export async function getConfiguredProvider(): Promise<Provider | null> {
  const key = await getApiKey();
  return key ? providerForKey(key) : null;
}

/** `sk-ant-…4f2a` — enough to recognise a key, not enough to use one. */
export function maskKey(value: string): string {
  if (value.length <= 12) return '••••••••';
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

export async function maskedApiKey(): Promise<string | null> {
  const key = await getApiKey();
  return key ? maskKey(key) : null;
}

/**
 * Which service a key belongs to, inferred from its prefix. Anthropic keys
 * start with `sk-ant-`; OpenAI keys start with `sk-`; Google AI keys use
 * either the `AIza` or `AQ.` prefix.
 */
export function providerForKey(value: string): Provider | null {
  const trimmed = value.trim();
  return (Object.entries(PROVIDERS) as [Provider, ProviderMeta][])
    .sort(([, left], [, right]) => right.specificity - left.specificity)
    .find(([, meta]) => meta.keyPattern.test(trimmed))?.[0] ?? null;
}

/**
 * Shape check only. A real check costs a request — see `verifyApiKey` in
 * `src/api/vision.ts`. Accepts both an Anthropic key (`sk-ant-…`) and a Google
 * AI key (`AIza…` or the newer `AQ.…` form), and OpenAI-compatible keys
 * beginning with `sk-`.
 */
export function looksLikeApiKey(value: string): boolean {
  return providerForKey(value) !== null;
}
