## 1. Budget Classification and Pure Logic

- [x] 1.1 Implement pure budget evaluation functions in `src/logic/suggest.ts` (`remainingCalories = targetCalories - consumedCalories`, classification as exact fit, within budget, or excess kcal).
- [x] 1.2 Add nutrition provenance and estimation flags when suggestions contain ingredients missing catalogue nutrition.
- [x] 1.3 Add pure unit tests in `src/logic/suggest.test.ts` verifying budget classification, sorting, and provenance flags.

## 2. Pure Deck Reducer and State Engine

- [x] 2.1 Create `src/logic/mealDeck.ts` with pure reducer functions for deck advancement, pass stack, undo restoration, and active card resolution.
- [x] 2.2 Add unit tests in `src/logic/mealDeck.test.ts` covering pass, accept, undo, cancellation recovery, and deck exhaustion.

## 3. Swipe Deck UI and Gesture Physics

- [x] 3.1 Create `src/components/suggestions/MealSwipeCard.tsx` with typography-led styling, cuisine icon, dish title, prep speed, calorie/macro chips, and pantry ingredient count.
- [x] 3.2 Implement `src/components/suggestions/MealSwipeDeck.tsx` using `Gesture.Pan()` and `react-native-reanimated` with width-relative threshold ($\ge 35\%$), rotation physics, and single-latch haptics (`expo-haptics`).
- [x] 3.3 Add dynamic "COOK" (green) and "PASS" (rose) stamp overlays fading in with horizontal translation.
- [x] 3.4 Implement accessible tap controls (Pass ✕, Details ℹ, Cook ✓, Undo ↶) and reduced-motion fallback.
- [x] 3.5 Implement `src/components/suggestions/MealDetailSheet.tsx` displaying the cooking outline, held pantry ingredients, missing items, and cooking trigger.

## 4. Dual-Serving Cooking Integration and Stock Sync

- [x] 4.1 Update cooking confirmation in `app/dinner.tsx` to support separate `servingsMade` (for pantry stock depletion) and `servingsEaten` (for calorie logging).
- [x] 4.2 Ensure cancelling the cooking sheet retains the active card at the front of the deck without discarding it.
- [x] 4.3 Re-evaluate held vs missing pantry status across remaining deck cards after a meal is successfully cooked and saved.

## 5. Automated Verification

- [x] 5.1 Run `npm run typecheck` and `npm test` verifying that all new tests pass without regressions.
- [x] 5.2 Validate with `npx openspec validate add-swipe-meal-decision --strict`.
