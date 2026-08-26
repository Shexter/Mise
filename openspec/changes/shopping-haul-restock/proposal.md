## Why

When users buy groceries and check them off in `Pantry > Shop`, the items move to purchased history without restocking the corresponding pantry items. Unless the user imports a printed store receipt with OCR, they must navigate to the Pantry tab and manually add each purchased item all over again.

This change introduces a quick, non-intrusive restock prompt upon marking shopping list items as purchased, closing the shopping-to-pantry loop with one tap.

## What Changes

- When an item is marked as `purchased` in `ShoppingListSection.tsx`, provide an actionable toast / prompt: *"Marked purchased. Restock in Pantry?"* with a 1-tap action.
- For a resolved canonical identity, always create a new `in_stock` pantry row because one pantry row represents one physical container (decisions 56 and 68).
- Reconcile existing rows of the same canonical without merging containers: mark `out` rows as `replaced`, and leave `running_low` and `in_stock` rows untouched.
- Preserve full immediate Undo capability by reversing the purchase, deleting the newly created row, and restoring reconciled `out` rows together.

## Capabilities

### New Capabilities
- `shopping-restock`: Bridges purchased grocery list items into distinct in-stock pantry containers with 1-tap confirmation and reversible reconciliation.

### Modified Capabilities
<!-- None: shopping list and pantry schemas and baseline operations remain backward-compatible -->

## Non-goals

- Forcing automatic, silent pantry creation for non-canonical items without user consent.
- Merging a purchase into an existing physical-container row or inferring that a requested quantity is the quantity actually bought.
- Changing OCR receipt reconciliation or pricing tracking.

## Impact

- `src/components/pantry/ShoppingListSection.tsx`: Adds restock action to the purchased confirmation toast.
- `src/logic/stockRestock.ts`: Adds a pure helper for planning container creation and reconciliation.
- `src/db/queries/pantry.ts`: Applies and reverses the restock plan atomically.
- Tests: Adds tests verifying grocery check-off restock behavior in `test/shopping-list-ui.test.ts`.
