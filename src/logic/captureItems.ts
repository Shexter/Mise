import type { CaptureItem } from '@/api/capture';
import { getAllCanonicals, getLocations } from '@/db/queries';
import { predictExpiry } from '@/logic/expiry';
import { planIntakeProposals, type IntakeCandidate } from '@/logic/intakeProposals';
import type { MatchOutcome } from '@/logic/match';
import { resolveIngredientReferences } from '@/logic/resolution';
import type { CanonicalItem, Location, ReceiptLine } from '@/types';

/** One photographed grocery item, prepared for review but not persisted. */
export interface CaptureItemProposal {
  captured: CaptureItem;
  outcome: MatchOutcome;
  canonical: CanonicalItem | null;
  /** Preselected from the canonical's default storage location. */
  location: Location | null;
  /** The review may show this before the user accepts the item. */
  predictedExpiry: string | null;
}

/** Turns included food lines from a misrouted receipt into grocery proposals. */
export function captureItemsFromReceiptLines(lines: readonly ReceiptLine[]): CaptureItem[] {
  return lines
    .filter((line) => line.kind === 'food' && !line.excluded)
    .map((line) => ({ name: line.rawText, quantity: line.qty, unit: line.unit }));
}

/**
 * Pairs every captured item with its own matching outcome and a user-editable
 * default location. This is intentionally read-only: accepting the review is
 * the only later step allowed to create pantry rows.
 *
 * Identity and location now come from `planIntakeProposals`, shared with voice
 * and manual intake, so the three channels cannot disagree about what an
 * uncertain match means. The photo-shaped return type is kept: this screen's
 * review reads `captured`, and changing it would be a rewrite of the camera
 * path for no benefit to the camera path.
 */
export function planCaptureItems(
  items: readonly CaptureItem[],
  outcomes: readonly MatchOutcome[],
  canonicals: readonly CanonicalItem[],
  locations: readonly Location[],
  purchasedAt: string,
): CaptureItemProposal[] {
  const candidates: IntakeCandidate[] = items.map((captured, index) => ({
    id: `photo-${index}`,
    statedName: captured.name,
    quantity: {
      containerCount: null,
      amount: captured.quantity,
      unit: captured.unit,
      approximate: false,
    },
  }));

  const canonicalById = new Map(canonicals.map((canonical) => [canonical.id, canonical]));
  const locationById = new Map(locations.map((location) => [location.id, location]));

  const proposals = planIntakeProposals(candidates, outcomes, {
    draftId: 'photo-capture',
    source: 'photo',
    canonicals,
    locations,
  });

  return proposals.map((proposal, index) => {
    const canonical = proposal.canonicalId
      ? canonicalById.get(proposal.canonicalId) ?? null
      : null;
    const location = proposal.locationId
      ? locationById.get(proposal.locationId) ?? null
      : null;
    return {
      captured: items[index]!,
      outcome: outcomes[index] ?? {
        status: 'unresolved' as const,
        raw: items[index]!.name,
        norm: items[index]!.name,
        queued: false,
      },
      canonical,
      location,
      predictedExpiry:
        canonical && location
          ? predictExpiry(canonical, location.kind, purchasedAt, null)
          : null,
    };
  });
}

/**
 * Resolves all grocery names as one vision-originated batch, then returns
 * review proposals. It deliberately does not insert pantry items.
 */
export async function resolveCapturedItems(
  items: readonly CaptureItem[],
  purchasedAt: string,
  signal?: AbortSignal,
): Promise<CaptureItemProposal[]> {
  const [outcomes, canonicals, locations] = await Promise.all([
    resolveIngredientReferences(items.map((item) => ({ raw: item.name })), 'vision', signal),
    getAllCanonicals(),
    getLocations(),
  ]);
  return planCaptureItems(items, outcomes, canonicals, locations, purchasedAt);
}
