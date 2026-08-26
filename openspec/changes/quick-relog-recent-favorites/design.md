## Context

Users want a fast "repeat previous meal / log favorite dish" interaction like Cronometer's frequent food list. In Mise's design language, this should fit seamlessly alongside the Today FAB and manual entry without adding clutter.

## Goals / Non-Goals

**Goals:**
- Provide a clean "Recent & Favorite Meals" bottom sheet (`RecentMealsSheet.tsx`).
- Query recent unique meal templates (e.g. from the past 14 days) and user-starred favorite dishes from SQLite.
- Seamlessly clone the meal items and macros to today's date, opening the review screen with `venue: 'leftovers'` or `venue: 'home'` options.
- Ensure `venue: 'leftovers'` performs zero pantry depletion (Decision 51).

**Non-Goals:**
- Cloud-synced user food dictionaries.
- Complex meal scheduling / calendar planning.

## Decisions

### Decision 1: Database representation for Favorites
* **Approach**: Add forward migration `is_favorite INTEGER DEFAULT 0` to the `meals` table, indexed for fast retrieval of starred templates.
* **Alternative considered**: A separate `favorite_meals` table.
* **Rationale**: Reuses the exact existing `meals` and `meal_items` schema without relational duplication.

### Decision 2: Access entry points
* **Approach**: 
  1. Long-press or secondary menu on the Today FAB.
  2. A dedicated quick chip / action button on `app/manual.tsx` ("Pick from recent or favorites").
  3. Star button on `app/meal/[id].tsx` header.

## Risks / Trade-offs

- [Risk] Cloned meal items carrying outdated canonical IDs or missing items.
  → **Mitigation**: Pure cloning function `cloneMealForLogging(meal, targetDate)` that preserves ingredients and validates canonical references.

## Modules Touched

- `src/db/schema.ts` (forward migration for `is_favorite`)
- `src/db/queries/meals.ts` (or `src/db/queries.ts`)
- `src/components/meals/RecentMealsSheet.tsx`
- `app/(tabs)/index.tsx`
- `app/meal/[id].tsx`
- `app/manual.tsx`
