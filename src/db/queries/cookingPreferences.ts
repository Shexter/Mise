import { db } from '@/db';
import { isApplianceId, MEAL_PREP_STATUSES, ONBOARDING_INTENTS } from '@/types';
import type { ApplianceId, CookingPreferences, OwnedAppliance } from '@/types';

const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
import {
  type CookingPreferencesRow,
  type OwnedApplianceRow,
  toCookingPreferences,
  toOwnedAppliance,
} from './types';

/* -------------------------------------------------------------------------- */
/* Cooking preferences                                                        */
/* -------------------------------------------------------------------------- */

export async function getCookingPreferences(): Promise<CookingPreferences | null> {
  const row = await db().getFirstAsync<CookingPreferencesRow>(
    'SELECT * FROM cooking_preferences WHERE id = 1',
  );
  return row ? toCookingPreferences(row) : null;
}

export async function saveCookingPreferences(prefs: CookingPreferences): Promise<void> {
  // Validate intents and status
  const validIntents = prefs.intents.filter((intent) =>
    (ONBOARDING_INTENTS as readonly string[]).includes(intent),
  );
  if (!MEAL_PREP_STATUSES.includes(prefs.mealPrepStatus)) {
    throw new Error(`Invalid mealPrepStatus: ${prefs.mealPrepStatus}`);
  }

  const intentsJson = JSON.stringify(validIntents);
  await db().runAsync(
    `INSERT INTO cooking_preferences (
       id, intents, meal_prep_status, created_at, updated_at, completed_at, deferred_at
     ) VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       intents = excluded.intents,
       meal_prep_status = excluded.meal_prep_status,
       updated_at = excluded.updated_at,
       completed_at = excluded.completed_at,
       deferred_at = excluded.deferred_at`,
    [
      intentsJson,
      prefs.mealPrepStatus,
      prefs.createdAt,
      prefs.updatedAt,
      prefs.completedAt,
      prefs.deferredAt,
    ],
  );
}

/* -------------------------------------------------------------------------- */
/* Owned appliances                                                           */
/* -------------------------------------------------------------------------- */

export async function getOwnedAppliances(): Promise<OwnedAppliance[]> {
  const rows = await db().getAllAsync<OwnedApplianceRow>(
    'SELECT * FROM owned_appliances ORDER BY appliance_id ASC',
  );
  const result: OwnedAppliance[] = [];
  for (const row of rows) {
    const item = toOwnedAppliance(row);
    if (item) result.push(item);
  }
  return result;
}

export async function getOwnedApplianceIds(): Promise<Set<ApplianceId>> {
  const rows = await db().getAllAsync<OwnedApplianceRow>(
    'SELECT * FROM owned_appliances WHERE owned = 1',
  );
  const result = new Set<ApplianceId>();
  for (const row of rows) {
    if (isApplianceId(row.appliance_id)) {
      result.add(row.appliance_id);
    }
  }
  return result;
}

export async function setApplianceOwnership(
  applianceId: ApplianceId,
  owned: boolean,
  updatedAt: string = new Date().toISOString(),
): Promise<void> {
  if (!isApplianceId(applianceId)) {
    throw new Error(`Invalid appliance ID: ${applianceId}`);
  }
  await db().runAsync(
    `INSERT INTO owned_appliances (appliance_id, owned, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(appliance_id) DO UPDATE SET
       owned = excluded.owned,
       updated_at = excluded.updated_at`,
    [applianceId, owned ? 1 : 0, updatedAt],
  );
}

export async function saveOwnedAppliances(
  appliances: readonly { applianceId: ApplianceId; owned: boolean }[],
  updatedAt: string = new Date().toISOString(),
): Promise<void> {
  for (const item of appliances) {
    if (!isApplianceId(item.applianceId)) {
      throw new Error(`Invalid appliance ID: ${item.applianceId}`);
    }
  }

  const run = async (txn: any) => {
    for (const item of appliances) {
      await txn.runAsync(
        `INSERT INTO owned_appliances (appliance_id, owned, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(appliance_id) DO UPDATE SET
           owned = excluded.owned,
           updated_at = excluded.updated_at`,
        [item.applianceId, item.owned ? 1 : 0, updatedAt],
      );
    }
  };

  const database = db();
  if (!isWeb && typeof database.withExclusiveTransactionAsync === 'function') {
    await database.withExclusiveTransactionAsync(run);
  } else {
    await run(database);
  }
}
