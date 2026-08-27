## 1. Database Schema & Query Support

- [x] 1.1 Add forward migration for `is_favorite` flag on `meals` in `src/db/schema.ts`
- [x] 1.2 Implement `toggleMealFavorite()` and `getRecentAndFavoriteMeals()` queries in `src/db/queries.ts`
- [x] 1.3 Add helper `cloneMealForLogging()` in `src/logic/mealCloning.ts`

## 2. UI Components & Integration

- [x] 2.1 Add favorite star toggle to `app/meal/[id].tsx` header
- [x] 2.2 Create `src/components/meals/RecentMealsSheet.tsx` displaying frequent & starred meals
- [x] 2.3 Wire the sheet into `app/(tabs)/index.tsx` (via FAB long-press / secondary action) and `app/manual.tsx`
- [x] 2.4 Handle selection: pre-populate review state with `venue: 'leftovers'` (0 depletion) or `venue: 'home'`

## 3. Verification & Testing

- [x] 3.1 Unit test `cloneMealForLogging` and leftover depletion invariants in `test/meal-cloning.test.ts`
- [x] 3.2 Database query tests in `test/meals-db.test.ts`
- [x] 3.3 Verify full test suite passes with `npm test` and `npm run typecheck`
