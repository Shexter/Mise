import { PROVIDERS, type Provider } from '@/api/keyStore';

/**
 * Everything Mise says about third-party providers, in one file.
 *
 * Three rules hold here, and `test/onboarding-copy.test.ts` enforces them:
 *
 * 1. Anything that can change without warning — price, free allowance, setup
 *    time, data handling — is attributed and dated, never stated as fact.
 *    `REVIEWED_ON` is when a person last checked these against the provider's
 *    own pages; it is not a claim about today.
 * 2. Gemini may be recommended for having the shortest documented path to a
 *    working key. Anthropic and OpenAI stay visible and selectable.
 * 3. Nothing here says or implies that report extraction happens on-device or
 *    passes through a Mise server. It does neither.
 */

/** The date a person last checked these statements against provider docs. */
export const REVIEWED_ON = '2026-08-20';

export interface ProviderGuidance {
  provider: Provider;
  displayName: string;
  /** Where a key is actually created. */
  consoleUrl: string;
  /** The provider's own getting-started page. */
  docsUrl: string;
  /** The provider's own current pricing and limits page. */
  pricingUrl: string;
  /** Attributed, dated, and hedged. Never a promise. */
  costNote: string;
  setupNote: string;
}

export const PROVIDER_GUIDANCE: Record<Provider, ProviderGuidance> = {
  gemini: {
    provider: 'gemini',
    displayName: PROVIDERS.gemini.displayName,
    consoleUrl: PROVIDERS.gemini.consoleUrl,
    docsUrl: 'https://ai.google.dev/gemini-api/docs/get-started',
    pricingUrl: 'https://ai.google.dev/pricing',
    costNote:
      'Google documented a free tier for the Gemini API when this was last checked. Free allowances and prices are set by Google and can change — check their pricing page for what applies now.',
    setupNote:
      'Usually the shortest path: sign in to Google AI Studio and create a key on the page linked below. No card was required at the time of checking.',
  },
  anthropic: {
    provider: 'anthropic',
    displayName: PROVIDERS.anthropic.displayName,
    consoleUrl: PROVIDERS.anthropic.consoleUrl,
    docsUrl: 'https://docs.anthropic.com/en/api/getting-started',
    pricingUrl: 'https://www.anthropic.com/pricing',
    costNote:
      'Anthropic bills API use per request. Current rates are on their pricing page.',
    setupNote: 'Create a key in the Anthropic Console. Billing is set up in the same place.',
  },
  openai: {
    provider: 'openai',
    displayName: PROVIDERS.openai.displayName,
    consoleUrl: PROVIDERS.openai.consoleUrl,
    docsUrl: 'https://platform.openai.com/docs/quickstart',
    pricingUrl: 'https://openai.com/api/pricing/',
    costNote: 'OpenAI bills API use per request. Current rates are on their pricing page.',
    setupNote: 'Create a key on the OpenAI platform. Billing is set up in the same place.',
  },
};

/** Recommended for setup friction only — never presented as the sole option. */
export const RECOMMENDED_PROVIDER: Provider = 'gemini';

export const PROVIDER_ORDER: readonly Provider[] = ['gemini', 'anthropic', 'openai'];

/**
 * The disclosure shown wherever a report can be sent. It has to be exact:
 * the photo leaves the device, it goes straight to the provider whose key the
 * person supplied, and Mise is not in the middle of it.
 */
export const KEY_EXPLAINER = {
  why:
    'Reading a DEXA or InBody report needs a vision model, and Mise has no server of its own. It uses an API key you create with a provider, and the request goes from this phone straight to them.',
  reuse:
    'The same key is reused later for photo meal logging and calorie estimates, so this is a one-time setup rather than a per-feature one.',
  dataPath:
    'When you tap to read a report, the image is sent to your chosen provider. Their terms and data-handling policies apply to it, not Mise\'s. Nothing else on this device is sent, and Mise keeps no copy of the report.',
  manualAlways:
    'You never need a key to continue. Typing the values in yourself takes a minute and reaches exactly the same result.',
  recommendation:
    'Any supported provider works. Gemini is suggested first only because it had the shortest documented setup when this was last checked.',
} as const;

/** Repeated beside the send action, so consent is given at the moment it matters. */
export const SEND_CONSENT =
  'This sends the selected report image to {provider}. Their terms apply. Nothing is sent until you tap this.';

export function sendConsentFor(provider: Provider): string {
  return SEND_CONSENT.replace('{provider}', PROVIDERS[provider].displayName);
}
