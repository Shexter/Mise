import { beforeEach, describe, expect, test } from 'vitest';

import {
  createDietaryRule,
  getProfile,
  insertCanonicalItem,
  listDietaryRules,
} from '@/db/queries';
import { openTestDatabase } from './stubs/db';

describe('Dietary preferences without profile', () => {
  beforeEach(() => openTestDatabase());

  test('dietary rules can be created, listed, and persist when profile is null', async () => {
    // Profile is empty
    const profile = await getProfile();
    expect(profile).toBeNull();

    // Insert canonical item
    await insertCanonicalItem({
      id: 'peanuts',
      displayName: 'Peanuts',
      foodClass: 'staple',
      defaultLocation: 'pantry',
      shelfLifeDays: { pantry: 180 },
      openLifeDays: null,
      typicalUseQty: 30,
      typicalUseUnit: 'g',
    });

    // Create dietary rule with canonical item
    const rule = await createDietaryRule({
      kind: 'allergen',
      canonicalId: 'peanuts',
      text: 'No peanuts',
      normalisedText: 'peanuts',
    });

    // Create free-text dietary rule without canonical item
    const freeTextRule = await createDietaryRule({
      kind: 'restriction',
      canonicalId: null,
      text: 'No pork',
      normalisedText: 'pork',
    });

    expect(rule.id).toBeDefined();
    expect(rule.kind).toBe('allergen');
    expect(freeTextRule.id).toBeDefined();

    // List rules
    const rules = await listDietaryRules();
    expect(rules).toHaveLength(2);
    expect(rules.map((r) => r.text)).toContain('No peanuts');
    expect(rules.map((r) => r.text)).toContain('No pork');

    // Profile remains strictly null; no placeholder body measurements or profile were created
    const profileAfter = await getProfile();
    expect(profileAfter).toBeNull();
  });
});
