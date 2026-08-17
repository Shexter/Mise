## 1. Fixtures first

The matcher's corpus covers line *text*. Nothing yet covers whole receipts, and
extraction is the part with no local ground truth.

- [x] 1.1 Create `src/logic/__fixtures__/receipts.ts` with at least 8 whole
      receipts as structured extraction output: two supermarkets, one Asian
      grocer, one warehouse club, one restaurant, one with no legible date, one
      with heavy non-food content, one with multi-quantity lines.
- [x] 1.2 Include the arithmetic and payment tails — subtotal, tax, total,
      change, card digits — since classifying those is a stated requirement.
- [x] 1.3 Reuse `NON_FOOD_LINES` from `receipt-lines.ts` rather than authoring a
      second list.
- [x] 1.4 Add the money-shaped cases, which are where receipts stop being lists
      and start being arithmetic: a weight-priced line (`0.834 kg @ £12.99/kg`),
      a line-attributed discount, an unattributable basket discount, a
      multi-buy, a bottle deposit, a bag levy, a refunded line on an otherwise
      normal receipt, and one whole return receipt.
- [x] 1.5 Add a receipt whose lines deliberately do not sum to its printed
      total, so the discrepancy path has a fixture rather than a hypothetical.
- [x] 1.6 Add a receipt listing the same ingredient on two separate lines, and
      one with a `2 @` multiple, since these produce different item counts and
      are easy to conflate.

## 2. Schema

- [x] 2.1 Append the migration creating `receipts` and `receipt_lines` per the
      design's migration plan, with indexes on receipt id and purchase date.
- [x] 2.2 Add the asked-once replacement flag to `pantry_items` in the same
      migration.
- [x] 2.3 Extend `DROP_ALL`, and extend the delete-all path to remove stored
      receipt images — dropping rows while leaving image files behind would
      strand the most sensitive artefact this app holds.
- [x] 2.4 Add `Receipt`, `ReceiptLine`, `ReceiptType`, and `ReceiptLineKind` to
      `src/types.ts` with their `readonly` value arrays.
- [x] 2.5 Verify the migration runs from the current head and that
      `npm run typecheck` passes.

## 3. Extraction

- [x] 3.1 Write `src/api/receiptPrompt.ts` following `src/api/prompt.ts`: raw
      JSON only, explicit schema, per-line `kind` of
      `food | non_food | arithmetic | discount`, plus header fields and a
      receipt type.
- [x] 3.2 Bias the prompt toward classifying ambiguous lines as food. A
      misclassified food line disappears silently; a misclassified non-food line
      is merely visible clutter.
- [x] 3.3 Implement `src/api/receipt.ts` through the existing provider facade
      and `src/api/errors.ts`. One call per receipt. Do not touch `keyStore.ts`.
- [x] 3.4 Parse defensively — a missing date falls back to capture date, a
      missing price leaves the line priced-unknown rather than zero.
- [x] 3.5 Ask for the printed measure and unit price separately from the line
      total, so a weight-priced line is distinguishable from a counted one
      downstream. Collapsing them at extraction cannot be undone later.
- [x] 3.6 Extend the per-line `kind` with `deposit` and `refund`, and ask whether
      a discount names a line. Folding these into `non_food` loses the
      distinction between clutter and arithmetic.
- [x] 3.7 Ask for the printed subtotal, tax, and total as header fields, since
      the arithmetic check needs the receipt's own figure rather than a sum.
- [x] 3.8 Unit-test parsing against the fixtures, including a malformed
      response.

## 4. Line planning

Pure logic. No database, no network.

- [x] 4.1 Implement `src/logic/receipt.ts`: turn extracted lines into references
      for the matcher, excluding every line whose kind is not `food`.
- [x] 4.2 Extend `normalise` to accept an optional store, consulting that
      store's prefixes first and falling back to `STORE_BRAND_PREFIXES`. Keep
      the existing single-argument signature working so no caller moves.
- [x] 4.3 Implement `planReceiptApply(lines, catalogue): PantryChange[]`,
      mirroring the shape `add-stock-depletion` uses for `planDepletion`.
- [x] 4.4 Encode decision 68's reconciliation: create a new pantry item always;
      mark existing `out` items replaced; flag a `running_low` item for the
      asked-once prompt; leave `in_stock` items alone.
- [x] 4.5 Set new items to the purchased quantity with zero estimation drift.
- [x] 4.6 Carry line price onto the created pantry item, distinguishing line
      total from per-unit price where quantity exceeds one.
- [x] 4.7 Return an empty plan for receipts whose type is not grocery.
- [x] 4.8 Unit-test every reconciliation branch, the non-grocery case, and the
      multi-quantity price split.

### 4a. Quantity, which is two different things

- [x] 4a.1 Read a weight- or volume-priced line as a **measure**, not a count.
      `0.834 kg @ £12.99/kg` is 834 g of one thing, and the number that looks
      most like a quantity is the one that must not be used as one.
- [x] 4a.2 Read a per-unit multiple as a **count**.
- [x] 4a.3 Distinguish the two by whether the printed unit price is per measure
      or per item, and leave the measure unknown when neither is legible.
      Decision 15 forbids inventing a quantity to display; inventing one to
      store is the same mistake earlier.
- [x] 4a.4 Create one pantry item per container for a count, per decision 56, and
      a single item for a divisible measure.
- [x] 4a.5 Divide the line total across the items a count creates.
- [x] 4a.6 Treat the same ingredient on two lines as two purchases, not a
      duplicate to be collapsed. Two lines usually means two containers, and
      collapsing them loses stock the user paid for.
- [x] 4a.7 Unit-test all four shapes against the 1.6 fixtures.

### 4b. Money that is not a purchase

- [x] 4b.1 Apply a line-attributed discount to that line's recorded price.
- [x] 4b.2 Apply an unattributable discount to the receipt total only, and do not
      spread it across lines — a spread is a guess that then looks like a fact.
- [x] 4b.3 Record deposits and levies as spending, never as ingredients.
- [x] 4b.4 Create nothing for a refunded or voided line.
- [x] 4b.5 Handle a wholly negative receipt: spending goes negative, stock does
      not move. Returning food does not put it back on the shelf, and the app
      has no way to know which item it was.
- [x] 4b.6 Unit-test each, including the whole-return receipt.

### 4c. The receipt's arithmetic

- [x] 4c.1 Sum the extracted lines and compare against the printed total.
- [x] 4c.2 Surface a discrepancy during review. It is the only cheap signal that
      extraction dropped or duplicated a line, and the receipt hands it over.
- [x] 4c.3 **Never adjust a line to make it balance.** A plausible receipt built
      from a wrong line is worse than a visible mismatch.
- [x] 4c.4 Say nothing when it agrees.
- [x] 4c.5 Test against the 1.5 fixture, and confirm silence on a balanced one.

## 5. Resolution

- [x] 5.1 Call `resolve()` with `source: 'receipt'` for all food lines of a
      receipt in one batch. Do not add a receipt-specific matching path.
- [x] 5.2 Map outcomes onto lines: resolved applies, needs-confirmation surfaces
      in review, unresolved queues.
- [x] 5.3 Confirm non-food lines never reach the review queue, and that an
      unresolved *food* line is distinguishable from an excluded non-food line.
- [x] 5.4 Integration-test a whole fixture receipt through real queries and real
      seed data — extraction stubbed, matching real.

## 6. Persistence

- [x] 6.1 Add receipt and line queries to `src/db/queries.ts`: insert a pending
      receipt with its lines, read one back, list by date, update a line during
      review.
- [x] 6.2 Implement accept-the-review as one transaction: apply the planned
      changes, create pantry items, link lines to the items they created, and
      mark the receipt applied.
- [x] 6.3 Ensure nothing is applied while a receipt is pending, so an abandoned
      review leaves no trace in the pantry.
- [x] 6.4 Persist the asked-once replacement flag so a later receipt never
      re-asks about the same item.
- [x] 6.5 Route review corrections through the existing user-resolution path so
      they are learned as aliases.

## 7. Capture and images

- [x] 7.1 Extend `src/media/photos.ts` with a receipts subdirectory, reusing the
      existing resize and compress path rather than duplicating it.
- [x] 7.2 Build receipt capture — camera and library pick — following the
      existing capture screen's conventions. Built as `app/receipt-capture.tsx`,
      a standalone screen, per the spec as it stood when this was implemented.
      **Superseded by later planning** (see below) — not yet reconciled.
- [x] 7.2a Later planning revises 7.2: receipts should arrive from the shared
      Add to pantry surface in `add-unified-capture` rather than through their
      own capture screen, with `receipt-capture.tsx` becoming just the review
      handler a library pick still routes to. Unified capture now owns every
      first receipt photo, including unclear-photo recovery; this handler is
      retained only for adding or retaking frames from an existing review.
- [x] 7.3 Retain a receipt captured with no connection and complete extraction
      when one returns, without asking the user to re-photograph.
- [x] 7.4 Tell the user a receipt is pending rather than failing silently.

## 8. Review screen

The feature, not polish. A thirty-line receipt with two wrong lines is only
usable if the two are findable.

- [x] 8.1 Build the review screen: lines grouped by state, with confidently
      resolved ones collapsed and uncertain ones surfaced.
- [x] 8.2 Allow correcting the matched ingredient, editing quantity and price,
      and excluding a line.
- [x] 8.3 Show excluded non-food lines collapsed but reachable, so a wrong
      exclusion is recoverable rather than invisible.
- [x] 8.4 Allow changing the receipt type, re-planning rather than undoing.
- [x] 8.5 Show the reconciliation prompt for running-low items inline.
- [x] 8.5a Show the arithmetic discrepancy where it is actionable — at the total,
      with the sum beside it — not as a banner the user cannot do anything about.
- [x] 8.5b Let a quantity be edited as a measure or as a count, matching how the
      line was read. A weight line offering a stepper is a wrong control.
- [x] 8.5c Show discounts, deposits, and refunds in the receipt's money section
      rather than among the food lines, so the line list stays a list of things
      bought.
- [x] 8.6 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.
- [x] 8.7 Show canonical display names throughout; raw line text appears only as
      provenance.

## 9. Verification

- [x] 9.1 Import a real grocery receipt end to end and confirm the pantry
      contains what was bought.
- [x] 9.2 Import a restaurant receipt and confirm spending is recorded and no
      pantry item is created.
- [x] 9.3 Buy an ingredient already in stock and confirm two items exist; buy one
      whose existing item is out and confirm it is marked replaced.
- [x] 9.4 Confirm a review correction makes the same line resolve correctly on a
      second receipt.
- [x] 9.5 Abandon a review and confirm the pantry is untouched.
- [x] 9.5a Import a receipt with loose produce priced by weight and confirm the
      pantry holds the weight, not one of something.
- [x] 9.5b Import a receipt with a multi-buy discount and confirm the recorded
      price is what was paid, not what was listed.
- [x] 9.5c Import a receipt including a returned item and confirm no stock was
      created for it and spending reflects the refund.
- [x] 9.6 Confirm *Delete all data* removes receipts, lines, and image files.
- [x] 9.7 Run `npm run typecheck` and `npm test`, then record extraction
      accuracy across the fixture receipts in `docs/product-decisions.md`.
