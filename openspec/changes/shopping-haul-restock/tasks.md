## 1. Restock Pure Logic & Helpers

- [ ] 1.1 Implement `src/logic/stockRestock.ts` helper that maps a purchased `ShoppingListItem` to either an updated existing pantry item or a new pantry item payload
- [ ] 1.2 Add unit tests for `src/logic/stockRestock.ts` covering existing item updates, new item creations, and expiry derivation

## 2. Shopping List UI Integration

- [ ] 2.1 Update `src/components/pantry/ShoppingListSection.tsx` purchase toast to offer a "Restock in Pantry" action
- [ ] 2.2 Execute atomic restock operation and trigger `pantryRevision` store update on restock tap
- [ ] 2.3 Ensure full undo behavior is supported if the purchase status is reverted

## 3. Verification & Testing

- [ ] 3.1 Add UI and interaction test cases in `test/shopping-list-ui.test.ts`
- [ ] 3.2 Verify test suite passes with `npm test` and `npm run typecheck`
