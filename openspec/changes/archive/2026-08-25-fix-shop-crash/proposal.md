## Why

Navigating to the Shop / Grocery List section within the Pantry tab can result in an unhandled crash or frozen loading state if legacy/corrupted category values, stale automatic source references, or unmapped recipe titles exist in the local SQLite database. This proposal hardens the shopping list data pipeline and UI rendering against invalid state, ensuring the grocery list always loads smoothly and handles unknown or corrupted rows gracefully.

This implements the local-first resilience and explainable-stock principles in product decisions 5, 9, 11, 35, and 161.

## What Changes

- Ensure all database queries reading shopping list items, sources, and categories sanitize unknown or invalid records into safe fallback defaults (e.g. `'other'` category) at both query time and presentation time.
- Protect `ShoppingListSection` and child views (`ShoppingSection`, `ShoppingHistory`, `CollapsibleEditorRow`, `ManualShoppingItemSheet`) with defensive checks against `undefined` / `null` category label keys, missing sources, or orphaned IDs.
- Wrap shopping list reconciliation and initial load in robust try-catch handling with graceful UI fallback rather than unhandled rejection.
- Ensure the database schema, reset scripts, and test suite maintain full verification of corrupted/legacy shopping list data recovery.

## Capabilities

### New Capabilities
- `shopping-list`: Hardened, crash-resilient grocery haul and shopping list management ensuring graceful fallbacks for legacy/corrupted data.

### Modified Capabilities
<!-- None: standard capability requirements are preserved; resilience is enforced -->

## Non-goals

- No redesign of the grocery list feature or addition of remote sync.
- No changes to price tracking, store layouts, or aisle navigation.

## Impact

- `src/components/pantry/ShoppingListSection.tsx`: Defensive fallbacks for labels, category lookups, recipe titles, and asynchronous loading.
- `src/logic/shoppingList.ts` & `src/db/queries.ts`: Fallback handling for invalid persisted categories and orphaned sources.
- `test/shopping-list-ui.test.ts` & `test/shopping-list-db.test.ts`: Added regression test cases verifying resilience against corrupted data and unmapped categories.
