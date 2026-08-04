import { normalise } from '@/logic/normalise';
import { MATCH_ACCEPT, MATCH_CONFIRM, similarity } from '@/logic/similarity';
import type {
  FoodClass,
  MeasureUnit,
  ReferenceSource,
  StorageLocation,
} from '@/types';

/**
 * The five-step match cascade (decision 26): barcode, exact alias,
 * approximate alias, model resolution, propose-new. One entry point for
 * every channel, so matching behaviour cannot drift between the receipt
 * path and the meal-log path.
 *
 * Pure: all persistence goes through the injected `MatchStore`, and the
 * model step through the injected `ModelResolver`. Steps 1 to 3 never touch
 * the network; with no model injected, whatever they cannot resolve is
 * queued rather than failed.
 */

/* -------------------------------------------------------------------------- */
/* Shapes                                                                      */
/* -------------------------------------------------------------------------- */

export interface RawReference {
  raw: string;
  /** A scanned GTIN, where the channel produced one. */
  barcode?: string;
  /** JSON context captured at scan time — receipt id, price, quantity. */
  context?: string;
  /** The receipt's own store name, when known — consulted by `normalise`. */
  store?: string;
}

export type MatchMethod = 'barcode' | 'exact_alias' | 'approximate' | 'model';

export interface CanonicalProposal {
  displayName: string;
  foodClass: FoodClass;
  defaultLocation: StorageLocation;
  shelfLifeDays: Partial<Record<StorageLocation, number>>;
  openLifeDays: number | null;
  typicalUseQty: number | null;
  typicalUseUnit: MeasureUnit | null;
}

export type MatchOutcome =
  | {
      status: 'resolved';
      raw: string;
      norm: string;
      canonicalId: string;
      confidence: number;
      method: MatchMethod;
    }
  | {
      status: 'needs_confirmation';
      raw: string;
      norm: string;
      canonicalId: string;
      confidence: number;
      /**
       * `exact_alias` belongs here as well as under `resolved`: an alias
       * written back from an unconfirmed approximate match is an exact hit on
       * a value the user never agreed to, so it comes back asking.
       */
      method: 'approximate' | 'model' | 'exact_alias';
    }
  | {
      status: 'unresolved';
      raw: string;
      norm: string;
      /** True when the reference was written to the review queue. */
      queued: boolean;
      /** Step 5: a new-canonical proposal awaiting user confirmation. */
      proposal?: CanonicalProposal;
    };

export interface AliasCandidate {
  canonicalId: string;
  aliasNorm: string;
}

/** What the cascade needs from persistence. `src/logic/matchStore.ts` binds it to the real queries. */
export interface MatchStore {
  productCanonicalByBarcode(gtin: string): Promise<string | null>;
  /**
   * An exact hit on the normalised form, carrying the alias's own stored
   * confidence. The confidence matters: a seeded or user-confirmed alias is
   * trustworthy, but a write-back from an unconfirmed approximate match is
   * only as good as the score that produced it.
   */
  exactAliasCanonical(
    norm: string,
  ): Promise<{ canonicalId: string; confidence: number } | null>;
  candidateAliases(norm: string): Promise<AliasCandidate[]>;
  rememberAlias(entry: {
    aliasRaw: string;
    canonicalId: string;
    source: ReferenceSource;
    confidence: number;
  }): Promise<void>;
  enqueue(entry: {
    rawText: string;
    source: ReferenceSource;
    context?: string;
    suggestedId?: string;
    confidence?: number;
  }): Promise<void>;
}

/** Pantry signals for ownership bias. Empty until pantry items ship. */
export interface OwnershipSignal {
  inStock: boolean;
  opened: boolean;
  frequentlyUsed: boolean;
}

export interface ModelResolutionRequest {
  references: { raw: string; norm: string; candidateIds: string[] }[];
  /** Canonicals the user currently has, the prior for disambiguation. */
  ownedCanonicalIds: string[];
}

export interface ModelResolution {
  canonicalId?: string;
  confidence?: number;
  proposal?: CanonicalProposal;
}

/**
 * Steps 4 and 5: one batched request for every reference the local steps
 * left unresolved. Returns one entry per reference, aligned by index; null
 * means the model could not place it either.
 */
export type ModelResolver = (
  batch: ModelResolutionRequest,
) => Promise<(ModelResolution | null)[]>;

export interface ResolveOptions {
  store: MatchStore;
  /** Pantry ownership by canonical id. Defaults to none. */
  ownership?: ReadonlyMap<string, OwnershipSignal>;
  /** Absent when no API key is configured — steps 4 and 5 are skipped. */
  model?: ModelResolver;
}

/* -------------------------------------------------------------------------- */
/* Ownership bias                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Scoring bonus for candidates the user owns (decision 28), applied before
 * the thresholds are compared. Ranking order: in stock, then opened, then
 * frequently used — the weights are strictly ordered so each signal
 * dominates the ones below it. The total (0.07) is deliberately far below
 * `MATCH_ACCEPT - MATCH_CONFIRM` (0.25), and no bonus applies below
 * `MATCH_CONFIRM`, so ownership can break ties and lift borderline matches
 * but can never promote a genuinely wrong match above `MATCH_ACCEPT` on its
 * own.
 */
export const OWNERSHIP_BONUS = {
  inStock: 0.04,
  opened: 0.02,
  frequentlyUsed: 0.01,
} as const;

export function ownershipBonus(signal: OwnershipSignal | undefined): number {
  if (!signal) return 0;
  return (
    (signal.inStock ? OWNERSHIP_BONUS.inStock : 0) +
    (signal.opened ? OWNERSHIP_BONUS.opened : 0) +
    (signal.frequentlyUsed ? OWNERSHIP_BONUS.frequentlyUsed : 0)
  );
}

/* -------------------------------------------------------------------------- */
/* The cascade                                                                 */
/* -------------------------------------------------------------------------- */

const EXACT_ALIAS_CONFIDENCE = 0.95;
const MODEL_DEFAULT_CONFIDENCE = 0.75;
/** Candidates handed to the model per unresolved reference. */
const MODEL_CANDIDATE_LIMIT = 20;

interface ScoredCandidate {
  canonicalId: string;
  score: number;
}

/**
 * Resolves a batch of raw references from one channel. Batch-first by
 * design: step 4 must make one request per receipt, so the API takes an
 * array even for a single reference.
 */
export async function resolve(
  references: RawReference[],
  source: ReferenceSource,
  options: ResolveOptions,
): Promise<MatchOutcome[]> {
  const { store, ownership, model } = options;
  const outcomes = new Array<MatchOutcome | null>(references.length).fill(null);

  interface Pending {
    index: number;
    reference: RawReference;
    norm: string;
    candidates: ScoredCandidate[];
  }
  const pending: Pending[] = [];

  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    if (!reference) continue;
    const norm = normalise(reference.raw, { store: reference.store });

    // Step 1: exact barcode. Certainty 1, and nothing costlier runs.
    if (reference.barcode) {
      const canonicalId = await store.productCanonicalByBarcode(
        reference.barcode,
      );
      if (canonicalId) {
        outcomes[index] = {
          status: 'resolved',
          raw: reference.raw,
          norm,
          canonicalId,
          confidence: 1,
          method: 'barcode',
        };
        continue;
      }
    }

    // Step 2: exact normalised alias, banded by the alias's own confidence.
    //
    // Banding here rather than trusting every hit is what stops an
    // unconfirmed guess laundering itself into certainty. Step 3 writes an
    // alias back even when it only reached the confirm band, so without this
    // the second sighting of that same string would hit this step and resolve
    // silently — and receipts repeat the same abbreviations every week, so
    // "second sighting" is the common case, not the rare one. A seeded or
    // user-confirmed alias carries confidence 1 and still resolves outright.
    if (norm.length > 0) {
      const hit = await store.exactAliasCanonical(norm);
      if (hit) {
        const confidence = Math.min(hit.confidence, EXACT_ALIAS_CONFIDENCE);
        if (confidence >= MATCH_ACCEPT) {
          outcomes[index] = {
            status: 'resolved',
            raw: reference.raw,
            norm,
            canonicalId: hit.canonicalId,
            confidence,
            method: 'exact_alias',
          };
          continue;
        }
        if (confidence >= MATCH_CONFIRM) {
          outcomes[index] = {
            status: 'needs_confirmation',
            raw: reference.raw,
            norm,
            canonicalId: hit.canonicalId,
            confidence,
            method: 'exact_alias',
          };
          continue;
        }
        // Below the confirm band the remembered alias is not good enough to
        // act on. Fall through and let steps 3 to 5 have another go.
      }
    }

    // Step 3: approximate alias, banded by confidence. The ownership bonus
    // is a scoring input here, not a post-filter — it can reorder
    // candidates before the bands are read.
    const scored = new Map<string, number>();
    if (norm.length > 0) {
      for (const candidate of await store.candidateAliases(norm)) {
        const base = similarity(norm, candidate.aliasNorm);
        const bonus =
          base >= MATCH_CONFIRM
            ? ownershipBonus(ownership?.get(candidate.canonicalId))
            : 0;
        const score = Math.min(base + bonus, 0.99);
        const previous = scored.get(candidate.canonicalId) ?? 0;
        if (score > previous) scored.set(candidate.canonicalId, score);
      }
    }
    const ranked: ScoredCandidate[] = [...scored.entries()]
      .map(([canonicalId, score]) => ({ canonicalId, score }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (best && best.score >= MATCH_ACCEPT) {
      await store.rememberAlias({
        aliasRaw: reference.raw,
        canonicalId: best.canonicalId,
        source,
        confidence: best.score,
      });
      outcomes[index] = {
        status: 'resolved',
        raw: reference.raw,
        norm,
        canonicalId: best.canonicalId,
        confidence: best.score,
        method: 'approximate',
      };
      continue;
    }
    if (best && best.score >= MATCH_CONFIRM) {
      await store.rememberAlias({
        aliasRaw: reference.raw,
        canonicalId: best.canonicalId,
        source,
        confidence: best.score,
      });
      outcomes[index] = {
        status: 'needs_confirmation',
        raw: reference.raw,
        norm,
        canonicalId: best.canonicalId,
        confidence: best.score,
        method: 'approximate',
      };
      continue;
    }

    pending.push({ index, reference, norm, candidates: ranked });
  }

  // Steps 4 and 5: one batched model call for everything still unresolved
  // (never reached when steps 1 to 3 settled the whole batch). A failed or
  // malformed batch degrades to the review queue, not to an error.
  if (pending.length > 0 && model) {
    let resolutions: (ModelResolution | null)[] | null = null;
    try {
      resolutions = await model({
        references: pending.map((entry) => ({
          raw: entry.reference.raw,
          norm: entry.norm,
          candidateIds: entry.candidates
            .slice(0, MODEL_CANDIDATE_LIMIT)
            .map((candidate) => candidate.canonicalId),
        })),
        ownedCanonicalIds: ownership
          ? [...ownership.entries()]
              .filter(([, signal]) => signal.inStock)
              .map(([id]) => id)
          : [],
      });
    } catch {
      resolutions = null;
    }

    for (let i = 0; i < pending.length; i += 1) {
      const entry = pending[i];
      if (!entry) continue;
      const resolution = resolutions?.[i] ?? null;

      if (resolution?.canonicalId) {
        const confidence = resolution.confidence ?? MODEL_DEFAULT_CONFIDENCE;
        await store.rememberAlias({
          aliasRaw: entry.reference.raw,
          canonicalId: resolution.canonicalId,
          source,
          confidence,
        });
        outcomes[entry.index] =
          confidence >= MATCH_ACCEPT
            ? {
                status: 'resolved',
                raw: entry.reference.raw,
                norm: entry.norm,
                canonicalId: resolution.canonicalId,
                confidence,
                method: 'model',
              }
            : {
                status: 'needs_confirmation',
                raw: entry.reference.raw,
                norm: entry.norm,
                canonicalId: resolution.canonicalId,
                confidence,
                method: 'model',
              };
        continue;
      }

      if (resolution?.proposal) {
        // Step 5: a proposed new canonical. Creation waits for the user to
        // confirm the name (see `proposeCanonical` in resolution.ts), so
        // the reference is reported unresolved, carrying the proposal.
        outcomes[entry.index] = {
          status: 'unresolved',
          raw: entry.reference.raw,
          norm: entry.norm,
          queued: false,
          proposal: resolution.proposal,
        };
        continue;
      }

      outcomes[entry.index] = await enqueueOutcome(store, source, entry);
    }
  } else {
    for (const entry of pending) {
      outcomes[entry.index] = await enqueueOutcome(store, source, entry);
    }
  }

  return outcomes.map(
    (outcome, index) =>
      outcome ?? {
        status: 'unresolved',
        raw: references[index]?.raw ?? '',
        norm: '',
        queued: false,
      },
  );
}

async function enqueueOutcome(
  store: MatchStore,
  source: ReferenceSource,
  entry: {
    reference: RawReference;
    norm: string;
    candidates: ScoredCandidate[];
  },
): Promise<MatchOutcome> {
  const suggestion = entry.candidates[0];
  await store.enqueue({
    rawText: entry.reference.raw,
    source,
    ...(entry.reference.context !== undefined
      ? { context: entry.reference.context }
      : {}),
    ...(suggestion
      ? { suggestedId: suggestion.canonicalId, confidence: suggestion.score }
      : {}),
  });
  return {
    status: 'unresolved',
    raw: entry.reference.raw,
    norm: entry.norm,
    queued: true,
  };
}
