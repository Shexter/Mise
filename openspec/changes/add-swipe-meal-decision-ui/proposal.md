## Why

The `add-swipe-meal-decision` change defines the gesture logic, state reducer, and calorie-budget data flow for the Tinder-style swipe deck. What it does **not** specify is how the deck actually looks and feels — card anatomy, typography hierarchy, gesture overlay aesthetics, motion curves, empty-state presentation, and accessibility baseline. Without this companion spec, the visual implementation will be left to developer intuition, which historically produces AI-template defaults: white cards, blue accents, system-font body text, and lazy shadows. This change fixes that gap by establishing explicit, non-negotiable UI standards for every pixel the swipe feature touches.

## What Changes

- New **`MealSwipeCard`** component visual spec: exact layer anatomy (background, calorie banner, typography stack, macro chips, badges), Hallmark-grade colour/type tokens, and shadow vocabulary.
- **Gesture overlay design**: COOK and PASS stamp visuals — rotation-tied opacity curves, stamp font, colour, and letter-spacing; background card parallax scaling specification.
- **Calorie fit badge** visual language: four states (`Exact Fit`, `Fits Budget`, `Over Budget`, `Estimated`) with colour, icon, and weight.
- **Empty deck state**: illustration language, headline, and CTA hierarchy when all cards have been swiped.
- **MealDetailSheet** visual anatomy: ingredient rows (held green / missing muted), step numbering treatment, macro summary panel at sheet top.
- **Motion token dictionary**: enter, exit-right, exit-left, undo, scale-up easing curves, duration, and reduced-motion overrides.
- **Accessibility floor**: minimum touch targets, colour-contrast ratios per WCAG 2.1 AA, focus ring style, alternative button bar layout for `reduceMotion`.

## Non-goals

- No changes to gesture threshold logic, state reducer, or calorie computation — those live in `add-swipe-meal-decision`.
- No API calls, database queries, or business logic of any kind.
- No new npm packages — design tokens only; leverages `react-native-reanimated` and `expo-haptics` already planned.

## Capabilities

### New Capabilities

- `suggestions/swipe-card-ui`: Visual design specification for `MealSwipeCard` — card anatomy layers, type hierarchy, macro chips, calorie fit badge, pantry badge, prep speed indicator, cuisine pill, and card shadow vocabulary.
- `suggestions/swipe-gesture-overlays`: Stamp overlay design — COOK (green) and PASS (rose-muted) label visual treatment, rotation-tied opacity curve, and background card parallax scaling.
- `suggestions/swipe-deck-states`: Empty deck visual state design, undo toast design, and deck pagination indicator.
- `suggestions/meal-detail-sheet-ui`: Bottom sheet anatomy — ingredient list visual language (held vs missing), macro summary panel, step-by-step recipe step typography, and action footer bar.
- `suggestions/swipe-motion-tokens`: Motion dictionary — enter, exit-left, exit-right, undo, scale-up curves, durations, and `reduceMotion` variant overrides.
- `suggestions/swipe-accessibility`: Accessibility floor — touch target sizing, contrast ratios, focus ring style, screen-reader labels, and the alternative button-bar layout for `reduceMotion` mode.

### Modified Capabilities

_(none — pure UI specification layer over the planned `add-swipe-meal-decision` logic)_

## Impact

- `src/constants/theme.ts`: New motion tokens and any missing colour/shadow tokens.
- `src/components/suggestions/MealSwipeCard.tsx`: Primary visual implementation target.
- `src/components/suggestions/MealSwipeDeck.tsx`: Deck container and overlay layers.
- `src/components/suggestions/MealDetailSheet.tsx`: Sheet anatomy implementation.
- All component files are **new** — no existing screens are modified.
