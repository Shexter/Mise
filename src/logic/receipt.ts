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
  lines: readonly Pick<ExtractedLine, 'text' | 'kind'>[],
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

/**
 * One intended change against the catalogue, or against nothing. A single
 * line can produce several `create` entries — a count line buys several
 * containers, and decision 56 makes each its own item (the "4a" quantity
 * work) — so `create` is not keyed uniquely by `lineId`.
 */
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
 * Splits a total into `count` integer-cent shares that sum back to it
 * exactly — the remainder lands on the first share rather than being lost
 * to rounding, so nobody's "share of the line total" quietly doesn't add up.
 */
function splitCents(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * The sum of every discount attributed to `lineId`, as a negative number
 * (or 0 when none) — discounts are recorded negative per the extraction
 * contract, so adding this to a line's price reduces it.
 */
function attributedDiscountCents(
  lineId: string,
  lines: readonly ReceiptLine[],
): number {
  return lines
    .filter((l) => l.kind === 'discount' && !l.excluded && l.appliesToLineId === lineId)
    .reduce((sum, l) => sum + (l.lineTotalCents ?? 0), 0);
}

/**
 * Plans the pantry changes for one receipt's resolved lines.
 *
 * A grocery receipt creates pantry items for each resolved, non-excluded
 * food line, at zero accumulated drift (decision 68). A count line ("2
 * GATORADE") creates one item per container, each holding a share of the
 * line's price; a measure line ("0.834 kg @ £12.99/kg") creates a single
 * item holding that measured amount — collapsing the two would either
 * misrepresent an unopened second container as more of an opened first one,
 * or invent a container size for loose produce that never had one. An
 * attributed discount reduces the price the item is created at, before any
 * split. Reconciliation against existing stock of the same canonical then
 * depends on each existing item's own state: `out` items are marked
 * replaced, a `running_low` item not yet asked is flagged once, and
 * `in_stock` items are left alone.
 *
 * Returns an empty plan for a receipt that is not a grocery purchase — its
 * spending is recorded, but it creates no pantry item (decision 11
 * arriving through a second door). Non-food, arithmetic, discount,
 * deposit, and refund lines never create anything either — only `food`
 * lines do.
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

    const effectivePriceCents =
      line.lineTotalCents === null
        ? null
        : line.lineTotalCents + attributedDiscountCents(line.id, lines);

    if (line.quantityKind === 'count' && line.qty !== null && line.qty >= 1) {
      const count = Math.max(1, Math.round(line.qty));
      const shares =
        effectivePriceCents !== null
          ? splitCents(effectivePriceCents, count)
          : Array.from({ length: count }, () => null);
      for (let i = 0; i < count; i += 1) {
        changes.push({
          kind: 'create',
          lineId: line.id,
          item: {
            canonicalId: line.canonicalId,
            locationId,
            qtyRemaining: 1,
            qtyUnit: 'piece',
            priceCents: shares[i] ?? null,
            purchasedAt,
          },
        });
      }
    } else {
      changes.push({
        kind: 'create',
        lineId: line.id,
        item: {
          canonicalId: line.canonicalId,
          locationId,
          qtyRemaining: line.qty,
          qtyUnit: line.unit,
          priceCents: effectivePriceCents,
          purchasedAt,
        },
      });
    }

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

export type ArithmeticCheck =
  | { status: 'unknown' }
  | { status: 'match' }
  | { status: 'mismatch'; sumCents: number; subtotalCents: number; differenceCents: number };

/** Lines that represent a real purchase-affecting amount, for the arithmetic check's sum. */
const MONEY_KINDS = ['food', 'non_food', 'deposit', 'refund', 'discount'] as const;

/**
 * Compares the sum of a receipt's extracted lines against its own printed
 * subtotal — the free correctness check design.md calls for. A mismatch
 * means extraction dropped, duplicated, or misread a line; agreement is not
 * remarked upon, and neither ever rewrites a line to force a match.
 *
 * `food`, `non_food`, `deposit`, `refund`, and every `discount` line —
 * attributed or not — are summed exactly as printed: the receipt shows a
 * food line at its shelf price and the discount as its own negative line,
 * and the printed subtotal already nets the two, so both must be counted
 * here to agree with it. Attribution only matters to `planReceiptApply`,
 * which decides what price a *pantry item* is created at — a different
 * question from whether the transcription is faithful. `arithmetic` lines
 * (subtotal, tax, total, card, change) are the receipt's own tally, not
 * purchases, and are excluded.
 */
export function checkArithmetic(
  lines: readonly ReceiptLine[],
  subtotalCents: number | null,
): ArithmeticCheck {
  if (subtotalCents === null) return { status: 'unknown' };

  const sumCents = lines
    .filter((l) => !l.excluded && MONEY_KINDS.includes(l.kind as (typeof MONEY_KINDS)[number]))
    .reduce((sum, l) => sum + (l.lineTotalCents ?? 0), 0);

  const differenceCents = sumCents - subtotalCents;
  if (differenceCents === 0) return { status: 'match' };
  return { status: 'mismatch', sumCents, subtotalCents, differenceCents };
}
