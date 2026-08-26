## 1. Recipe to Review Handoff

- [x] 1.1 Update `app/recipe/[id].tsx` action button from "I cooked this" to "Cook & Log Meal", preparing the meal draft with recipe title and ingredients
- [x] 1.2 Route to `app/review.tsx` passing recipe draft payload via `useCaptureStore` or navigation parameters
- [x] 1.3 Ensure `app/review.tsx` properly recognizes `source: 'recipe'` and enables full inline modifier adjustments (Meal Type, Servings Multiplier, Date)

## 2. Pantry Depletion & Attribution Integration

- [x] 2.1 Verify pantry stock items are decremented accurately when a recipe meal is logged with 1x, 2x, or 4x multipliers
- [x] 2.2 Retain `source: 'recipe'` metadata on the saved meal row for nutrition history attribution

## 3. Verification & Testing

- [x] 3.1 Update `test/recipe-cooking-parity.test.ts` to assert recipe-to-review meal construction and depletion accuracy
- [ ] 3.2 Run `npm test` and `npm run typecheck`
