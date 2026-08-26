## Why

Users currently have to choose between clicking a blind "I cooked this" button on `app/recipe/[id].tsx` (which logs an uneditable meal without calories or serving adjustments) or manually re-entering dish ingredients into the meal tracker.

Connecting the recipe detail screen directly to the streamlined meal review workflow enables users to adjust meal type, date, servings multiplier ($1\times, 2\times, 4\times$), and review ingredient depletions and nutritional estimates before saving to their daily log.

## What Changes

- Update the primary action on `app/recipe/[id].tsx` from an uncustomizable "I cooked this" write to a rich **"Cook & Log Meal"** flow that routes to `app/review.tsx` with pre-filled recipe ingredients, dish name, and calculated ingredient totals.
- Allow adjusting servings made ($1\times, 2\times, 4\times$) and meal venue on the review screen before committing the meal and pantry depletions.
- Preserve direct one-tap quick-cooking while offering the full transparent review screen.

## Capabilities

### New Capabilities
- `recipe-meal-logging`: Enables routing from saved recipe view directly into the meal review flow with pre-populated dish and ingredient metadata.

### Modified Capabilities
<!-- None: recipe storage and meal logging requirements are preserved and linked -->

## Non-goals

- Altering how recipes are parsed, extracted, or stored in SQLite.
- Changing pantry depletion formulas or nutrition estimation models.

## Impact

- `app/recipe/[id].tsx`: Replaces direct background meal creation with a seamless navigation handoff to `app/review.tsx`.
- `app/review.tsx`: Accepts recipe context params (`recipeId`, `recipeTitle`, `recipeIngredients`) to hydrate review state.
- `src/logic/recipe.ts`: Extends `mealFromRecipe` to support direct meal drafting for review.
- Tests: Adds coverage for recipe-to-review handoff and meal creation from saved recipes.
