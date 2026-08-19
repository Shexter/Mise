## 1. Contract and data model

- [x] 1.1 Inspect current pantry status, recipe coverage, suggestion missing-item, receipt line, export, and reset contracts; record exact adapters needed in the implementation handoff.
- [x] 1.2 Add shopping-list types and source/status enums to `src/types.ts`, preserving nullable canonical IDs and quantities.
- [x] 1.3 Append one forward-only migration for shopping items, source rows, and receipt matches; extend `DROP_ALL` and migration tests.
- [x] 1.4 Add query-layer CRUD, source association, receipt-match, undo, export, and reset operations in `src/db/queries.ts`.

## 2. Pure shopping-list logic

- [x] 2.1 Implement canonical and exact normalized-text deduplication with source merging.
- [x] 2.2 Implement conservative refresh planning for pantry status, recipe gaps, suggestion gaps, and manual entries.
- [x] 2.3 Implement qualitative quantity copy, explicit quantity preservation, category grouping, and stable ordering.
- [x] 2.4 Implement receipt exact-match eligibility, idempotent completion, and isolated undo transitions.
- [x] 2.5 Add unit tests for all pure logic, including unknown items, stale sources, duplicate sources, fuzzy-match rejection, and undo.

## 3. Pantry Shop surface

- [x] 3.1 Add Stock / Recipes / Shop subsection navigation while keeping Stock selected by default.
- [x] 3.2 Build grouped Shop list with source explanations, qualitative states, completion, snooze, dismiss, restore, and empty states.
- [x] 3.3 Add manual item entry/edit UI for resolved and unresolved names, optional quantity/unit, note, and category.
- [x] 3.4 Keep Today unchanged and cover themes, large text, reduced motion, and screen-reader selected-state semantics.

## 4. Recipe and suggestion entry points

- [x] 4.1 Add Add missing ingredients to saved recipe detail and route only uncovered ingredients into the list.
- [x] 4.2 Add the same action to dinner-suggestion review for explicit missing ingredients.
- [x] 4.3 Preserve source provenance and make repeated add actions idempotent.

## 5. Receipt reconciliation

- [x] 5.1 Invoke exact shopping matches after confirmed receipt application without duplicating receipt or pantry writes.
- [x] 5.2 Add purchased-match review/undo UI and keep undo isolated from pantry effects.
- [x] 5.3 Add tests for exact barcode/canonical matches, fuzzy rejection, repeated receipt processing, and undo.

## 6. Local data lifecycle

- [x] 6.1 Include shopping records in export with nullable quantities and source provenance.
- [x] 6.2 Include shopping tables and receipt-match records in Delete all data.
- [x] 6.3 Verify offline reads and manual edits use only local persistence.

## 7. Verification and acceptance

- [x] 7.1 Add UI contract tests for Pantry navigation, uncrowded Today, category ownership, and accessibility labels.
- [x] 7.2 Run `npm run typecheck`, `npm test`, strict OpenSpec validation, and `git diff --check`.
- [x] 7.3 Add owner/device acceptance tasks for real pantry, recipe gap, receipt match, undo, offline restart, themes, large text, and screen readers.
