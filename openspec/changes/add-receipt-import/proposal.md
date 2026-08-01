## Why

Decision 60 changed what this is for. Receipt import was going to be a
convenience that saved typing; it is now the **primary way the pantry
populates**. The bear case established that a forty-minute photograph-everything
session cannot be the front door, and that receipts plus "I cooked this" fill a
kitchen as a side effect of ordinary use. People shop weekly, so one photograph
a week does most of the work that bulk capture was going to do in one sitting.

It carries a second job that matters just as much. Decision 21 makes receipts
the ground truth that meal-log estimates interpolate between, and decision 55
makes a purchase the event that clears accumulated drift. Without receipt
import, `add-stock-depletion`'s drift tracking has nothing to reset against, and
estimates only ever get worse.

And a third: it is the only source of `price_cents`, which decision 35 needs to
weight expiry urgency by value at risk, and which decision 50 identifies as the
thing that makes the product sellable — "you saved $312 this year" is not
computable without it.

Implements decisions 21, 55, and 60, and supplies the data decisions 35 and 50
depend on.

## What Changes

- **New forward-only migration** adding `receipts` and `receipt_lines`.
- **Photograph a receipt** and get structured line items back: text, price,
  quantity, plus the store and purchase date from the header.
- **Each line resolves through the existing cascade.** `resolve()` from
  `add-identity-layer` is already built, tested, and batch-first. This change
  produces references and consumes outcomes; it does not reimplement matching.
- **Receipts are typed** — grocery, restaurant, or other. A restaurant receipt
  records spending and creates no pantry items, which is decision 11's home-or-out
  distinction arriving through a second door.
- **Non-food lines are classified, not queued.** Paper towels, carrier bags,
  tax, and subtotal lines must be recognised as not-food and dropped. Treating
  them as unresolved food would fill the review queue with rubbish and teach the
  user to ignore it.
- **A purchase creates a pantry item and reconciles with what is already
  there**, per the clarified rule in decision 68 below.
- **The store name feeds normalisation.** Knowing a receipt is from Trader Joe's
  makes `TJ'S` prefix stripping correct rather than speculative.
- **Spending accrues from day one** even though no spending surface ships here.
- **Offline receipts queue** rather than failing (decision 8).

## Capabilities

### New Capabilities

- `receipt-import`: Turning a photographed receipt into structured lines, pantry
  items, and spending records. Covers capture and storage of the receipt,
  extraction of lines and header, receipt typing, non-food classification,
  resolution of lines through the existing matcher, creation and reconciliation
  of pantry items, price capture, and offline queuing.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Reimplementing matching.** `resolve()` exists and works. This change calls
  it.
- **Spending surfaces.** Charts, budgets, and the "you saved $312" figure are a
  later change. The data lands here; the interface does not.
- **Shopping lists.** Out of scope.
- **Bank or email integration.** Photographs only. Pulling transactions from a
  bank feed is a different product with a different trust model.
- **Correcting prices.** A misread price is editable when reviewing the receipt,
  but there is no reconciliation against a bank statement.
- **Loyalty cards, coupons, or per-item discounts.** Discount lines are
  recognised well enough not to be mistaken for food, and are otherwise ignored.

## Impact

**Schema.** One migration adding `receipts` and `receipt_lines`. `DROP_ALL`
extended.

**Code.**
- `src/api/receiptPrompt.ts` and `src/api/receipt.ts` — extraction, through the
  existing provider facade and error taxonomy.
- `src/logic/receipt.ts` — pure: turning extracted lines into references,
  classifying non-food, and planning pantry changes. Testable with no network.
- `src/db/queries.ts` — receipt and line persistence, and the reconciliation
  transaction.
- `src/media/photos.ts` — extended for receipt images, reusing the existing
  resize-and-compress path rather than duplicating it.
- `app/` — capture, review-and-correct, and receipt history screens.

**Dependencies.** None added.

**Depends on** `add-identity-layer` (merged) and `add-pantry-stock` (in
progress — this change creates pantry items, so it needs the table and the
expiry logic).

**Cost.** At most two model calls per receipt: one to extract, one to resolve
whatever the local cascade could not. Not per line.

**Risk.** Receipt extraction quality varies enormously by store, paper, and
lighting, and a receipt is long — thirty lines of which two are wrong is a
worse review experience than one wrong meal estimate. The review-and-correct
step is therefore not optional polish; it is the feature.

## Decision 68 — how a purchase meets existing stock

Recorded here because planning this change exposed an ambiguity between two
settled decisions. Decision 55 says a receipt matching an existing item *sets*
its amount and zeroes drift. Decision 56 says one pantry item is one physical
container. Those conflict: buying a bottle when you already own one is a second
container, not a correction to the first.

The resolution, which the spec below encodes:

**A purchase always creates a new pantry item.** It starts at a known quantity
with zero drift, so re-anchoring is automatic rather than a special case.

**Reconciliation then depends on the state of what is already there**, per
canonical ingredient:

- Existing items at status `out` are marked replaced. You bought a new one
  because the old one was finished.
- An existing item at `running_low` prompts once — "finished the old bottle?" —
  and is otherwise left alone.
- Existing items `in_stock` are left alone. You genuinely have two.

This keeps decision 56 intact, delivers decision 55's drift clearing through the
new item rather than by mutating the old one, and stops the catalogue silently
accumulating phantom half-empty containers.
