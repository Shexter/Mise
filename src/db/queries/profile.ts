import { randomUUID } from 'expo-crypto';
import { db } from '@/db';
import { DEFAULT_FIBRE_TARGET_G, macroTargets } from '@/logic/macros';
import type { BodyMeasurement, DailyTarget, DietaryRule, DietaryRuleKind, Fast, Profile } from '@/types';
import {
  ProfileRow,
  BodyMeasurementRow,
  FastRow,
  DailyTargetRow,
  toProfile,
  toBodyMeasurement,
  toFast,
  toDailyTarget,
  DietaryRuleRow,
  toDietaryRule,
} from './types';



/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

export async function getProfile(): Promise<Profile | null> {
  const row = await db().getFirstAsync<ProfileRow>(
    'SELECT * FROM profile WHERE id = 1',
  );
  return row ? toProfile(row) : null;
}


export async function saveProfile(profile: Profile): Promise<void> {
  await db().runAsync(
    `INSERT INTO profile (
       id, sex, age, height_cm, weight_kg, activity_level, goal,
       target_calories, protein_pct, carbs_pct, fat_pct, fibre_target_g, units, onboarded_at,
       target_source, stated_calories, stated_figure_kind,
       target_weight_kg, weight_goal_rate_kg_per_week
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       sex = excluded.sex,
       age = excluded.age,
       height_cm = excluded.height_cm,
       weight_kg = excluded.weight_kg,
       activity_level = excluded.activity_level,
       goal = excluded.goal,
       target_calories = excluded.target_calories,
       protein_pct = excluded.protein_pct,
       carbs_pct = excluded.carbs_pct,
       fat_pct = excluded.fat_pct,
       fibre_target_g = excluded.fibre_target_g,
       units = excluded.units,
       target_source = excluded.target_source,
       stated_calories = excluded.stated_calories,
       stated_figure_kind = excluded.stated_figure_kind,
       target_weight_kg = excluded.target_weight_kg,
       weight_goal_rate_kg_per_week = excluded.weight_goal_rate_kg_per_week`,
    [
      profile.sex,
      profile.age,
      profile.heightCm,
      profile.weightKg,
      profile.activityLevel,
      profile.goal,
      profile.targetCalories,
      profile.proteinPct,
      profile.carbsPct,
      profile.fatPct,
      profile.fibreTargetG ?? DEFAULT_FIBRE_TARGET_G,
      profile.units,
      profile.onboardedAt,
      profile.targetSource,
      profile.statedCalories,
      profile.statedFigureKind,
      profile.targetWeightKg ?? null,
      profile.weightGoalRateKgPerWeek ?? null,
    ],
  );
}


export async function getBodyMeasurements(): Promise<BodyMeasurement[]> {
  const rows = await db().getAllAsync<BodyMeasurementRow>('SELECT * FROM body_measurements');
  return rows.map(toBodyMeasurement);
}


/** Replaces only the measurement for this provider; the other provider remains. */
export async function saveBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
  await db().runAsync(
    `INSERT INTO body_measurements (provider, weight_kg, measured_at, body_fat_pct, lean_tissue_kg, bone_mineral_content_kg, fat_free_mass_kg)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider) DO UPDATE SET weight_kg = excluded.weight_kg, measured_at = excluded.measured_at,
       body_fat_pct = excluded.body_fat_pct, lean_tissue_kg = excluded.lean_tissue_kg,
       bone_mineral_content_kg = excluded.bone_mineral_content_kg, fat_free_mass_kg = excluded.fat_free_mass_kg`,
    [measurement.provider, measurement.weightKg, measurement.measuredAt, measurement.bodyFatPct, measurement.leanTissueKg, measurement.boneMineralContentKg, measurement.fatFreeMassKg],
  );
}


/* -------------------------------------------------------------------------- */
/* Fasting                                                                     */
/* -------------------------------------------------------------------------- */

export async function getActiveFast(): Promise<Fast | null> {
  const row = await db().getFirstAsync<FastRow>(
    'SELECT * FROM fasts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
  return row ? toFast(row) : null;
}


/** Completed intervals only, newest first. The active timer is returned by
 * `getActiveFast`, so history never has to special-case an unfinished row. */
export async function listFastHistory(): Promise<Fast[]> {
  const rows = await db().getAllAsync<FastRow>(
    'SELECT * FROM fasts WHERE ended_at IS NOT NULL ORDER BY started_at DESC',
  );
  return rows.map(toFast);
}


/** Starts one interval in an exclusive transaction so two callers cannot both
 * observe an empty active slot and insert. */
export async function startFast(
  targetDurationMinutes: number | null = null,
  startedAt: string = new Date().toISOString(),
): Promise<Fast> {
  if (
    targetDurationMinutes !== null
    && (!Number.isInteger(targetDurationMinutes) || targetDurationMinutes <= 0)
  ) {
    throw new Error('Target duration must be a positive whole number of minutes.');
  }
  if (!Number.isFinite(Date.parse(startedAt))) {
    throw new Error('Fast start time is invalid.');
  }

  const fast: Fast = {
    id: randomUUID(),
    startedAt,
    endedAt: null,
    targetDurationMinutes,
    createdAt: startedAt,
  };

  await db().withExclusiveTransactionAsync(async (txn) => {
    const active = await txn.getFirstAsync<{ id: string }>(
      'SELECT id FROM fasts WHERE ended_at IS NULL LIMIT 1',
      [],
    );
    if (active) throw new Error('A fast is already active.');
    await txn.runAsync(
      `INSERT INTO fasts (id, started_at, ended_at, target_duration_minutes, created_at)
       VALUES (?, ?, NULL, ?, ?)`,
      [fast.id, fast.startedAt, fast.targetDurationMinutes, fast.createdAt],
    );
  });

  return fast;
}


/** Ends the active interval and returns its completed value. */
export async function endFast(
  endedAt: string = new Date().toISOString(),
): Promise<Fast> {
  if (!Number.isFinite(Date.parse(endedAt))) {
    throw new Error('Fast end time is invalid.');
  }

  let completed: Fast | null = null;
  await db().withExclusiveTransactionAsync(async (txn) => {
    const active = await txn.getFirstAsync<FastRow>(
      'SELECT * FROM fasts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
      [],
    );
    if (!active) throw new Error('There is no active fast to end.');
    if (Date.parse(endedAt) < Date.parse(active.started_at)) {
      throw new Error('Fast end time cannot be before its start time.');
    }
    await txn.runAsync(
      'UPDATE fasts SET ended_at = ? WHERE id = ? AND ended_at IS NULL',
      [endedAt, active.id],
    );
    completed = toFast({ ...active, ended_at: endedAt });
  });

  if (!completed) throw new Error('The active fast could not be ended.');
  return completed;
}


/* -------------------------------------------------------------------------- */
/* Daily targets                                                               */
/* -------------------------------------------------------------------------- */

export async function getDailyTarget(
  localDate: string,
): Promise<DailyTarget | null> {
  const row = await db().getFirstAsync<DailyTargetRow>(
    'SELECT * FROM daily_targets WHERE local_date = ?',
    [localDate],
  );
  return row ? toDailyTarget(row) : null;
}


/**
 * Returns the target that was active on `localDate`, writing it on first use so
 * later profile edits do not rewrite history.
 */
export async function ensureDailyTarget(
  localDate: string,
  profile: Profile,
): Promise<DailyTarget> {
  const existing = await getDailyTarget(localDate);
  if (existing) return existing;

  const macros = macroTargets(profile.targetCalories, {
    proteinPct: profile.proteinPct,
    carbsPct: profile.carbsPct,
    fatPct: profile.fatPct,
  });
  const target: DailyTarget = {
    localDate,
    targetCalories: profile.targetCalories,
    proteinG: macros.proteinG,
    carbsG: macros.carbsG,
    fatG: macros.fatG,
    fibreG: profile.fibreTargetG ?? DEFAULT_FIBRE_TARGET_G,
  };
  await db().runAsync(
    `INSERT OR IGNORE INTO daily_targets
       (local_date, target_calories, protein_g, carbs_g, fat_g, fibre_g)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      target.localDate,
      target.targetCalories,
      target.proteinG,
      target.carbsG,
      target.fatG,
      target.fibreG ?? DEFAULT_FIBRE_TARGET_G,
    ],
  );
  return target;
}


export interface NewDietaryRule {
  kind: DietaryRuleKind;
  canonicalId: string | null;
  text: string;
  normalisedText: string;
}


export async function createDietaryRule(input: NewDietaryRule): Promise<DietaryRule> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO dietary_rules (id, kind, canonical_id, text, normalised_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.kind, input.canonicalId, input.text, input.normalisedText, createdAt],
  );
  return { id, kind: input.kind, canonicalId: input.canonicalId, text: input.text, normalisedText: input.normalisedText, createdAt };
}


export async function listDietaryRules(): Promise<DietaryRule[]> {
  const rows = await db().getAllAsync<DietaryRuleRow>(
    'SELECT * FROM dietary_rules ORDER BY created_at ASC',
  );
  return rows.map(toDietaryRule);
}


/** Changing a rule's kind changes only its enforcement policy — the text and resolution stand. */
export async function updateDietaryRuleKind(
  id: string,
  kind: DietaryRuleKind,
): Promise<void> {
  await db().runAsync('UPDATE dietary_rules SET kind = ? WHERE id = ?', [kind, id]);
}


export async function deleteDietaryRule(id: string): Promise<void> {
  await db().runAsync('DELETE FROM dietary_rules WHERE id = ?', [id]);
}


/**
 * Every canonical id derived from any of `canonicalIds`, transitively,
 * including the seeds themselves. A recursive query per seed rather than a
 * stored closure (design: "the graph is tiny and shallow") — plain `UNION`
 * (not `UNION ALL`) drops a row the moment its id has already appeared, so a
 * cyclical edit to the catalogue terminates instead of hanging (task 3.6).
 */
export async function expandDerivatives(
  canonicalIds: readonly string[],
): Promise<Set<string>> {
  const result = new Set<string>();
  for (const seed of canonicalIds) {
    const rows = await db().getAllAsync<{ id: string }>(
      `WITH RECURSIVE closure(id) AS (
         SELECT ?
         UNION
         SELECT cd.child_id FROM canonical_derivatives cd
         JOIN closure ON cd.parent_id = closure.id
       )
       SELECT id FROM closure`,
      [seed],
    );
    for (const row of rows) result.add(row.id);
  }
  return result;
}


/**
 * Every derivative edge, flat. The graph is small enough to load whole
 * (design.md: "tiny and shallow") — `src/logic/dietary.ts`'s `expandRules`
 * is the pure function that actually walks it, so a rule set can be
 * expanded without a database in a test.
 */
export async function listDerivativeEdges(): Promise<
  { parentId: string; childId: string }[]
> {
  const rows = await db().getAllAsync<{ parent_id: string; child_id: string }>(
    'SELECT parent_id, child_id FROM canonical_derivatives',
  );
  return rows.map((row) => ({ parentId: row.parent_id, childId: row.child_id }));
}
