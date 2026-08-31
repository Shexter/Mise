import { randomUUID } from 'expo-crypto';
import { db } from '@/db';
import type { SuggestionMode, SuggestionTargetMacro, SuggestionBaseIntent, SuggestionPrepSpeed, SavedSuggestionPreference, TonightSuggestionPreference, SuggestionSet, Suggestion, MacroGapContext, StretchPlan } from '@/types';
import {
  SuggestionCacheRow,
  SuggestionPreferenceRow,
  toSavedSuggestionPreference,
} from './types';



/** The durable explicit choice. Profile remains the owner of long-term targets. */
export async function getSuggestionPreference(): Promise<SavedSuggestionPreference | null> {
  const row = await db().getFirstAsync<SuggestionPreferenceRow>(
    'SELECT * FROM suggestion_preferences WHERE id = 1',
  );
  return row ? toSavedSuggestionPreference(row) : null;
}


export async function saveSuggestionPreference(
  baseIntent: SuggestionBaseIntent,
  prepSpeed: SuggestionPrepSpeed,
): Promise<SavedSuggestionPreference> {
  const updatedAt = new Date().toISOString();
  await db().runAsync(
    `INSERT INTO suggestion_preferences (id, base_intent, prep_speed, updated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       base_intent = excluded.base_intent,
       prep_speed = excluded.prep_speed,
       updated_at = excluded.updated_at`,
    [baseIntent, prepSpeed, updatedAt],
  );
  return { baseIntent, prepSpeed, updatedAt };
}


export async function clearSuggestionPreference(): Promise<void> {
  await db().runAsync('DELETE FROM suggestion_preferences WHERE id = 1');
}


interface CachedPayload {
  suggestions: Suggestion[];
  stretch: StretchPlan | null;
  /** Absent on rows cached before task 11 shipped — treated as zero. */
  droppedForConstraint?: number;
  /**
   * Absent on rows cached before `add-dish-scorer` shipped. Falls back to
   * `suggestions` itself (design's rollback note: a pool equal to the
   * displayed count degrades to a same-three reorder, not a break).
   */
  pool?: Suggestion[];
  /** Absent on rows cached before `add-dietary-profile` shipped — treated as zero. */
  droppedForDiet?: number;
  /** Null before macro-gap support, and for non-macro request modes. */
  macroGapContext?: MacroGapContext | null;
}


function toSuggestionSet(row: SuggestionCacheRow): SuggestionSet {
  const payload = JSON.parse(row.payload) as CachedPayload;
  return {
    id: row.id,
    localDate: row.local_date,
    mode: row.mode as SuggestionMode,
    targetMacro: row.target_macro as SuggestionTargetMacro | null,
    tonightPreference: row.template_id && row.prep_speed
      ? {
          baseIntent: row.template_id as SuggestionBaseIntent,
          prepSpeed: row.prep_speed as SuggestionPrepSpeed,
          source: 'saved',
        }
      : null,
    macroGapContext: payload.macroGapContext ?? null,
    fingerprint: row.fingerprint,
    suggestions: payload.suggestions,
    stretch: payload.stretch,
    createdAt: row.created_at,
    droppedForConstraint: payload.droppedForConstraint ?? 0,
    pool: payload.pool ?? payload.suggestions,
    droppedForDiet: payload.droppedForDiet ?? 0,
  };
}


/**
 * The cached set for today and this mode, whatever its fingerprint — the
 * caller compares fingerprints to decide reuse versus regeneration
 * (decision 40). Returns the most recent row if more than one somehow
 * exists for the same day and mode.
 */
export async function getSuggestionCache(
  localDate: string,
  mode: SuggestionMode,
  targetMacro: SuggestionTargetMacro | null = null,
  preference: TonightSuggestionPreference | null = null,
): Promise<SuggestionSet | null> {
  const row = await db().getFirstAsync<SuggestionCacheRow>(
    `SELECT * FROM suggestion_cache
     WHERE local_date = ? AND mode = ? AND target_macro IS ?
       AND template_id IS ? AND prep_speed IS ?
     ORDER BY created_at DESC LIMIT 1`,
    [localDate, mode, targetMacro, preference?.baseIntent ?? null, preference?.prepSpeed ?? null],
  );
  return row ? toSuggestionSet(row) : null;
}


/**
 * Replaces the cached set for a day and mode. One active set per
 * (local_date, mode): the old row is cleared first so reopening after a
 * regeneration never reads a stale one.
 */
export async function saveSuggestionCache(
  localDate: string,
  mode: SuggestionMode,
  targetMacro: SuggestionTargetMacro | null,
  preference: TonightSuggestionPreference | null,
  fingerprint: string,
  suggestions: Suggestion[],
  stretch: StretchPlan | null,
  droppedForConstraint: number,
  pool: Suggestion[],
  droppedForDiet: number,
  macroGapContext: MacroGapContext | null,
): Promise<SuggestionSet> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const payload: CachedPayload = {
    suggestions, stretch, droppedForConstraint, pool, droppedForDiet, macroGapContext,
  };

  await db().withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `DELETE FROM suggestion_cache
       WHERE local_date = ? AND mode = ? AND target_macro IS ?
         AND template_id IS ? AND prep_speed IS ?`,
      [localDate, mode, targetMacro, preference?.baseIntent ?? null, preference?.prepSpeed ?? null],
    );
    await txn.runAsync(
      `INSERT INTO suggestion_cache
       (id, local_date, mode, target_macro, template_id, prep_speed, fingerprint, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, localDate, mode, targetMacro, preference?.baseIntent ?? null, preference?.prepSpeed ?? null,
        fingerprint, JSON.stringify(payload), createdAt],
    );
  });

  return {
    id,
    localDate,
    mode,
    targetMacro,
    tonightPreference: preference,
    macroGapContext,
    fingerprint,
    suggestions,
    stretch,
    createdAt,
    droppedForConstraint,
    pool,
    droppedForDiet,
  };
}


/**
 * Drops every cached suggestion set, once, after the pantry changes in bulk.
 *
 * The fingerprint in `computeFingerprint` covers *urgent* stock — what is
 * about to expire — because that is what a normal day changes. A reviewed
 * intake batch breaks that assumption: eight newly catalogued ingredients with
 * no acquisition date have no expiry, so none of them are urgent, so the
 * fingerprint is unchanged and the cache would be reused as though the fridge
 * were still empty.
 *
 * Deleting rather than recomputing keeps this cheap and keeps the decision in
 * one place: the next open regenerates from whatever the pantry now holds.
 * Called once after a batch commits and once after a batch is undone.
 */
export async function invalidatePantryDependentSuggestions(): Promise<void> {
  await db().runAsync('DELETE FROM suggestion_cache');
}
