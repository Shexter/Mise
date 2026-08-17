## 1. Shared interaction foundation

- [x] 1.1 Inventory all repeated add/edit surfaces and map their primary
      identity, secondary fields, draft state, and current scroll behavior.
- [x] 1.2 Build the shared collapsible editor row using theme tokens and the
      existing pressable/card conventions.
- [x] 1.3 Add controlled single-expansion state helpers and preserve dirty draft
      state across collapse/reopen.
- [x] 1.4 Add unit/component tests for summary, disclosure, switching rows,
      initial expansion, invalid drafts, and accessibility state.

## 2. Core nutrition and pantry flows

- [x] 2.1 Collapse meal review/edit item details behind identity rows while
      keeping totals and save behavior visible.
- [x] 2.2 Collapse pantry add/edit secondary fields behind ingredient identity;
      keep new pantry entries initially expanded.
- [x] 2.3 Preserve keyboard scrolling, validation, correction provenance, and
      app-wide edit refresh behavior.
- [x] 2.4 Add tests for meal and pantry add/edit persistence and reopening drafts.

## 3. Capture and import flows

- [x] 3.1 Collapse barcode product details behind product-name summaries in
      single, batch, and recovery review.
- [x] 3.2 Collapse receipt lines behind line-name summaries while keeping match
      status and correction actions discoverable.
- [x] 3.3 Add tests for barcode/receipt switching, raw capture preservation,
      correction provenance, and offline failure behavior.

## 3a. Receipt history and recovery

- [x] 3a.1 Add a Pantry Receipts subsection and durable receipt-history list.
- [x] 3a.2 Allow saved receipts to reopen in non-reapplying review mode with
      their original photo and extracted lines.
- [x] 3a.3 Add a follow-up recovery path from saved receipt review that opens
      manual pantry entry without duplicating the receipt import.

## 4. Recipes and shopping

- [x] 4.1 Collapse recipe ingredient details behind ingredient names while
      preserving quantity editing and unresolved-match actions.
- [x] 4.2 Collapse shopping-list item details behind item names and status;
      keep completion and undo actions one tap away.
- [x] 4.3 Verify saved recipe, pantry, and shopping-list refresh signals remain
      correct after edits.

## 5. Accessibility and acceptance

- [ ] 5.1 Verify all themes, large text, screen readers, keyboard, reduced
      motion, and narrow Galaxy S25+ layouts.
- [x] 5.2 Verify no required field becomes unreachable when collapsed and that
      summaries identify the correct item.
- [x] 5.3 Run `npm run typecheck`, `npm test`, strict OpenSpec validation, and
      `git diff --check`.
- [ ] 5.4 Record owner device evidence before archiving this change.
