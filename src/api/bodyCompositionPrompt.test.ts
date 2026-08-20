import { describe, expect, test } from 'vitest';

import { VisionError } from '@/api/errors';
import {
  BODY_COMPOSITION_SCHEMA_KEYS,
  buildBodyCompositionPrompt,
  parseBodyCompositionResponse,
} from '@/api/bodyCompositionPrompt';

describe('buildBodyCompositionPrompt', () => {
  test('declares the exact response fields and no date field', () => {
    const { system } = buildBodyCompositionPrompt();
    for (const key of BODY_COMPOSITION_SCHEMA_KEYS) {
      expect(system).toContain(`"${key}"`);
    }
    expect(BODY_COMPOSITION_SCHEMA_KEYS).toEqual([
      'provider', 'weightKg', 'bodyFatPct', 'leanTissueKg',
      'boneMineralContentKg', 'fatFreeMassKg', 'bmrKcal', 'confidence',
    ]);
    expect(system).toContain('Date is not part of this schema');
    expect(system).not.toContain('"date":');
  });

  test('forbids invention, derivation, wrong provider cues, and body evaluation', () => {
    const prompt = buildBodyCompositionPrompt();
    const text = `${prompt.system}\n${prompt.user}`;
    expect(text).toMatch(/Never invent/i);
    expect(text).toMatch(/Do not derive Fat Free Mass/i);
    expect(text).toMatch(/Skeletal Muscle Mass.*not substitutes/i);
    expect(text).toMatch(/Never infer the provider from a route/i);
    expect(text).toMatch(/Return masses as kilograms/i);
    expect(text).toMatch(/Do not repeat names, member IDs, birth dates/i);
    expect(text).toMatch(/Do not return scores, visceral fat/i);
    expect(text).toMatch(/Use null for every missing/i);
  });
});

describe('parseBodyCompositionResponse', () => {
  test('parses a realistic DEXA response', () => {
    expect(parseBodyCompositionResponse(JSON.stringify({
      provider: 'dexa',
      weightKg: 82.4,
      bodyFatPct: 21.7,
      leanTissueKg: 61.8,
      boneMineralContentKg: 3.1,
      fatFreeMassKg: null,
      bmrKcal: null,
      confidence: 'high',
    }))).toEqual({
      provider: 'dexa',
      weightKg: 82.4,
      bodyFatPct: 21.7,
      leanTissueKg: 61.8,
      boneMineralContentKg: 3.1,
      fatFreeMassKg: null,
      bmrKcal: null,
      confidence: 'high',
    });
  });

  test('parses fenced InBody JSON and preserves defensive unit strings', () => {
    const parsed = parseBodyCompositionResponse(`Analysis:\n\`\`\`json
      {"provider":"INBODY","weightKg":"154 lb","bodyFatPct":null,"leanTissueKg":null,"boneMineralContentKg":null,"fatFreeMassKg":"58.2 kg","bmrKcal":"1512 kcal","confidence":"medium"}
    \`\`\``);
    expect(parsed).toEqual({
      provider: 'inbody',
      weightKg: '154 lb',
      bodyFatPct: null,
      leanTissueKg: null,
      boneMineralContentKg: null,
      fatFreeMassKg: '58.2 kg',
      bmrKcal: '1512 kcal',
      confidence: 'medium',
    });
  });

  test('uses defensive fallbacks and ignores unknown keys', () => {
    expect(parseBodyCompositionResponse(JSON.stringify({
      provider: 'bathroom-scale',
      weightKg: {},
      bodyFatPct: '',
      confidence: 'certain',
      patientName: 'Must not escape',
      score: 99,
    }))).toEqual({
      provider: 'unknown',
      weightKg: null,
      bodyFatPct: null,
      leanTissueKg: null,
      boneMineralContentKg: null,
      fatFreeMassKg: null,
      bmrKcal: null,
      confidence: 'low',
    });
  });

  test('returns a complete nullable shape for an empty object', () => {
    expect(parseBodyCompositionResponse('{}')).toEqual({
      provider: 'unknown',
      weightKg: null,
      bodyFatPct: null,
      leanTissueKg: null,
      boneMineralContentKg: null,
      fatFreeMassKg: null,
      bmrKcal: null,
      confidence: 'low',
    });
  });

  test.each(['', 'not json', '[]', 'null', '42', '"text"'])('rejects malformed root %j', (raw) => {
    let error: unknown;
    try {
      parseBodyCompositionResponse(raw);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(VisionError);
    expect(error).toMatchObject({ kind: 'malformed' });
    expect((error as Error).message).not.toContain(raw || 'empty');
  });
});
