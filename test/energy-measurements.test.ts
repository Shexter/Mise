import { beforeEach, describe, expect, test } from 'vitest';

import { getBodyMeasurements, saveBodyMeasurement } from '../src/db/queries';
import { openTestDatabase } from './stubs/db';

beforeEach(() => openTestDatabase());

describe('body measurements', () => {
  test('replaces only the same provider and retains the other provider', async () => {
    await saveBodyMeasurement({ provider: 'inbody', weightKg: 80, measuredAt: '2026-01-01', bodyFatPct: null, leanTissueKg: null, boneMineralContentKg: null, fatFreeMassKg: 62 });
    await saveBodyMeasurement({ provider: 'dexa', weightKg: 80, measuredAt: '2026-02-01', bodyFatPct: 20, leanTissueKg: null, boneMineralContentKg: null, fatFreeMassKg: 64 });
    await saveBodyMeasurement({ provider: 'dexa', weightKg: 79, measuredAt: '2026-03-01', bodyFatPct: 19, leanTissueKg: null, boneMineralContentKg: null, fatFreeMassKg: 64 });
    expect(await getBodyMeasurements()).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'inbody', fatFreeMassKg: 62 }),
      expect.objectContaining({ provider: 'dexa', weightKg: 79 }),
    ]));
  });
});
