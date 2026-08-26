## Context

`src/db/queries.ts` is currently a 4,500+ line monolith containing all application database queries, type mappers, and row interfaces. This refactor breaks the file into clean domain modules under `src/db/queries/` while maintaining 100% API compatibility via `src/db/queries.ts` barrel exports.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Break `src/db/queries.ts` into single-responsibility domain files under `src/db/queries/`.
- Ensure zero breaking changes across all exported types, functions, and interfaces.
- Preserve the non-negotiable architectural convention: "All SQL lives in `src/db/queries/`" (no SQL in components, logic, or stores).
- Maintain 100% test pass rate across all 135 test suites.

**Non-Goals:**
- Changing query behavior, SQL statements, or database schemas.
- Renaming or deprecating existing exported functions.

## Decisions

### Decision 1: Domain-based folder structure under `src/db/queries/`
* **Structure**:
  - `src/db/queries/types.ts`: Common row types and query input/output interfaces.
  - `src/db/queries/profile.ts`: Profile, body measurements, target calories/macros, fasts, dietary rules.
  - `src/db/queries/meals.ts`: Meals, meal items, consumption events, and depletion tracking.
  - `src/db/queries/pantry.ts`: Pantry items, storage locations, expiry computation, and stock status.
  - `src/db/queries/identity.ts`: Canonical ingredients, item aliases, alias bigrams, products, and `loadSeedData`.
  - `src/db/queries/recipes.ts`: Saved recipes, recipe ingredients, and CRUD operations.
  - `src/db/queries/shopping.ts`: Shopping list items, sources, and receipt reconciliation matches.
  - `src/db/queries/receipts.ts`: Captured receipts, receipt lines, receipt frames, pending captures, and OCR preferences.
  - `src/db/queries/suggestions.ts`: Suggestion cache, preferences, and template defaults.
  - `src/db/queries/shops.ts`: Shop locations, geospatial queries, and needed ingredient lookups.
  - `src/db/queries/analytics.ts`: Nutrition trends, time-series aggregations, and export bundles (`exportEverything`).
  - `src/db/queries/index.ts`: Central re-export of all domain modules.

### Decision 2: Retain `src/db/queries.ts` as a transparent proxy
* **Approach**: `src/db/queries.ts` simply contains `export * from './queries/index';`.
* **Rationale**: Allows existing imports (`import { ... } from '@/db/queries'`) across all files to continue working seamlessly without a massive, risky multi-file import rewrite.

## Risks / Trade-offs

- [Risk] Circular dependencies between domain query modules (e.g. meals referencing pantry items, or export bundles referencing multiple models).
  → **Mitigation**: Place shared DB row interfaces and mappers in `src/db/queries/types.ts` or import directly from `src/types.ts` and `src/db`.

## Modules Touched

- `src/db/queries.ts` (replaced with barrel re-exports)
- `src/db/queries/*.ts` (new domain modules)
