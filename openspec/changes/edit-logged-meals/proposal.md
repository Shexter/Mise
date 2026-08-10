## Why

Meals shown under Today’s meals are already pressable, but tapping one has no visible effect. A mistaken quantity, calorie value, meal type, venue, or ingredient therefore requires deletion and complete re-entry, while an incorrect home/out/leftovers value can also leave pantry depletion wrong.

## What Changes

- Make each Today’s meals row open a detail editor for that logged meal.
- Let the user edit the meal name, meal type, venue, servings multiplier, and each item’s name, quantity, unit, calories, macros, and catalogue identity.
- Let the user add and remove meal items before saving.
- Save the meal and its items atomically, preserving its identity, timestamp, local date, source, and existing photo unless the user explicitly changes a supported field.
- Reconcile pantry depletion atomically from the old committed meal to the edited meal, including venue changes governed by decisions 9, 11, and 51 and known canonical identities governed by decision 79.
- Refresh Today’s meals, calorie totals, macro bars, pantry state, and dependent suggestion state after a successful save so the confirmation agrees with visible state, per decision 76.
- Keep swipe-to-delete and its existing undo behavior available.

## Capabilities

### New Capabilities

- `logged-meal-editing`: Opening, editing, validating, saving, and cancelling changes to an existing logged meal, including correct recalculation and pantry-depletion reconciliation.

### Modified Capabilities

None.

## Impact

- Today meal-row navigation and accessibility behavior.
- A new expo-router meal editor screen that reuses existing fields, segmented controls, catalogue selection, item editing, keyboard avoidance, and scrolling patterns.
- Transactional meal and meal-item update queries in `src/db/queries.ts`.
- Day-store update and refresh behavior plus the existing depletion reversal/reapply path.
- Tests for persistence, rollback, totals, venue semantics, pantry reconciliation, navigation, and validation.

## Non-goals

- Editing the original meal photograph or rerunning image analysis.
- Moving a meal to another date or changing its original logged time in this change.
- Adding notes, recipes, sharing, cloud history, or a separate meal-history surface.
- Changing catalogue nutrition coverage, including the missing automatic nutrition for Dark soy sauce; that is a separate catalogue-data issue.
- Replacing swipe-to-delete or changing its undo window.
