## 1. Inventory and shared contract

- [x] 1.1 Inventory every user-created persisted record, its add/detail/review surfaces, mutable fields, provenance, and dependent selectors; record the matrix in the change design or implementation handoff.
- [x] 1.2 Inspect existing specs and decisions for pantry, meal editing, identity, receipt, barcode, recipes, and shopping list; document any conflict before code changes.
- [x] 1.3 Add shared edit-action, form-shell, validation, save-state, cancel, and error conventions using existing theme tokens and accessibility labels.
- [x] 1.4 Add a future-feature checklist/test helper that fails a new user-created add flow unless its edit path is represented.

## 2. Pantry first

- [x] 2.1 Add query-layer update commands for pantry identity, status/quantity, storage, expiry, notes, and other user-supplied fields; keep SQL in `src/db/queries.ts`.
- [x] 2.2 Add the Pantry edit form, prefilled from the current row, with field parity to the add flow, validation, Cancel, Save, loading, and failure recovery.
- [x] 2.3 Ensure Pantry identity corrections are explicit and do not create duplicate canonical entries or erase capture provenance.
- [ ] 2.4 Refresh expiry/status, dinner suggestions, recipe gaps, shopping list, and analytics after a successful Pantry edit.
- [x] 2.5 Add Pantry logic, database, UI, export/reset, and restart regression tests.

## 3. Meals and recipes

- [x] 3.1 Align logged-meal and meal-item editing with the shared contract, including servings, date, venue, identity, stated quantity, and reversibility.
- [x] 3.2 Verify meal edits recalculate totals and pantry depletion through existing reversal/reapply rules without double-debiting.
- [x] 3.3 Add saved-recipe metadata and ingredient edit paths with explicit identity/quantity corrections and recipe-gap refresh.
- [x] 3.4 Add meal/recipe UI, logic, and dependent-state regression tests across Today, history, dinner suggestions, and recipe detail.

## 4. Capture, barcode, receipts, and shopping list

- [ ] 4.1 Add edit/correction paths to barcode and receipt review results before applying them, preserving raw capture and match provenance.
- [ ] 4.2 Add post-apply correction for user-owned pantry fields created by capture, with safe re-resolution and no duplicate stock rows.
- [x] 4.3 Add edit controls for manual and source-backed shopping-list items, preserving source links and recalculating open/closed grouping.
- [x] 4.4 Add regression tests for capture correction, barcode correction, receipt correction, shopping-list edits, and undo/error states.
- [ ] 4.4 Add regression tests for capture correction, barcode correction, receipt correction, shopping-list edits, and undo/error states.

## 5. Persistence, export, and quality gates

- [ ] 5.1 Append a forward-only migration only if the inventory finds missing persisted correction/provenance fields; add upgrade and DROP_ALL coverage.
- [x] 5.2 Update export and reset coverage so corrected data and provenance round-trip without API keys or secrets.
- [ ] 5.3 Run typecheck, full Vitest suite, strict OpenSpec validation, and `git diff --check`; fix regressions.
- [ ] 5.4 Perform owner checks on Android and iOS/Expo Go for every edit surface: save, cancel, invalid input, persistence after restart, large text, themes, screen readers, and offline failure.
- [ ] 5.5 Update the implementation handoff and queue with exact progress, remaining device evidence, and the rule that every future add flow must ship with edit parity.
