import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const files = (paths: readonly string[]) => paths.map((path) => readFileSync(path, 'utf8')).join('\n');

describe('onboarding privacy boundary', () => {
  test('credentials have no profile, SQLite, export, analytics, or logging path', () => {
    const durableSinks = files([
      'src/db/schema.ts',
      'src/db/queries.ts',
      'src/logic/export.ts',
      'src/store/profileStore.ts',
    ]);
    expect(durableSinks).not.toMatch(/api[_-]?key|provider_api_key|anthropic_api_key/i);
  });

  test('sensitive scan evidence is absent from persistence and export schemas', () => {
    const schema = readFileSync('src/db/schema.ts', 'utf8');
    const start = schema.indexOf('CREATE TABLE body_measurements');
    const bodyMeasurements = schema.slice(start, schema.indexOf(');', start) + 2);
    expect(bodyMeasurements).not.toMatch(/photo_uri|report_uri|raw_response|unconfirmed_anchor|birth(?:day|_date)|confidence|review_issues/i);
    expect(readFileSync('src/logic/export.ts', 'utf8')).not.toMatch(/scanDraft|BodyCompositionScanDraft/);
  });

  test('the persisted onboarding profile contains age only, never a calendar tuple', () => {
    const profile = files(['src/store/profileStore.ts', 'src/types.ts']);
    expect(profile).not.toMatch(/birth(?:day|Date)|birthYear|birthMonth|birthDay/i);
    expect(profile).toMatch(/age/);
  });

  test('report evidence and return routing remain explicitly transient', () => {
    const onboarding = readFileSync('src/store/onboardingStore.ts', 'utf8');
    expect(onboarding).toContain('Held in memory only');
    expect(onboarding).toContain('Transient report evidence');
    expect(onboarding).not.toContain('persist(');
  });
});
