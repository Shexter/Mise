# Proposal: Swipeable Meal Decision Deck (`add-swipe-meal-decision`)

## Why

Deciding what to cook for lunch or dinner is one of the highest-friction moments in everyday home cooking. A static vertical list often triggers choice paralysis. 

A tactile, focused card deck interface (swipe right to cook, swipe left to pass, swipe up/tap for cooking outline and details) makes meal selection fast, playful, and decisive. Every suggested card is dynamically evaluated against the user's remaining daily calorie target (`targetCalories - consumedCalories`) and on-hand pantry items, ensuring transparency while respecting user autonomy.

## What Changes

- **Typography-Led Swipeable Meal Deck**:
  - Implements a gesture-driven card deck using `react-native-reanimated` and `react-native-gesture-handler` inside a non-scroll-competing viewport.
  - Cards feature a clean typography-led editorial design with cuisine icons, prep speed, calorie/macro chips, and on-hand ingredient counts (no fake generic internet image scraping).
  - **Swipe Right / Tap Cook**: Opens the one-tap cooking confirmation with separate `servingsMade` (for pantry stock depletion) and `servingsEaten` (for calorie logging).
  - **Swipe Left / Tap Pass**: Dismisses the top card with a smooth exit transition and moves it to the back/undo stack.
  - **Swipe Up / Tap Details**: Opens the cooking outline sheet showing held vs missing pantry ingredients, macro split, and preparation steps.
  - **Undo Button**: Restores the previously dismissed card in one tap.
- **Calorie & Macro Budget Targeting & Badging**:
  - Suggestions are badged with clear budget fit indicators (e.g., `Fits remaining: 450 kcal` vs `620 kcal · +170 kcal over budget`).
  - Never claims a false "guaranteed fit" if some ingredients lack catalogue nutrition data (labelled as `Estimated`).
  - Suggestions are prioritized by remaining calorie fit and expiring pantry ingredients without hard-excluding valid meals.
- **Deck Lifecycle & Cancellation Recovery**:
  - If cooking confirmation is cancelled, the card remains active at the front of the deck.
  - When a meal is cooked, remaining cards in the deck re-verify their ingredient availability against updated pantry stock.
- **Accessible Tap Controls**:
  - Explicit floating action buttons (Pass ✕, Details ℹ, Cook ✓, Undo ↶) for tap navigation and screen readers.
- **Privacy & Offline Invariants**:
  - Zero swipe analytics or telemetry leaves the device.
  - Uses local cached suggestion sets when offline.

## Capabilities

### New Capabilities
- `swipe-meal-decision`: Gesture-driven swipeable card deck interface for meal suggestions, interactive acceptance/dismissal animations, cooking outline drawer, undo stack, and remaining-calorie budget compliance.

### Modified Capabilities
- `dinner-decision`: Extends suggestion scoring and service boundaries with remaining-calorie ranking, portion scaling (`servingsMade` vs `servingsEaten`), and meal context switching.

## Non-goals

- No endless social media video feed or unauthenticated online image scraping.
- No algorithmic black-box recommendation models that bypass on-device deterministic scoring.
- No database schema migrations (reuses existing `suggestions`, `pantry`, and `meals` tables).

## Impact

- **UI**: Enhances `app/dinner.tsx` with `src/components/suggestions/MealSwipeDeck.tsx` and `src/components/suggestions/MealSwipeCard.tsx`.
- **Logic**: Extends `src/logic/suggest.ts` and `src/logic/suggestionService.ts` with budget fit classification and serving separation.
- **Dependencies**: Uses existing `react-native-reanimated`, `react-native-gesture-handler`, and `expo-haptics`.
