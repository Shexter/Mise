import { beforeEach, describe, expect, test } from 'vitest';

import {
  enqueueMatch,
  getAllCanonicals,
  getBestAliasByNorm,
  getMatchQueue,
  getProductByBarcode,
  insertCanonicalItem,
  insertProduct,
  loadSeedData,
  recordUserResolution,
} from '../src/db/queries';
import { openTestDatabase, resetTestDatabase } from './stubs/db';

/**
 * Mirrors *Settings → Delete all data*: `resetDatabase` runs `DROP_ALL`,
 * re-migrates, and reloads the seed — so a wiped install holds exactly the
 * shipped seed set and nothing the user taught it.
 */
describe('delete all data', () => {
  beforeEach(async () => {
    openTestDatabase();
    await loadSeedData();
  });

  test('clears the identity tables and a relaunch reloads only the seed set', async () => {
    const seedCount = (await getAllCanonicals()).length;

    // The user teaches the app things the wipe must forget.
    await recordUserResolution('MY WEIRD LABEL', 'miso');
    await insertProduct({
      gtin: '999',
      name: 'Some SKU',
      canonicalId: 'miso',
      source: 'user',
    });
    await enqueueMatch({ rawText: 'UNPLACED THING', source: 'receipt' });
    await insertCanonicalItem({
      id: 'my-custom-thing',
      displayName: 'My custom thing',
      foodClass: 'condiment',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 100 },
    });

    // Delete all data, then the next launch's init path.
    resetTestDatabase();
    await loadSeedData();

    const canonicals = await getAllCanonicals();
    expect(canonicals.length).toBe(seedCount);
    expect(canonicals.every((item) => item.isSeed)).toBe(true);
    expect(canonicals.find((item) => item.id === 'my-custom-thing')).toBeUndefined();
    expect(await getBestAliasByNorm('my weird label')).toBeNull();
    expect(await getProductByBarcode('999')).toBeNull();
    expect(await getMatchQueue()).toEqual([]);
  });
});
