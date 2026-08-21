# Design: Swipeable Meal Decision Deck (`add-swipe-meal-decision`)

## Context

See `proposal.md` for background and user motivation.
Mise currently generates scored meal suggestions in `src/logic/suggest.ts` and renders them in `app/dinner.tsx` as a vertical list. The user desires a Tinder-style swipeable card deck that makes deciding what to cook for lunch or dinner tactile, intuitive, and decisive, while guaranteeing that all proposed meals transparently communicate their calorie and macro fit.

## Goals / Non-Goals

**Goals:**
- Provide a smooth, 60fps gesture-driven swipeable card deck with width-relative thresholds, rotation, single-latch haptics, and undo support.
- Calorie and macro budget evaluation: calculate remaining daily calories (`targetCalories - consumedCalories`) and visually badge how each meal fits that allowance.
- Support dual-portion control: `servingsMade` (for pantry stock depletion) and `servingsEaten` (for daily calorie logging).
- Typography-led food cards with cuisine icons, prep speed, calorie/macro chips, and on-hand ingredient counts.
- Re-verify ingredient stock availability across remaining cards after a meal is cooked.
- Maintain full accessibility with explicit action buttons (Pass, Info, Cook, Undo).

**Non-Goals:**
- No online food image scraping or video feeds.
- No database schema migrations (reuses existing `suggestions`, `pantry`, and `meals` tables).

## Decisions

### 1. Reanimated 4 & Gesture Handler Card Physics
- **Choice**: Use `Gesture.Pan()` in a fixed non-scrolling container to eliminate gesture competition with vertical parent scrolling.
- **Interaction Specs**:
  - Horizontal translation drives rotation: `interpolate(translateX, [-width, 0, width], [-15, 0, 15]) deg`.
  - Left overlay: "PASS" badge fades in dynamically when dragging left.
  - Right overlay: "COOK" badge fades in dynamically when dragging right.
  - Decision threshold: Drag $\ge 35\%$ of card width or velocity $\ge 800$ px/s commits card exit.
  - Background cards scale up smoothly from `0.95` to `1.0` as the top card is dismissed.
  - **Haptic Latching**: `expo-haptics` triggers a single light/medium impact pulse when crossing the threshold.
  - **Reduced Motion**: If `useReducedMotion()` is active, gestures fall back to tap buttons with immediate crossfade.

### 2. Calorie Budget Classification and Provenance
- **Choice**: Evaluate budget fit at view time: `remainingCalories = targetCalories - consumedCalories`.
- **Classification Categories**:
  - `Exact Fit`: Within $\pm 75$ kcal of remaining target.
  - `Fits Budget`: Meal calories $\le$ remaining calories.
  - `Over Budget`: Meal calories $>$ remaining calories (displays `+X kcal over remaining`).
  - `Estimated`: Flagged when ingredients lack confirmed catalogue nutrition data.

### 3. Dual-Serving Portion Control
- **Choice**: Separate batch yield (`servingsMade`) from personal consumption (`servingsEaten`).
- **Data Flow**:
  - `servingsMade` scales the recipe ingredient quantities depleted from `pantry_items`.
  - `servingsEaten` scales the logged meal macros saved to `meals` and `meal_items`.

### 4. Component Architecture & File Layout
- `src/components/suggestions/MealSwipeDeck.tsx`: Top-level gesture deck managing card stack indices, undo stack, gesture handlers, and empty deck state.
- `src/components/suggestions/MealSwipeCard.tsx`: Individual typography-led card displaying cuisine icon, dish title, prep speed, calorie/macro chips, and pantry ingredient availability.
- `src/components/suggestions/MealDetailSheet.tsx`: Expandable bottom sheet with cooking outline, held pantry ingredients, missing shopping items, and cooking action.
- `src/logic/mealDeck.ts`: Pure state reducer managing deck advancement, undo operations, and card stack filtering.
- `app/dinner.tsx`: Refactored to mount the deck with mode toggles (Lunch / Dinner / Tonight / Macro Gap).

## Risks / Trade-offs

- **[Risk]** Accidental swipes dismiss a meal idea.
  - **Mitigation**: Undo button restores the top dismissed card from memory.
- **[Risk]** Cooking a meal leaves remaining deck cards with stale pantry status.
  - **Mitigation**: Remaining deck cards re-evaluate their held-vs-missing pantry count against the active pantry store after every saved meal.

## Migration Plan

No database migrations required. Forward-compatible UI upgrade.
