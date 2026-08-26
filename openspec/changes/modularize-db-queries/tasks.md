## 1. Domain Module Extraction

- [x] 1.1 Create `src/db/queries/types.ts` with shared database row types, mappers, and utility helpers
- [x] 1.2 Extract `src/db/queries/profile.ts` (profile, body measurements, targets, fasts, dietary rules)
- [x] 1.3 Extract `src/db/queries/identity.ts` (canonicals, aliases, products, bigrams, `loadSeedData`)
- [x] 1.4 Extract `src/db/queries/pantry.ts` (pantry items, locations, stock status, expiry calculations)
- [x] 1.5 Extract `src/db/queries/meals.ts` (meals, meal items, consumption events, and depletion queries)
- [x] 1.6 Extract `src/db/queries/recipes.ts` (recipes, recipe ingredients, and CRUD operations)
- [x] 1.7 Extract `src/db/queries/shopping.ts` (shopping list items, sources, and receipt reconciliation)
- [x] 1.8 Extract `src/db/queries/receipts.ts` (receipts, receipt lines, frames, pending captures, OCR preferences)
- [x] 1.9 Extract `src/db/queries/suggestions.ts` (suggestion cache, preferences, and template defaults)
- [x] 1.10 Extract `src/db/queries/shops.ts` (shop locations and needed ingredients)
- [x] 1.11 Extract `src/db/queries/analytics.ts` (nutrition range aggregations and `exportEverything`)

## 2. Re-Export Barrel & Backwards Compatibility

- [x] 2.1 Assemble `src/db/queries/index.ts` re-exporting all submodules
- [x] 2.2 Wire `src/db/queries.ts` as a transparent proxy to `src/db/queries/index.ts`
- [x] 2.3 Verify zero broken imports across components, stores, APIs, and screens

## 3. Verification & Testing

- [x] 3.1 Run TypeScript type check `npm run typecheck` to guarantee exact signature parity
- [ ] 3.2 Run full test suite `npm test` across all 135 test suites
- [x] 3.3 Verify git diff check `git diff --check`
