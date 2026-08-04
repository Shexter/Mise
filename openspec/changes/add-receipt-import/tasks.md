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
- [x] 3.5 Unit-test parsing against the fixtures, including a malformed
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

## 5. Resolution

- [ ] 5.1 Call `resolve()` with `source: 'receipt'` for all food lines of a
      receipt in one batch. Do not add a receipt-specific matching path.
- [ ] 5.2 Map outcomes onto lines: resolved applies, needs-confirmation surfaces
      in review, unresolved queues.
- [ ] 5.3 Confirm non-food lines never reach the review queue, and that an
      unresolved *food* line is distinguishable from an excluded non-food line.
- [ ] 5.4 Integration-test a whole fixture receipt through real queries and real
      seed data — extraction stubbed, matching real.

## 6. Persistence

- [ ] 6.1 Add receipt and line queries to `src/db/queries.ts`: insert a pending
      receipt with its lines, read one back, list by date, update a line during
      review.
- [ ] 6.2 Implement accept-the-review as one transaction: apply the planned
      changes, create pantry items, link lines to the items they created, and
      mark the receipt applied.
- [ ] 6.3 Ensure nothing is applied while a receipt is pending, so an abandoned
      review leaves no trace in the pantry.
- [ ] 6.4 Persist the asked-once replacement flag so a later receipt never
      re-asks about the same item.
- [ ] 6.5 Route review corrections through the existing user-resolution path so
      they are learned as aliases.

## 7. Capture and images

- [ ] 7.1 Extend `src/media/photos.ts` with a receipts subdirectory, reusing the
      existing resize and compress path rather than duplicating it.
- [ ] 7.2 Build receipt capture — camera and library pick — following the
      existing capture screen's conventions.
- [ ] 7.3 Retain a receipt captured with no connection and complete extraction
      when one returns, without asking the user to re-photograph.
- [ ] 7.4 Tell the user a receipt is pending rather than failing silently.

## 8. Review screen

The feature, not polish. A thirty-line receipt with two wrong lines is only
usable if the two are findable.

- [ ] 8.1 Build the review screen: lines grouped by state, with confidently
      resolved ones collapsed and uncertain ones surfaced.
- [ ] 8.2 Allow correcting the matched ingredient, editing quantity and price,
      and excluding a line.
- [ ] 8.3 Show excluded non-food lines collapsed but reachable, so a wrong
      exclusion is recoverable rather than invisible.
- [ ] 8.4 Allow changing the receipt type, re-planning rather than undoing.
- [ ] 8.5 Show the reconciliation prompt for running-low items inline.
- [ ] 8.6 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.
- [ ] 8.7 Show canonical display names throughout; raw line text appears only as
      provenance.

## 9. Verification

- [ ] 9.1 Import a real grocery receipt end to end and confirm the pantry
      contains what was bought.
- [ ] 9.2 Import a restaurant receipt and confirm spending is recorded and no
      pantry item is created.
- [ ] 9.3 Buy an ingredient already in stock and confirm two items exist; buy one
      whose existing item is out and confirm it is marked replaced.
- [ ] 9.4 Confirm a review correction makes the same line resolve correctly on a
      second receipt.
- [ ] 9.5 Abandon a review and confirm the pantry is untouched.
- [ ] 9.6 Confirm *Delete all data* removes receipts, lines, and image files.
- [ ] 9.7 Run `npm run typecheck` and `npm test`, then record extraction
      accuracy across the fixture receipts in `docs/product-decisions.md`.
