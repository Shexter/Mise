## Context

Previously, `app/recipe/[id].tsx` had a basic "I cooked this" button that immediately created a `Meal` row in the database using `mealFromRecipe()`. This bypassed the interactive review flow, preventing users from seeing calorie breakdowns, selecting a specific meal type, changing the logged date, or adjusting the servings multiplier ($1\times, 2\times, 4\times$) on the new unified modifier bar.

This design routes the recipe cook action directly into `app/review.tsx` (or `useCaptureStore` draft meal state) for a transparent, customizable log before saving.

## Goals / Non-Goals

**Goals:**
- Provide a clear "Cook & Log This" primary action on `app/recipe/[id].tsx`.
- Pass recipe dish title, canonicalized ingredients, and quantities to `app/review.tsx`.
- Allow the user to adjust meal type (Breakfast/Lunch/Dinner/Snack), batch servings made ($1\times, 2\times, 4\times$), and date.
- Preserve proper pantry depletion and `source: 'recipe'` provenance when logged.

**Non-Goals:**
- Modifying recipe extraction or storage schemas.

## Decisions

### Decision 1: Hydrate review state via `useCaptureStore` or route payload
* **Approach**: When the user taps "Cook & Log Meal" on a recipe, generate the draft items using `mealFromRecipe()` or direct ingredient mapping, populate the store's draft items, and navigate to `router.push('/review')`.
* **Rationale**: Reuses 100% of the newly streamlined review UI (`MealModifierControls`, `ItemRow`, and one-tap save) without duplicating UI code on the recipe screen.

### Decision 2: Preserve quick 1-tap cooking via secondary confirmation if desired
* **Approach**: Make "Cook & Log Meal" open review by default, with an option to directly quick-save if the user wants zero extra steps.

## Risks / Trade-offs

- [Risk] Recipe ingredients with unstated quantities (e.g. "salt to taste").
  → **Mitigation**: Stated amounts deplete according to standard recipe rules; items without numbers are kept for display but excluded from mass depletions to protect pantry estimate trust (Decision 15).

## Modules Touched

- `app/recipe/[id].tsx`
- `app/review.tsx`
- `src/logic/recipe.ts`
- `test/recipe-cooking-parity.test.ts`
