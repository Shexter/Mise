## 1. Restock Pure Logic & Helpers

- [x] 1.1 Implement `src/logic/stockRestock.ts` helper that plans one new physical-container row and reconciliation of matching `out` rows without changing `running_low` or `in_stock` rows
- [x] 1.2 Add unit tests covering new-row creation, canonical default-location fallback, unresolved inputs, and state-dependent reconciliation

## 2. Shopping List UI Integration

- [x] 2.1 Update `src/components/pantry/ShoppingListSection.tsx` purchase toast to offer a "Restock in Pantry" action
- [x] 2.2 Add atomic apply/undo pantry queries and trigger the pantry store revision after each successful mutation
- [x] 2.3 Replace the post-restock toast action with Undo that reverses the purchase, created pantry row, and reconciled `out` rows together

## 3. Verification & Testing

- [x] 3.1 Add UI and interaction test cases in `test/shopping-list-ui.test.ts`
- [ ] 3.2 Verify test suite passes with `npm test` and `npm run typecheck`
