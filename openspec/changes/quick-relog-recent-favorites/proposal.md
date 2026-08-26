## Why

Users who regularly eat repeat meals (e.g. daily morning coffee, standard post-workout shake, yesterday's leftover lunch) currently have to photograph or manually reconstruct their meal items from scratch every time. 

In tracking apps like Cronometer and MyFitnessPal, the "Add Previous Meal / Frequent Favorites" feature is one of the highest-retention workflows. Bringing this capability into Mise in an un-cluttered, local-first way—using a lightweight bottom sheet or inline quick-pick chip row on Today/Manual—drastically cuts daily logging time down to under 2 seconds.

## What Changes

- Add a **"Repeat Recent Meal"** / **"Favorites"** bottom sheet accessible from the Today FAB secondary action and `app/manual.tsx`.
- Allow users to favorite/pin frequent meals (or select from their last 7 days of logged distinct meals).
- When a recent/favorite meal is tapped, it immediately pre-populates the review flow (`app/review.tsx`) or direct one-tap logs with appropriate venue options (*Home* / *Leftovers* per Decision 51).
- Add a "Favorite" star/heart toggle on the Meal detail screen (`app/meal/[id].tsx`).

## Capabilities

### New Capabilities
- `quick-relog`: Enables 1-tap re-logging of recent historical meals and pinned favorite dishes.

### Modified Capabilities
<!-- None -->

## Non-goals

- No cloud sync or public recipe databases.
- No changes to existing calorie summing or macro calculation logic.

## Impact

- `app/(tabs)/index.tsx`: Adds quick re-log option to the action sheet / FAB.
- `app/meal/[id].tsx`: Adds favorite toggle for meals.
- `src/db/queries/meals.ts` (or `src/db/queries.ts`): Adds `getFrequentMeals()` and `toggleMealFavorite()`.
- Tests: Adds tests verifying repeat meal cloning, favorite persistence, and leftover venue handling.
