## Why

When users buy groceries and check them off in `Pantry > Shop`, the items move to purchased history without restocking the corresponding pantry items. Unless the user imports a printed store receipt with OCR, they must navigate to the Pantry tab and manually add each purchased item all over again.

This change introduces a quick, non-intrusive restock prompt upon marking shopping list items as purchased, closing the shopping-to-pantry loop with one tap.

## What Changes

- When an item is marked as `purchased` in `ShoppingListSection.tsx`, provide an actionable toast / prompt: *"Marked purchased. Restock in Pantry?"* with a 1-tap action to increment/restore the pantry item to `in_stock`.
- If the shopping item maps to an existing pantry item (via `canonicalId`), update its status to `in_stock` and refresh predicted expiry.
- If the item is not yet in the pantry and has a resolved canonical identity, create a new `in_stock` pantry row with sensible defaults based on its storage location and food class.
- Preserve full Undo capability.

## Capabilities

### New Capabilities
- `shopping-restock`: Bridges purchased grocery list items directly into in-stock pantry items with 1-tap confirmation.

### Modified Capabilities
<!-- None: shopping list and pantry schemas and baseline operations remain backward-compatible -->

## Non-goals

- Forcing automatic, silent pantry creation for non-canonical items without user consent.
- Changing OCR receipt reconciliation or pricing tracking.

## Impact

- `src/components/pantry/ShoppingListSection.tsx`: Adds restock action to the purchased confirmation toast.
- `src/logic/shoppingList.ts` / `src/logic/stock.ts`: Adds helper for converting purchased shopping items into pantry records.
- Tests: Adds tests verifying grocery check-off restock behavior in `test/shopping-list-ui.test.ts`.
