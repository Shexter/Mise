import type { ExtractedLine } from '@/api/receipt';
import type { RawReference } from '@/logic/match';
import type {
  CanonicalItem,
  Location,
  MeasureUnit,
  PantryItem,
  ReceiptLine,
  ReceiptType,
} from '@/types';

/**
 * Pure receipt logic: turning extracted lines into matcher references, and
 * planning the pantry changes a review accepts. No database, no network —
 * mirrors the shape `add-stock-depletion` uses for `planDepletion`, so the
 * reconciliation rule (decision 68) is testable as a function from inputs
 * to intended changes rather than through the database.
 */

/** One food line, paired with its position in the receipt's line list. */
export interface LineReference {
  lineIndex: number;
  reference: RawReference;
}

/**
 * Builds matcher references for every food line, in printed order.
 * Non-food, arithmetic, and discount lines never reach the matcher — that
 * is what tells an unmatched food line apart from a line that was never
 * food to begin with (decision 69).
 */
export function referencesFromLines(
  lines: readonly ExtractedLine[],
  store?: string,
): LineReference[] {
  const result: LineReference[] = [];
  lines.forEach((line, lineIndex) => {
    if (line.kind !== 'food') return;
    result.push({
      lineIndex,
      reference: store ? { raw: line.text, store } : { raw: line.text },
    });
  });
  return result;
}

export interface PlannedPantryItem {
  canonicalId: string;
  locationId: string;
  qtyRemaining: number | null;
  qtyUnit: MeasureUnit | null;
  priceCents: number | null;
  purchasedAt: string;
}

/** One intended change against the catalogue, or against nothing. */
export type PantryChange =
  | { kind: 'create'; lineId: string; item: PlannedPantryItem }
  | { kind: 'mark_replaced'; lineId: string; pantryItemId: string }
  | { kind: 'flag_asked'; lineId: string; pantryItemId: string };

/**
 * A canonical's own default location, when the app has one of that kind —
 * the same fallback `AddPantryItemSheet` uses, applied here because a
 * receipt line never asks the user where something goes.
 */
function locationFor(
  canonical: CanonicalItem,
  locations: readonly Location[],
): string | null {
  const preferred = locations.find((l) => l.id === canonical.defaultLocation);
  return preferred?.id ?? locations[0]?.id ?? null;
}

/**
 * Plans the pantry changes for one receipt's resolved lines.
 *
 * A grocery receipt always creates a new pantry item per resolved,
 * non-excluded food line, at a known quantity with zero drift (decision
 * 68) — reconciliation against existing stock of the same canonical then
 * depends on each existing item's own state: `out` items are marked
 * replaced, a `running_low` item not yet asked is flagged once, and
 * `in_stock` items are left alone.
 *
 * Returns an empty plan for a receipt that is not a grocery purchase — its
 * spending is recorded, but it creates no pantry item (decision 11
 * arriving through a second door).
 */
export function planReceiptApply(
  lines: readonly ReceiptLine[],
  catalogue: readonly PantryItem[],
  canonicals: ReadonlyMap<string, CanonicalItem>,
  locations: readonly Location[],
  receiptType: ReceiptType,
  purchasedAt: string,
): PantryChange[] {
  if (receiptType !== 'grocery') return [];

  const changes: PantryChange[] = [];

  for (const line of lines) {
    if (line.excluded) continue;
    if (line.kind !== 'food') continue;
    if (!line.canonicalId) continue; // still unresolved; nothing to apply yet

    const canonical = canonicals.get(line.canonicalId);
    const locationId = canonical ? locationFor(canonical, locations) : null;
    if (!canonical || !locationId) continue; // nothing to place it in — refuse rather than guess

    changes.push({
      kind: 'create',
      lineId: line.id,
      item: {
        canonicalId: line.canonicalId,
        locationId,
        qtyRemaining: line.qty,
        qtyUnit: line.unit,
        priceCents: line.lineTotalCents,
        purchasedAt,
      },
    });

    for (const item of catalogue) {
      if (item.canonicalId !== line.canonicalId) continue;
      if (item.status === 'out') {
        changes.push({ kind: 'mark_replaced', lineId: line.id, pantryItemId: item.id });
      } else if (item.status === 'running_low' && !item.replacementAsked) {
        changes.push({ kind: 'flag_asked', lineId: line.id, pantryItemId: item.id });
      }
      // in_stock, discarded, replaced, and already-asked running_low items
      // are left untouched — the automatic branch is only the one where
      // the app already believes there is nothing left.
    }
  }

  return changes;
}
