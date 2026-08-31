import { MATCH_CONFIRM } from '@/logic/similarity';
import { MAX_ROWS_PER_PROPOSAL, materialise } from '@/logic/materialisation';
import type { MatchOutcome } from '@/logic/match';
import type {
  CanonicalItem,
  EvidenceStrength,
  IntakeIdentityOption,
  IntakeReviewNote,
  IntakeSource,
  Location,
  PantryIntakeProposal,
  StatedQuantity,
  TranscriptionMode,
} from '@/types';

/**
 * Turns one candidate from any intake channel into a reviewable proposal.
 *
 * This is `planCaptureItems` grown up. That function paired a photographed item
 * with a match outcome and a default location, which is exactly the right shape
 * — it just assumed the photo. Everything channel-specific has been lifted out
 * and replaced by arguments, so a spoken phrase, a receipt line, and a
 * photographed jar all arrive at review through the same code and therefore
 * cannot drift apart in how they treat an uncertain match.
 *
 * Pure: no database, no network, no clock. The caller resolves identities and
 * loads locations; this decides what the review should say about them.
 */

/** Everything one candidate contributes, before identity is resolved. */
export interface IntakeCandidate {
  /** Stable within the draft. Survives re-resolution after a confirmation. */
  id: string;
  /** The name exactly as the user gave it, in its original script. */
  statedName: string;
  /** The words it was read from, when there were words. */
  sourceSpan?: string | null;
  quantity: StatedQuantity;
  /** A location the candidate itself named, overriding the session default. */
  locationId?: string | null;
  fullness?: PantryIntakeProposal['fullness'];
  opened?: boolean | null;
  acquisition?: PantryIntakeProposal['acquisition'];
  transcriptionConfidence?: number | null;
}

export interface IntakePlanContext {
  draftId: string;
  source: IntakeSource;
  transcriptionMode?: TranscriptionMode | null;
  canonicals: readonly CanonicalItem[];
  locations: readonly Location[];
  /** Inherited by every candidate that did not name its own location. */
  sessionLocationId?: string | null;
  /**
   * Canonical ids already in stock. Used only to *mention* a possible
   * duplicate; it never blocks, because two cartons of milk is a normal fridge.
   */
  existingCanonicalIds?: ReadonlySet<string>;
}

/**
 * Pairs candidates with their outcomes and produces review-ready proposals.
 *
 * `outcomes[i]` belongs to `candidates[i]`, matching the existing capture
 * contract. A missing outcome is treated as unresolved rather than thrown,
 * because a short resolver response should degrade to "needs a look", not to a
 * crash in the middle of a review.
 */
export function planIntakeProposals(
  candidates: readonly IntakeCandidate[],
  outcomes: readonly MatchOutcome[],
  context: IntakePlanContext,
): PantryIntakeProposal[] {
  const canonicalById = new Map(
    context.canonicals.map((canonical) => [canonical.id, canonical]),
  );
  const locationIds = new Set(context.locations.map((location) => location.id));

  return candidates.map((candidate, index) => {
    const outcome: MatchOutcome = outcomes[index] ?? {
      status: 'unresolved',
      raw: candidate.statedName,
      norm: candidate.statedName,
      queued: false,
    };

    const canonicalId =
      outcome.status === 'resolved' || outcome.status === 'needs_confirmation'
        ? outcome.canonicalId
        : null;
    const canonical = canonicalId ? canonicalById.get(canonicalId) ?? null : null;

    const locationId = resolveLocation(candidate, canonical, context, locationIds);

    const proposal: PantryIntakeProposal = {
      id: candidate.id,
      draftId: context.draftId,
      source: context.source,
      transcriptionMode: context.transcriptionMode ?? null,
      sourceSpan: candidate.sourceSpan ?? null,
      statedName: candidate.statedName,
      canonicalId: canonical ? canonical.id : null,
      canonicalName: canonical ? canonical.displayName : null,
      identityConfidence:
        outcome.status === 'unresolved' ? null : outcome.confidence,
      identityStrength: identityStrength(outcome),
      alternatives: alternativesFor(outcome, canonical),
      quantity: candidate.quantity,
      quantityStrength: quantityStrength(candidate.quantity),
      locationId,
      locationStrength: locationStrength(candidate, locationId, context),
      fullness: candidate.fullness ?? null,
      opened: candidate.opened ?? null,
      acquisition: candidate.acquisition ?? null,
      transcriptionConfidence: candidate.transcriptionConfidence ?? null,
      notes: [],
    };

    return { ...proposal, notes: noteFor(proposal, outcome, context) };
  });
}

/**
 * The location a proposal starts with.
 *
 * Order matters and is the one place the session default earns its keep: a
 * location the user actually named beats the session, the session beats the
 * canonical's default shelf, and the canonical's default beats nothing. A
 * location id the candidate names but that no longer exists is discarded rather
 * than guessed at by name — renaming "Fridge" to "Kühlschrank" must not
 * silently stop matching.
 */
function resolveLocation(
  candidate: IntakeCandidate,
  canonical: CanonicalItem | null,
  context: IntakePlanContext,
  locationIds: ReadonlySet<string>,
): string | null {
  const spoken = candidate.locationId;
  if (spoken && locationIds.has(spoken)) return spoken;

  const session = context.sessionLocationId;
  if (session && locationIds.has(session)) return session;

  if (canonical) {
    const byDefault = context.locations.find(
      (location) => location.id === canonical.defaultLocation,
    );
    return byDefault?.id ?? context.locations[0]?.id ?? null;
  }

  // No identity and no stated location: nothing to propose. The shelf comes
  // from the ingredient, so an unresolved candidate has no shelf either. This
  // is the photo path's long-standing behaviour, kept.
  return null;
}

function identityStrength(outcome: MatchOutcome): EvidenceStrength {
  switch (outcome.status) {
    case 'resolved':
      return 'stated';
    case 'needs_confirmation':
      return 'approximate';
    case 'unresolved':
      return 'unknown';
  }
}

function alternativesFor(
  outcome: MatchOutcome,
  canonical: CanonicalItem | null,
): readonly IntakeIdentityOption[] {
  if (outcome.status !== 'needs_confirmation' || !canonical) return [];
  return [
    {
      canonicalId: canonical.id,
      displayName: canonical.displayName,
      confidence: outcome.confidence,
    },
  ];
}

function quantityStrength(quantity: StatedQuantity): EvidenceStrength {
  if (quantity.approximate) return 'approximate';
  if (quantity.amount == null && quantity.containerCount == null) return 'unknown';
  return 'stated';
}

function locationStrength(
  candidate: IntakeCandidate,
  resolved: string | null,
  context: IntakePlanContext,
): EvidenceStrength {
  if (resolved == null) return 'unknown';
  if (candidate.locationId === resolved) return 'stated';
  if (context.sessionLocationId === resolved) return 'inferred';
  return 'inferred';
}

/**
 * The plain-language reasons a proposal needs attention.
 *
 * Only two of them block. An unresolved or ambiguous identity blocks because
 * there is nothing to write a `canonical_id` from; an implausible container
 * count blocks because it would write dozens of rows off one misheard number.
 * Everything else — unknown quantity above all — is information, not a gate:
 * "there is butter in the fridge" is a true and useful pantry row.
 */
function noteFor(
  proposal: PantryIntakeProposal,
  outcome: MatchOutcome,
  context: IntakePlanContext,
): IntakeReviewNote[] {
  const notes: IntakeReviewNote[] = [];

  if (outcome.status === 'unresolved') {
    notes.push({
      reason: 'unresolved_identity',
      message: `Mise does not know “${proposal.statedName}” yet. Pick the ingredient it means, or skip it.`,
      blocking: true,
    });
  } else if (
    outcome.status === 'needs_confirmation' ||
    (outcome.status === 'resolved' && outcome.confidence < MATCH_CONFIRM)
  ) {
    notes.push({
      reason: 'ambiguous_identity',
      message: `“${proposal.statedName}” might be ${proposal.canonicalName}. Confirm before adding it.`,
      blocking: true,
    });
  }

  if (materialise(proposal.quantity).blocked === 'too_many_containers') {
    notes.push({
      reason: 'too_many_containers',
      message: `That would add more than ${MAX_ROWS_PER_PROPOSAL} separate containers. Check the number first.`,
      blocking: true,
    });
  }

  if (proposal.quantityStrength === 'unknown') {
    notes.push({
      reason: 'unknown_quantity',
      message: 'How much is unknown. You can still add it and say later.',
      blocking: false,
    });
  } else if (proposal.quantityStrength === 'approximate') {
    notes.push({
      reason: 'approximate_quantity',
      message: 'Kept as an approximate amount, because that is what was said.',
      blocking: false,
    });
  }

  if (proposal.locationId == null) {
    notes.push({
      reason: 'no_location',
      message: 'Choose where this lives before adding it.',
      blocking: true,
    });
  }

  if (
    proposal.canonicalId != null &&
    context.existingCanonicalIds?.has(proposal.canonicalId)
  ) {
    notes.push({
      reason: 'duplicate_existing_stock',
      message: 'You already have this in the pantry. Adding it makes a second one.',
      blocking: false,
    });
  }

  return notes;
}

/** Whether a proposal can be committed as it stands. */
export function isAcceptable(proposal: PantryIntakeProposal): boolean {
  return !proposal.notes.some((note) => note.blocking);
}

/** The two review groups: clear, and needing a look. */
export function partitionProposals(
  proposals: readonly PantryIntakeProposal[],
): { clear: PantryIntakeProposal[]; needsLook: PantryIntakeProposal[] } {
  const clear: PantryIntakeProposal[] = [];
  const needsLook: PantryIntakeProposal[] = [];
  for (const proposal of proposals) {
    // A non-blocking note still earns a place in "Needs a look" — an unknown
    // quantity is worth the user's eye even though it does not stop the add.
    (proposal.notes.length === 0 ? clear : needsLook).push(proposal);
  }
  return { clear, needsLook };
}
