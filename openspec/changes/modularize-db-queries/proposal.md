## Why

`src/db/queries.ts` is currently a monolithic file containing over 4,500 lines of code. It bundles together distinct domain models including profile targets, meal logging, pantry stock, identity canonicals, recipe intake, receipt OCR & frame management, dinner suggestions, fasting tracking, analytics, and shopping list persistence.

This monolith creates developer friction, slows down IDE indexing and code inspection, and increases merge conflicts across concurrent features. Modularizing this file into domain-focused submodules under `src/db/queries/` while maintaining a transparent barrel export in `src/db/queries.ts` (or `src/db/queries/index.ts`) preserves 100% backwards compatibility with zero behavioral or schema changes.

## What Changes

- Create domain modules under `src/db/queries/`:
  - `profile.ts`: Profile, body measurements, targets, and fasting tracking.
  - `meals.ts`: Meal CRUD, meal items, depletions, consumption events, and date queries.
  - `pantry.ts`: Pantry stock, storage locations, expiry computation, and stock status.
  - `identity.ts`: Canonical items, aliases, products, and seed loader (`loadSeedData`).
  - `recipes.ts`: Saved recipes, ingredients, and recipe intake queries.
  - `shopping.ts`: Shopping list items, sources, categories, and receipt match reconciliation.
  - `receipts.ts`: Captured receipts, receipt lines, receipt frames, OCR preferences, and pending captures.
  - `suggestions.ts`: Dinner decision suggestions, cache, and preferences.
  - `shops.ts`: Shop locations and needed ingredient lookups.
  - `analytics.ts`: Nutrition aggregation, trends, and export bundles.
- Keep `src/db/queries.ts` as a clean re-export barrel file so all existing imports throughout the app, components, stores, and tests remain unbroken.

## Capabilities

<!-- Pure refactor: no requirement changes; skip_specs: true -->

## Non-goals

- No SQL query rewrites, schema migrations, or index modifications.
- No changes to exported function signatures, parameter types, or return shapes.
- No movement of SQL outside of `src/db/` (preserving the rule: "All SQL lives in `src/db/queries`").

## Impact

- `src/db/queries.ts`: Replaces the 4,500+ line monolith with clean barrel exports.
- `src/db/queries/*.ts`: Creates modular, domain-specific query files (~200–500 lines each).
- All 135+ test files and app routes will continue to compile and pass unchanged.
