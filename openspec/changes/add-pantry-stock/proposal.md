## Why

`add-identity-layer` establishes what a food *is*. This establishes what the
user *has* — the catalogue of physical items in their kitchen, where each one
lives, and when it will go off.

It has to exist before depletion can subtract from anything, and it is the first
change that produces a screen a user would open on its own. It is also where
decision 15 becomes real: the catalogue is the surface that must say "running
low" and never "486 g of rice left", and that constraint shapes the data model
rather than just the copy.

Implements decisions 12, 14, 16 through 20, and 24.

## What Changes

- **New forward-only migration** adding `pantry_items` and `locations`. No
  existing table is altered.
- **Storage locations are user-editable** (decision 16). Fridge, Freezer,
  Pantry, and Counter ship as defaults; kitchens are idiosyncratic enough that a
  fixed enum will be wrong for most people. Counter earns its place because
  produce stored there rots on a different clock than produce in a fridge.
- **Location and food class stay orthogonal** (decision 17). Location drives
  expiry, class drives depletion. Dried pasta lives in a cupboard and is tracked
  by mass.
- **Predicted expiry from a lookup table** (decision 19), computed from purchase
  or opening date, the canonical ingredient's shelf life, and where the item is
  stored. Separate figures for unopened and opened.
- **Freezing is an action, not just a move** (decision 20). Sending an item to
  the freezer recomputes its expiry from the same table.
- **Four-bucket fullness** (decision 14) for seasonings and condiments: full,
  half, low, out.
- **Item status is advisory** (decision 15): in stock, running low, out,
  discarded. The interface never exposes a computed quantity.
- **Manual add**, so the catalogue is usable and testable before the capture,
  barcode, and receipt flows exist (decision 24).

## Capabilities

### New Capabilities

- `pantry-stock`: The catalogue of what is physically in the kitchen. Covers
  pantry items and their link to canonical ingredients, user-editable storage
  locations, expiry prediction and the freeze action, fullness for
  uses-tracked items, the advisory status model and the rule that quantities are
  never displayed, and manual entry.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Depletion.** Subtracting stock when a meal is logged is `add-stock-depletion`,
  which depends on this change. Here, quantities change only by explicit user
  action.
- **Capture flows.** The batched first-run photo capture, barcode scanning, and
  receipt import each produce pantry items, and each is its own change. This one
  ships manual add so the rest is testable without them.
- **The dinner decision.** Consumes this catalogue; specified separately.
- **Spending.** `price_cents` is stored because receipts will populate it and
  because urgency weighting needs it, but no spending surface ships here.
- **Shopping lists.** Out of scope.

## Impact

**Schema.** One migration taking `user_version` from 2 to 3, adding
`pantry_items` and `locations`. `DROP_ALL` extended so *Delete all data* stays
complete.

**Code.**
- `src/db/queries.ts` — all new SQL.
- `src/logic/expiry.ts` — new, pure, computing predicted expiry from shelf life,
  location, and dates. Unit-testable with no network.
- `src/logic/stockStatus.ts` — new, pure, deriving advisory status from
  quantity, fullness, and expiry per food class.
- `src/types.ts` — `PantryItem`, `Location`, `Fullness`, `StockStatus`.
- `src/store/` — a new Zustand store for the catalogue.
- `app/(tabs)/` — a pantry tab.

**Dependencies.** None added.

**Depends on** `add-identity-layer`. `pantry_items.canonical_id` references
`canonical_items`, and expiry prediction reads the shelf life figures that
change defines. It should not be started before that one lands.

**Risk.** The status thresholds that decide when something is "running low" are
guesses until real usage exists, in the same way the match thresholds are. They
are specified as named constants for the same reason.
