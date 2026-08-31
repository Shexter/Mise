import { isAcceptable, partitionProposals } from '@/logic/intakeProposals';
import { materialise } from '@/logic/materialisation';
import type {
  IntakeIdentityOption,
  Location,
  PantryIntakeProposal,
  StatedQuantity,
} from '@/types';

/**
 * The review model: what the user sees before anything is written, and what
 * their edits do to it.
 *
 * Pure and screen-free. The reason this is not just component state is the
 * final action's wording — "Add 8 items to Fridge" is a promise about a
 * database write, and a promise made in JSX drifts from the write the moment
 * someone changes either one. Counting the rows and naming the destination in
 * the same module that the writer consumes is what keeps the sentence true.
 *
 * Selection is a list of ids rather than a flag on each proposal. Editing a
 * proposal replaces it; if selection lived inside it, every edit would have to
 * remember to carry the flag across, and one that forgot would silently drop an
 * item out of the batch.
 */

export interface IntakeReviewState {
  draftId: string;
  proposals: readonly PantryIntakeProposal[];
  /** Ids the user has chosen to add. Order is irrelevant. */
  selectedIds: readonly string[];
}

/**
 * Opens review with the clear items already chosen.
 *
 * Preselecting is the whole speed argument — eight items should be one tap, not
 * eight. It is safe because nothing is written until the final action, and it
 * applies only to proposals with no note at all: anything Mise has a remark
 * about starts unselected, so the user's attention is spent exactly where the
 * uncertainty is.
 */
export function openReview(
  draftId: string,
  proposals: readonly PantryIntakeProposal[],
): IntakeReviewState {
  const { clear } = partitionProposals(proposals);
  return { draftId, proposals, selectedIds: clear.map((proposal) => proposal.id) };
}

export function isSelected(state: IntakeReviewState, id: string): boolean {
  return state.selectedIds.includes(id);
}

/**
 * Toggles one row. A proposal that cannot be committed cannot be selected —
 * the button would otherwise promise a write the transaction would refuse.
 */
export function toggleSelection(
  state: IntakeReviewState,
  id: string,
): IntakeReviewState {
  if (isSelected(state, id)) {
    return { ...state, selectedIds: state.selectedIds.filter((other) => other !== id) };
  }
  const proposal = state.proposals.find((candidate) => candidate.id === id);
  if (!proposal || !isAcceptable(proposal)) return state;
  return { ...state, selectedIds: [...state.selectedIds, id] };
}

/** Removes a proposal from the batch without removing it from view. */
export function skip(state: IntakeReviewState, id: string): IntakeReviewState {
  return { ...state, selectedIds: state.selectedIds.filter((other) => other !== id) };
}

/**
 * Replaces one proposal and re-derives its selection.
 *
 * An edit that resolves the last blocking note selects the row, because the
 * user just did the work of resolving it and making them tap again would be
 * asking twice. An edit that introduces a blocker deselects it, for the same
 * reason the toggle refuses one.
 */
export function replaceProposal(
  state: IntakeReviewState,
  next: PantryIntakeProposal,
): IntakeReviewState {
  const proposals = state.proposals.map((proposal) =>
    proposal.id === next.id ? next : proposal,
  );
  const wasBlocked = !isAcceptable(
    state.proposals.find((proposal) => proposal.id === next.id) ?? next,
  );
  const nowAcceptable = isAcceptable(next);

  let selectedIds = state.selectedIds;
  if (!nowAcceptable) {
    selectedIds = selectedIds.filter((id) => id !== next.id);
  } else if (wasBlocked && !selectedIds.includes(next.id)) {
    selectedIds = [...selectedIds, next.id];
  }
  return { ...state, proposals, selectedIds };
}

/** Moves one proposal to another location, clearing the no-location note. */
export function setLocation(
  state: IntakeReviewState,
  id: string,
  locationId: string,
): IntakeReviewState {
  const proposal = state.proposals.find((candidate) => candidate.id === id);
  if (!proposal) return state;
  return replaceProposal(state, {
    ...proposal,
    locationId,
    locationStrength: 'stated',
    notes: proposal.notes.filter((note) => note.reason !== 'no_location'),
  });
}

/**
 * Records the ingredient the user picked for an unresolved or ambiguous row.
 *
 * The identity notes are dropped because the user has now supplied the answer
 * — that is a stated fact, not a match score, which is why `identityStrength`
 * becomes `stated` and the confidence becomes 1.
 */
export function resolveIdentity(
  state: IntakeReviewState,
  id: string,
  choice: IntakeIdentityOption,
): IntakeReviewState {
  const proposal = state.proposals.find((candidate) => candidate.id === id);
  if (!proposal) return state;
  return replaceProposal(state, {
    ...proposal,
    canonicalId: choice.canonicalId,
    canonicalName: choice.displayName,
    identityConfidence: 1,
    identityStrength: 'stated',
    alternatives: [],
    notes: proposal.notes.filter(
      (note) =>
        note.reason !== 'unresolved_identity' && note.reason !== 'ambiguous_identity',
    ),
  });
}

/** Records a quantity the user typed. A typed number is never approximate. */
export function setQuantity(
  state: IntakeReviewState,
  id: string,
  quantity: StatedQuantity,
): IntakeReviewState {
  const proposal = state.proposals.find((candidate) => candidate.id === id);
  if (!proposal) return state;
  const known = quantity.amount != null || quantity.containerCount != null;
  return replaceProposal(state, {
    ...proposal,
    quantity,
    quantityStrength: quantity.approximate ? 'approximate' : known ? 'stated' : 'unknown',
    notes: proposal.notes.filter(
      (note) =>
        !(known && (note.reason === 'unknown_quantity' || note.reason === 'approximate_quantity')) &&
        !(known && note.reason === 'too_many_containers' && materialise(quantity).blocked == null),
    ),
  });
}

export function selectedProposals(
  state: IntakeReviewState,
): PantryIntakeProposal[] {
  return state.proposals.filter((proposal) => isSelected(state, proposal.id));
}

/** Proposals still waiting on a decision the user has not made. */
export function unresolvedProposals(
  state: IntakeReviewState,
): PantryIntakeProposal[] {
  return state.proposals.filter((proposal) => !isAcceptable(proposal));
}

/** How many pantry rows the current selection would create. */
export function pendingRowCount(state: IntakeReviewState): number {
  return selectedProposals(state).reduce(
    (total, proposal) => total + materialise(proposal.quantity).rows.length,
    0,
  );
}

/**
 * The words on the only button that writes anything.
 *
 * It states the number of rows and where they go, because "Confirm" tells the
 * user nothing about the size of the change they are about to make. When the
 * batch spans several shelves it says so rather than naming one of them, which
 * would be worse than naming none.
 */
export function finalActionLabel(
  state: IntakeReviewState,
  locations: readonly Location[],
): string {
  const rows = pendingRowCount(state);
  if (rows === 0) return 'Nothing selected';

  const noun = rows === 1 ? 'item' : 'items';
  const destinations = new Set(
    selectedProposals(state)
      .map((proposal) => proposal.locationId)
      .filter((id): id is string => id != null),
  );

  if (destinations.size === 1) {
    const [only] = [...destinations];
    const name = locations.find((location) => location.id === only)?.name;
    if (name) return `Add ${rows} ${noun} to ${name}`;
  }
  if (destinations.size > 1) {
    return `Add ${rows} ${noun} across ${destinations.size} places`;
  }
  return `Add ${rows} ${noun}`;
}

/** What the screen reader is told once the batch has been written. */
export function successSummary(rows: number, skipped: number): string {
  const noun = rows === 1 ? 'item' : 'items';
  if (skipped === 0) return `Added ${rows} ${noun} to your pantry.`;
  const left = skipped === 1 ? '1 phrase was' : `${skipped} phrases were`;
  return `Added ${rows} ${noun} to your pantry. ${left} left out.`;
}

/** What the screen reader is told when parsing finishes, before review. */
export function reviewOpeningSummary(
  proposals: readonly PantryIntakeProposal[],
): string {
  const { clear, needsLook } = partitionProposals(proposals);
  if (proposals.length === 0) {
    return 'No items found. You can keep speaking, edit the transcript, or type instead.';
  }
  const found = `Found ${proposals.length} ${proposals.length === 1 ? 'item' : 'items'}`;
  if (needsLook.length === 0) return `${found}. All of them look clear.`;
  return `${found}: ${clear.length} clear, ${needsLook.length} needing a look.`;
}
