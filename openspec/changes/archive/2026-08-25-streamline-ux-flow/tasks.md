## 1. Fast Meal Review & Intake Consolidation

- [x] 1.1 Add inline horizontal segmented chips for Meal Type, Venue (Home/Out), and Servings Multiplier on `app/review.tsx`
- [x] 1.2 Enforce venue state invariants: lock Servings Multiplier to 1x and disable pantry depletion when Venue is Eating Out / Restaurant
- [x] 1.3 Align `app/manual.tsx` with unified inline modifier controls and fast saving
- [x] 1.4 Ensure hidden cooking ingredients disclosure is collapsed by default and non-blocking

## 2. Cold-Start Guidance & Demo Discovery

- [x] 2.1 Add a keyless discovery and demo data card to `app/(tabs)/index.tsx` for fast first-time onboarding
- [x] 2.2 Implement data-safety confirmation check before seeding demo data if existing user records exist
- [x] 2.3 Ensure estimation flows gracefully offer direct manual numeric input when no API key is set

## 3. Pantry Navigation Polish & Consistency

- [x] 3.1 Polish `app/(tabs)/pantry.tsx` header actions and clear segment labels
- [x] 3.2 Ensure `ShoppingListSection` and `SavedRecipesSection` sub-navigation remain clean and consistent

## 4. Verification & Testing

- [x] 4.1 Add test cases for venue/servings modifier state transitions and depletion semantics
- [x] 4.2 Verify small screen layout and large text accessibility
- [x] 4.3 Verify full test suite passes with `npm test` and `npm run typecheck`
