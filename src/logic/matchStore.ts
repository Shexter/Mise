import {
  enqueueMatch,
  getBestAliasByNorm,
  getCandidateAliases,
  getProductByBarcode,
  recordAlias,
} from '@/db/queries';
import type { MatchStore, OwnershipSignal } from '@/logic/match';

/** Binds the cascade's `MatchStore` interface to the real SQLite queries. */
export function dbMatchStore(): MatchStore {
  return {
    async productCanonicalByBarcode(gtin) {
      const product = await getProductByBarcode(gtin);
      return product?.canonicalId ?? null;
    },
    async exactAliasCanonical(norm) {
      const alias = await getBestAliasByNorm(norm);
      if (!alias) return null;
      return { canonicalId: alias.canonicalId, confidence: alias.confidence };
    },
    async candidateAliases(norm) {
      const aliases = await getCandidateAliases(norm);
      return aliases.map((alias) => ({
        canonicalId: alias.canonicalId,
        aliasNorm: alias.aliasNorm,
      }));
    },
    async rememberAlias(entry) {
      await recordAlias(entry);
    },
    async enqueue(entry) {
      await enqueueMatch(entry);
    },
  };
}

/**
 * Ownership signals for disambiguation (decision 28). Pantry items are a
 * later change; until they exist nothing is owned, so the bias contributes
 * nothing. The seam is here so wiring the real pantry in is a one-module
 * change.
 */
export function currentOwnership(): ReadonlyMap<string, OwnershipSignal> {
  return new Map();
}
