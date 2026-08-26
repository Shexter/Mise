## Context

In `src/components/pantry/ShoppingListSection.tsx`, checking off an item sets its status to `purchased` and displays a toast with an `Undo` button. However, closing the loop with the kitchen stock currently requires either importing an OCR receipt or navigating to `Pantry > Stock` and manually inserting the item.

This design gives users a fast restock action right from the purchase toast.

## Goals / Non-Goals

**Goals:**
- Provide a non-blocking 1-tap "Restock in Pantry" action on the purchase confirmation toast.
- Idempotently find and update matching pantry stock rows (`running_low` or `out` $\rightarrow$ `in_stock`), recalculating expiry based on standard shelf-life rules.
- If no existing pantry item exists, create a new row for canonical items with sensible default storage locations (`fridge`, `pantry`, `freezer`).

**Non-Goals:**
- Unconditionally creating phantom pantry stock without user intent.
- Editing receipt OCR data.

## Decisions

### Decision 1: Restock action on toast
* **Approach**: When `status === 'purchased'`, the toast provides an action button `"Restock"` (or a brief confirmation sheet if multiple items are checked).
* **Rationale**: Keeps the primary checkbox tap fast while making pantry restocking a 1-tap addition.

### Decision 2: Pure helper in `src/logic/stockRestock.ts`
* **Approach**: Encapsulate the matching and restock computation in a tested pure/service function `restockFromShoppingItem(item, pantryItems)`.
* **Rationale**: Isolates pantry item creation/update logic from React UI components.

## Risks / Trade-offs

- [Risk] What storage location to assign for brand new pantry items?
  → **Mitigation**: Use canonical item's `defaultLocation` or fall back to `'pantry'` (or `'fridge'` for perishables).

## Modules Touched

- `src/components/pantry/ShoppingListSection.tsx`
- `src/logic/stockRestock.ts`
- `test/shopping-list-ui.test.ts`
