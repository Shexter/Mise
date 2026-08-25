## Context

The shopping list feature relies on reading stored items from SQLite, building a refresh plan from pantry items and recipes, and grouping open items by category for rendering in `ShoppingListSection`. If invalid records exist in the database (e.g. legacy/unsupported category values, missing recipe references, or unhandled nulls in category lookups), or if an unexpected exception occurs during async reconciliation, the component or application can fail to render.

See `proposal.md` for motivation and `specs/shopping-list/spec.md` for requirements.

## Goals / Non-Goals

**Goals:**
- Guarantee that `ShoppingListSection` and related pure functions never crash due to unexpected category keys, null entries, or unhandled errors during loading.
- Add safety fallbacks throughout `src/logic/shoppingList.ts`, `src/db/queries.ts`, and `src/components/pantry/ShoppingListSection.tsx`.
- Wrap the asynchronous refresh/load cycle in try/catch handling with graceful UI fallback.

**Non-Goals:**
- Adding remote sync or server state.
- Modifying SQLite schemas or adding new migrations (existing tables and fields are sufficient).

## Decisions

### Decision 1: Multi-layer defensive category normalization
* **Approach**: Normalize categories at the SQL mapper level (`toShoppingListItem` in `src/db/queries.ts`), at the pure logic level (`groupShoppingItems` in `src/logic/shoppingList.ts`), and at the UI component level (`ShoppingListSection.tsx` & `ShoppingSection`).
* **Rationale**: Defense in depth ensures that whether data comes from direct SQL queries, in-memory state mutations, or test stubs, an unmapped category always falls back to `'other'` (`SHOPPING_CATEGORY_LABELS['other'] = 'Other'`).
* **Alternatives Considered**: Crashing or throwing a validation error on unknown categories (rejected: destroys user data access and usability).

### Decision 2: Error boundary and async try/catch in ShoppingListSection
* **Approach**: Wrap the `load()` async flow in `src/components/pantry/ShoppingListSection.tsx` with a try/catch block that sets `loading = false` and logs/notifies without unhandled rejection.
* **Rationale**: If any single database read or reconciliation step encounters an issue, the screen continues to render safely with whatever open items are available or an empty state.

## Risks / Trade-offs

- [Risk] Corrupted category data might get categorized under 'Other'.
  → **Mitigation**: 'Other' is the designated standard fallback category in the food taxonomy, allowing users to view and re-edit the category at will.

## Modules Touched

- `src/components/pantry/ShoppingListSection.tsx`
- `src/logic/shoppingList.ts`
- `src/db/queries.ts`
- `test/shopping-list-ui.test.ts`
