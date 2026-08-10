import { hasApiKey } from '@/api/keyStore';
import { resolveWithModel } from '@/api/resolve';
import {
  deleteLearnedAlias,
  enqueueMatch,
  recordUserResolution,
} from '@/db/queries';
import {
  resolve,
  type MatchOutcome,
  type RawReference,
} from '@/logic/match';
import { currentOwnership, dbMatchStore } from '@/logic/matchStore';
import type { ReferenceSource } from '@/types';

/**
 * The one resolution entry point for the app. Binds the pure cascade in
 * `match.ts` to the real store, the current ownership signals, and — when a
 * key is configured — the model resolver. Channels differ only in the
 * `source` they pass.
 */
export async function resolveIngredientReferences(
  references: RawReference[],
  source: ReferenceSource,
  signal?: AbortSignal,
): Promise<MatchOutcome[]> {
  const useModel = await hasApiKey();
  return resolve(references, source, {
    store: dbMatchStore(),
    ownership: currentOwnership(),
    ...(useModel
      ? { model: (batch: Parameters<typeof resolveWithModel>[0]) => resolveWithModel(batch, signal) }
      : {}),
  });
}

/** Runs only the on-device cascade. Venue inference must not spend a second
 * provider request after the estimator has already examined the photograph. */
export async function resolveIngredientReferencesLocally(
  references: RawReference[],
  source: ReferenceSource,
): Promise<MatchOutcome[]> {
  const persisted = dbMatchStore();
  return resolve(references, source, {
    store: {
      ...persisted,
      // Preselection is a read. Approximate hits and misses are committed by
      // the normal meal/depletion path later, not while the user is typing.
      rememberAlias: async () => undefined,
      enqueue: async () => undefined,
    },
    ownership: currentOwnership(),
  });
}

/** A one-tap confirmation from the needs-confirmation surface. */
export async function confirmMatch(
  rawText: string,
  canonicalId: string,
): Promise<void> {
  await recordUserResolution(rawText, canonicalId);
}

/**
 * The user rejected a proposed match without picking a replacement. The
 * learned alias is removed so the mistake is not repeated, and the
 * reference goes to the review queue instead of being lost.
 */
export async function rejectMatch(
  rawText: string,
  canonicalId: string,
  source: ReferenceSource,
): Promise<void> {
  await deleteLearnedAlias(rawText, canonicalId);
  await enqueueMatch({ rawText, source });
}
