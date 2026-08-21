import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { FIELD_GUIDANCE, GUIDANCE_FIELDS } from '@/copy/fieldGuidance';
import {
  KEY_EXPLAINER,
  PROVIDER_GUIDANCE,
  PROVIDER_ORDER,
  RECOMMENDED_PROVIDER,
  REVIEWED_ON,
  sendConsentFor,
} from '@/copy/providerGuidance';

const explainer = readFileSync('src/components/onboarding/ApiKeyExplainer.tsx', 'utf8');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Everything a person reads during onboarding or while editing their profile. */
const AUDITED = [
  ...sourceFiles('app/onboarding'),
  ...sourceFiles('src/components/onboarding'),
  ...sourceFiles('src/copy'),
  'src/components/settings/ProfileSheet.tsx',
];

/** Prose only. A comment naming a rule is not a breach of it. */
function visibleCopy(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .toLowerCase();
}

describe('direct-to-provider disclosure', () => {
  test('the explainer states why, the reuse, the data path, and the manual way out', () => {
    for (const key of ['why', 'reuse', 'dataPath', 'manualAlways'] as const) {
      expect(KEY_EXPLAINER[key].length, key).toBeGreaterThan(60);
      expect(explainer, key).toContain(`KEY_EXPLAINER.${key}`);
    }
  });

  test('it says the image goes to the provider, and that their terms govern it', () => {
    const path = KEY_EXPLAINER.dataPath.toLowerCase();
    expect(path).toContain('sent to your chosen provider');
    expect(path).toContain('terms');
    expect(KEY_EXPLAINER.why.toLowerCase()).toContain('no server of its own');
  });

  test('nothing claims report reading happens on this device or via Mise', () => {
    const claims = [
      'never leaves your phone', 'never leaves this phone', 'stays entirely on',
      'entirely on-device', 'fully on-device', 'on-device extraction',
      'our servers', 'mise servers', 'we process', 'processed by mise',
    ];
    for (const path of AUDITED) {
      const copy = visibleCopy(readFileSync(path, 'utf8'));
      for (const claim of claims) {
        expect(copy, `${path}: ${claim}`).not.toContain(claim);
      }
    }
  });

  test('consent is repeated at the send action, naming the provider', () => {
    expect(sendConsentFor('gemini')).toContain('Google Gemini');
    expect(sendConsentFor('gemini')).toContain('Nothing is sent until you tap this');
    expect(sendConsentFor('anthropic')).toContain('Anthropic');
  });
});

describe('provider guidance is qualified and linkable', () => {
  test('every provider carries its own docs and pricing links', () => {
    for (const provider of PROVIDER_ORDER) {
      const guidance = PROVIDER_GUIDANCE[provider];
      for (const url of [guidance.docsUrl, guidance.pricingUrl, guidance.consoleUrl]) {
        expect(url, provider).toMatch(/^https:\/\//);
      }
    }
  });

  test('cost and setup claims are hedged and dated, never promised', () => {
    expect(REVIEWED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(explainer).toContain('REVIEWED_ON');
    const gemini = PROVIDER_GUIDANCE.gemini;
    expect(gemini.costNote.toLowerCase()).toContain('can change');
    expect(gemini.costNote.toLowerCase()).toContain('last checked');
    expect(gemini.setupNote.toLowerCase()).toContain('at the time of checking');

    const promises = ['free forever', 'always free', 'no cost', 'never pay', 'guaranteed', 'takes 2 minutes'];
    for (const provider of PROVIDER_ORDER) {
      const all = `${PROVIDER_GUIDANCE[provider].costNote} ${PROVIDER_GUIDANCE[provider].setupNote}`.toLowerCase();
      for (const promise of promises) {
        expect(all, `${provider}: ${promise}`).not.toContain(promise);
      }
    }
  });

  test('Gemini is suggested without hiding or disabling the others', () => {
    expect(RECOMMENDED_PROVIDER).toBe('gemini');
    expect(PROVIDER_ORDER).toContain('anthropic');
    expect(PROVIDER_ORDER).toContain('openai');
    // Every provider is rendered from the same list, with no filter.
    expect(explainer).toContain('PROVIDER_ORDER.map((provider)');
    expect(explainer).not.toMatch(/PROVIDER_ORDER\.filter/);
    expect(explainer).not.toMatch(/disabled=\{provider !== /);
    expect(KEY_EXPLAINER.recommendation.toLowerCase()).toContain('any supported provider works');
  });
});

describe('manual entry is offered as an equal', () => {
  test('the explainer gives both actions, and says manual reaches the same result', () => {
    expect(explainer).toContain('label="Set up an API key"');
    expect(explainer).toContain('label="Enter values manually"');
    expect(explainer).toContain('Same result, no account needed');
    expect(KEY_EXPLAINER.manualAlways.toLowerCase()).toContain('never need a key');
  });

  test('an unreadable key store is not reported as an absent key', () => {
    expect(explainer).toContain('That is not the same as not having one');
    expect(explainer).toContain('onRetry');
  });

  test('manual entry is reachable from every non-present state', () => {
    expect(explainer.slice(explainer.indexOf("status === 'checking'"), explainer.indexOf('const recommended')))
      .toContain('label="Enter values manually"');
    const branch = explainer.slice(explainer.indexOf("status === 'unavailable'"), explainer.indexOf('Choosing a provider'));
    expect(branch).toContain('label="Enter values manually"');
  });
});

describe('body language across onboarding and settings', () => {
  const FORBIDDEN = [
    'healthy weight', 'unhealthy', 'ideal weight', 'ideal range', 'athletic range',
    'average range', 'normal range', 'obese', 'overweight', 'underweight',
    'excellent range', 'body type', 'you should weigh', 'too heavy', 'too light',
  ];

  test.each(FORBIDDEN)('no onboarding or settings copy says %s', (term) => {
    for (const path of AUDITED) {
      expect(visibleCopy(readFileSync(path, 'utf8')), `${path}: ${term}`).not.toContain(term);
    }
  });

  test('body fat is framed as a calculation input rather than a score', () => {
    expect(FIELD_GUIDANCE['body-fat'].purpose).toContain('not a score');
    expect(FIELD_GUIDANCE['body-fat'].accepted.toLowerCase()).toContain('vary by age');
  });

  test('the formula question never presents itself as identity', () => {
    for (const field of GUIDANCE_FIELDS) {
      const all = Object.values(FIELD_GUIDANCE[field]).join(' ').toLowerCase();
      expect(all, field).not.toContain('gender');
    }
    expect(FIELD_GUIDANCE['formula-sex'].purpose).toContain('not a question about who you are');
  });
});
