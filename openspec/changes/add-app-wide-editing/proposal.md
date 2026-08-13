## Why

Mise currently makes editing available only where a prior feature explicitly planned it. That forces users to live with a typo, wrong quantity, storage choice, ingredient match, or meal detail unless they know an unrelated correction path. Any user-entered fact can be wrong, so correction must be a product-wide rule rather than a series of one-off requests. This is especially urgent for Pantry, where a mistaken addition poisons expiry, depletion, dinner suggestions, and the shopping list.

## What Changes

- Add a consistent edit affordance and edit form for every user-created, persisted record that has user-editable fields.
- Start with Pantry entries: edit name/identity, quantity or qualitative status, storage location, expiry metadata, notes, and other fields exposed during add.
- Extend the same pattern to logged meals, meal items, saved recipes and recipe ingredients, shopping-list items, barcode/receipt capture results, and profile/preferences where the user supplied the value.
- Preserve provenance, confidence, canonical identity, and derived values unless the user explicitly changes the source field that owns them.
- Recompute dependent derived state after edits (nutrition totals, depletion, expiry, dinner suggestions, shopping-list matching, and analytics) through existing domain logic.
- Provide cancel, save, validation, and error states; never silently discard a user edit.
- Add a shared interaction contract so future add flows cannot ship without an edit path.

## Capabilities

### New Capabilities

- `app-wide-editing`: User-visible correction and editing for user-created records across Mise.

### Modified Capabilities

- `pantry-stock`: Pantry entries created by the user can be edited without deleting and recreating them.
- `edit-logged-meals`: The existing meal editing contract becomes the shared model for all editable user-created records and dependent recalculation.

## Impact

- Screens and forms under `app/`, especially Pantry, meal review/detail, recipes, receipts, barcode capture, and shopping list.
- Shared form and edit-action components under `src/components/` and domain validation/state under `src/logic/`.
- SQL query/update functions in `src/db/queries.ts`; any new persistence requires a forward-only migration appended to `src/db/schema.ts`.
- Type contracts in `src/types.ts`, export/reset coverage, and automated UI, logic, migration, and recalculation tests.
- No server, account, or sync behavior is introduced. Existing local-first storage remains intact.

## Non-goals

- Editing derived analytics, inferred confidence, or immutable audit timestamps directly.
- Bulk editing, collaborative conflict resolution, or undo history beyond existing reversible domain actions.
- Replacing existing capture/review flows or changing canonical identity rules; edits must use them.
