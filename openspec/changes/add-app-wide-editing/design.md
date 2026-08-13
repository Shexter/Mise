## Context

The app already has domain-specific persistence and a partial logged-meal editing path. Pantry, capture, recipes, and shopping list have different shapes and derived effects, so a single generic database editor would violate identity and depletion rules. See `proposal.md` and the app-wide-editing delta spec for the user contract.

## Goals / Non-Goals

**Goals:** establish a reusable edit interaction pattern, implement Pantry first, then close every existing user-created record type; keep updates atomic and route recalculation through existing domain logic; make future add features include edit acceptance from the start.

**Non-Goals:** generic reflection-based CRUD, editing inference directly, server sync, bulk editing, or replacing the existing capture/review confirmation steps.

## Decisions

1. **Use domain-specific edit commands behind shared UI conventions.** A shared `EditAction`/form shell can standardize presentation, but each domain owns field validation and save semantics. This avoids a generic editor accidentally changing canonical identity, provenance, or stock semantics. A single generic record editor was rejected because records have different invariants.

2. **Treat the add form as the source of the edit form.** Each edit form should reuse the fields, labels, units, and validation from its corresponding add/review flow, with values prefilled and fields disabled only when they are genuinely derived or immutable. This prevents an add path from gaining fields that cannot later be corrected.

3. **Persist source changes atomically, then refresh dependents.** Query-layer update functions will validate and write the owned record in a transaction where multiple tables must move together. Existing meal reversal/reapply, shopping matching, recipe gap, and analytics selectors remain the source of truth rather than duplicating calculations in UI components.

4. **Make identity changes explicit.** A user correction to a canonical item is a first-class choice and may alter downstream matching, but captured text, barcode/receipt source, and confidence remain provenance. The UI must distinguish “change what this is” from editing a display label or quantity.

5. **Use migration only when the current schema cannot represent the edit.** Most records already have mutable columns, so first inspect the live schema and query contracts. If a new correction/provenance field is required, append one migration to `MIGRATIONS`; never edit a shipped migration.

## Modules and surfaces

- `app/(tabs)/pantry.tsx` and pantry components: edit pantry entries and status/location fields.
- `app/today.tsx`, `app/meal/[id].tsx`, `app/review.tsx`, and meal editor components: align meal editing with the shared contract.
- `app/recipe/[id].tsx` and recipe data paths: edit saved recipe metadata and ingredient names/quantities.
- `app/receipt-review.tsx`, capture/barcode screens, and `src/logic/receiptService.ts`: correct resolved identities and quantities before/after applying capture.
- Shopping-list surfaces and `src/logic/shoppingList.ts`: edit manual items and source-owned fields without breaking source links.
- `src/db/queries.ts`, `src/types.ts`, `src/logic/*`, exports, and tests: implement atomic updates and dependent refreshes.

## Risks / Trade-offs

- [Risk] Editing a pantry identity can change depletion or recipe matching unexpectedly → require explicit identity confirmation and test the before/after downstream state.
- [Risk] A generic form drifts from an add flow → make field parity a task and add UI contract tests for every supported record.
- [Risk] Partial writes leave stale analytics or duplicate items → use transaction-scoped query commands and refresh from canonical selectors after save.
- [Risk] The scope grows as new record types are discovered → inventory existing add flows first, define the coverage matrix, and add a release checklist rule for every future add feature.

## Migration Plan

1. Inventory every persisted user-created record and map add/detail/edit/dependent paths.
2. Implement shared interaction primitives and Pantry end to end.
3. Migrate existing meal, recipe, capture, barcode, and shopping-list paths in dependency order.
4. Add regression tests, run typecheck/full suite/strict OpenSpec validation, and perform owner device checks.
5. If a schema migration is needed, append it and verify upgrade, export, reset, and rollback-safe failure behavior.

## Open Questions

None that change the contract or task breakdown. Whether a field is editable is resolved per record in the coverage matrix: user-supplied fields are editable; derived/audit fields are not.
