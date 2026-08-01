## 1. Schema and types

- [x] 1.1 Append migration 3 to `MIGRATIONS` in `src/db/schema.ts` creating
      `locations` (id, name, kind, sort order) and `pantry_items` per
      `docs/identity-layer.md`, with indexes on status, `expires_at`, and
      `canonical_id`.
- [x] 1.2 Seed the four default locations in the same migration so a fresh
      install has them before any screen loads.
- [x] 1.3 Extend `DROP_ALL` with both tables.
- [x] 1.4 Add `PantryItem`, `Location`, `LocationKind`, `Fullness`, and
      `StockStatus` to `src/types.ts` with their `readonly` value arrays,
      following the existing `MEASURE_UNITS` pattern.
- [x] 1.5 Verify the migration runs on a fresh install and on one already at
      `user_version = 2`, and that `npm run typecheck` passes.

## 2. Expiry

Pure logic, no database, no network.

- [x] 2.1 Implement `src/logic/expiry.ts`: predict an expiry date from a
      canonical ingredient's shelf life for a location kind, counted from an
      acquisition date.
- [x] 2.2 Implement the opened case as the *earlier* of the existing prediction
      and opening date plus opened shelf life — not an unconditional
      replacement, so opening a bag of rice with a month left does not extend it.
- [x] 2.3 Implement the freeze recompute: recount from the freezer shelf life.
- [x] 2.4 Honour `expiry_source` — a user-entered or label-read date is never
      overwritten by a recompute.
- [x] 2.5 Unit-test the above, including both directions of the opened case and
      an item with no shelf-life data for its location.

## 3. Status

- [x] 3.1 Define the threshold constants — `LOW_STAPLE_USES`,
      `LOW_STAPLE_FRACTION`, `LOW_SEASONING_FRACTION`, `EXPIRING_SOON_DAYS` —
      in one module beside the match thresholds.
- [x] 3.2 Implement `stockStatus(item, canonical): StockStatus` in
      `src/logic/stockStatus.ts`, deriving status per food class: mass for
      staples, uses or fullness for seasonings and condiments, expiry proximity
      for perishables.
- [x] 3.3 Make an explicit fullness setting authoritative over any estimate.
- [x] 3.4 Unit-test every class against a fixture table covering each status
      boundary.

## 4. Queries

- [x] 4.1 Add location queries to `src/db/queries.ts`: list, add, rename,
      reassign-and-remove. Removal takes a destination location and moves items
      in the same transaction.
- [x] 4.2 Add pantry item queries: insert, read by id, list ordered by expiry
      ascending, update location, mark opened, set fullness, mark used up, mark
      discarded.
- [x] 4.3 Recompute and persist `expires_at` on the events that change it —
      creation, opening, location change, freeze — and nowhere else.
- [x] 4.4 Verify removing a location never deletes its items.

## 5. Store and view model

- [x] 5.1 Add a Zustand store for the catalogue in `src/store/`, following the
      existing store conventions.
- [x] 5.2 Expose a view model carrying name, status, expiry, and location — and
      **not** `qty_remaining` or `uses_count`, so no component can render a
      quantity it should not.
- [x] 5.3 Carry a user-entered quantity, where one exists, as a separate
      explicitly-named field so echoing it back is deliberate rather than
      accidental.
- [x] 5.4 Group items by canonical ingredient for display, so twelve tins read
      as one row with a count.

## 6. Screens

- [x] 6.1 Add a pantry tab under `app/(tabs)/`, listing items ordered by expiry
      with expiring-soon distinguished. Components from `src/components`, tokens
      from `src/constants/theme.ts`, no literals.
- [x] 6.2 Build manual add: choose ingredient, location, acquisition date; show
      the predicted expiry before saving.
- [x] 6.3 Build the item detail sheet with one-tap actions — used up, running
      low, mark opened, freeze, discard — and the four-state fullness control
      where the food class calls for it.
- [x] 6.4 Build location management: add, rename, and remove with the
      reassignment prompt the spec requires.
- [x] 6.5 Offer freezing only where the canonical ingredient is freezable.
- [x] 6.6 Audit every pantry surface for a rendered quantity or percentage.
      There must be none.

## 7. Verification

- [x] 7.1 Add items by hand across all four locations and confirm predicted
      expiry differs by location for the same ingredient.
- [x] 7.2 Confirm marking an item opened shortens its expiry, and that freezing
      extends it.
- [x] 7.3 Confirm *Settings → Delete all data* clears pantry items and returns
      locations to the shipped defaults.
- [x] 7.4 Run `npm run typecheck` and `npm test`, then record the threshold
      values that survived testing in `docs/product-decisions.md`.
