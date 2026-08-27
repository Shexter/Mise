## 1. Shop Tab Navigation & Layout

- [x] 1.1 Add `shop` tab route to `app/(tabs)/_layout.tsx` with `shopping-bag` icon
- [x] 1.2 Create `app/(tabs)/shop.tsx` hosting `ShoppingListSection`, nearby store detection header action (`/shops`), receipt capture button, and receipt history shortcut

## 2. Pantry Tab Streamlining

- [x] 2.1 Simplify `app/(tabs)/pantry.tsx` subsection state to 2 segments: `stock` and `recipes`
- [x] 2.2 Clean up header actions on `pantry.tsx` to match stock vs. recipe mode without flickering
- [x] 2.3 Remove legacy `shop` and `receipts` sub-renders from `pantry.tsx`

## 3. Verification & Testing

- [x] 3.1 Update navigation tests in `test/pantry-subsections.test.ts` and `test/shopping-list-ui.test.ts`
- [x] 3.2 Verify test suite passes with `npm test` and `npm run typecheck`
