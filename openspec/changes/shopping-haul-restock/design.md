## Context

In `src/components/pantry/ShoppingListSection.tsx`, checking off an item sets its status to `purchased` and displays a toast with an `Undo` button. However, closing the loop with the kitchen stock currently requires either importing an OCR receipt or navigating to `Pantry > Stock` and manually inserting the item.

This design gives users a fast restock action right from the purchase toast.

## Goals / Non-Goals

**Goals:**
- Provide a non-blocking 1-tap "Restock in Pantry" action on the purchase confirmation toast.
- Create one new pantry row for the purchased physical container, preserving decisions 56 and 68.
- Reconcile matching `out` rows as `replaced` while leaving other physical containers unchanged.
- Reverse the shopping status, created row, and reconciliation changes together from the success toast.

**Non-Goals:**
- Unconditionally creating phantom pantry stock without user intent.
- Merging a new purchase into an existing pantry row.
- Treating a shopping request quantity as proof of the quantity actually bought.
- Editing receipt OCR data.

## Decisions

### Decision 1: Restock action on toast
* **Approach**: When `status === 'purchased'` and the item has a `canonicalId`, the toast provides an action button `"Restock"`. After the transaction succeeds, a new success toast provides `"Undo"`; unresolved items retain the existing purchase Undo action.
* **Rationale**: Keeps the primary checkbox tap fast while making pantry restocking a 1-tap addition.

### Decision 2: Pure helper in `src/logic/stockRestock.ts`
* **Approach**: Encapsulate the plan in `restockFromShoppingItem(item, pantryItems, canonical, locations, purchasedAt)`. It returns a new-container payload and the ids of matching `out` rows to reconcile, or `null` when identity/location is unresolved.
* **Rationale**: Isolates product rules from React and SQL while making the physical-container behavior directly testable.

### Decision 3: Purchases never merge physical containers
* **Approach**: Every accepted restock inserts a new `in_stock` row. Matching `out` rows become `replaced`; `running_low`, `in_stock`, `discarded`, and already `replaced` rows do not change. Requested shopping quantity is not copied because it describes intent, not an observed purchase.
* **Rationale**: Decisions 56 and 68 define a pantry row as one physical container. Updating an existing row would erase the distinction between the old and newly bought containers.

### Decision 4: Apply and Undo are paired database transactions
* **Approach**: `src/db/queries/pantry.ts` applies the insert and `out`-to-`replaced` updates in one exclusive transaction and returns an undo token containing the created row id and reconciled row ids. Undo uses that token to delete the created row and restore those rows to `out`; the UI restores the shopping status in the same user action.
* **Rationale**: A partially applied restock would make pantry history untrustworthy. The toast-scoped token gives immediate full reversal without adding durable schema solely for an ephemeral action.

## Risks / Trade-offs

- [Risk] What storage location to assign for brand new pantry items?
  → **Mitigation**: Use the location whose id matches the canonical `defaultLocation`; if it does not exist, use the first configured location, matching receipt import behavior. Refuse the restock if no location exists.
- [Risk] The app closes after restock and before Undo.
  → **Mitigation**: The completed purchase and pantry row remain valid; this change guarantees immediate toast Undo rather than adding a durable restock-event ledger.

## Modules Touched

- `src/components/pantry/ShoppingListSection.tsx`
- `src/logic/stockRestock.ts`
- `src/db/queries/pantry.ts`
- `src/db/queries/index.ts`
- `src/store/pantryStore.ts`
- `test/stock-restock.test.ts`
- `test/shopping-list-ui.test.ts`
