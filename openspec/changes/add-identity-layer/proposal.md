## Why

Four separate channels will produce references to the same food — vision capture
(`Kikkoman soy sauce, 500ml bottle`), barcode (`0041390000010`), receipt
(`KIKKO SOY 500ML`), and the existing meal log (`soy sauce`). Unless all four
resolve to one row, every feature built on top is wrong: depletion decrements
the wrong item, expiry warnings fire on stock that is not there, and the dinner
decision proposes dishes the user cannot cook.

This is the foundation layer, so it comes first. Nothing above it can be more
correct than it is. It is also the layer that carries the product's
differentiator — deep Asian ingredient coverage with in-script aliases
(decision 4), which no Western-database competitor has.

Implements decisions 25 through 31. Decision 32 (fuzzy thresholds) is open and
is resolved here with tunable constants rather than hardcoded values.

## What Changes

- **New forward-only migration** appended to `MIGRATIONS` in `src/db/schema.ts`
  adding `canonical_items`, `item_aliases`, `products`, and `match_queue`. No
  existing table or migration is touched.
- **Three-level model** (decision 25): a *product* is a specific SKU, a
  *canonical ingredient* is the food concept, and a *pantry item* is a physical
  thing in the kitchen. This change delivers the first two; pantry items follow
  in a separate change.
- **A normaliser** for raw food strings: size-token stripping, store-brand
  prefix removal, receipt abbreviation expansion, and CJK left in script rather
  than romanised (decision 31).
- **A five-step match cascade** (decision 26): barcode, exact alias, fuzzy
  alias, model resolution, propose-new. Steps 1 through 3 are pure local SQLite
  and require no network and no API key — consistent with decision 8, offline
  means the data and the common path are local even though some steps call out.
- **Alias write-back** (decision 27) so a given raw string costs at most one
  model call, ever.
- **Disambiguation biased toward owned stock** (decision 28), resolving
  ambiguous names against what the user actually has rather than asking at
  log time.
- **Merge** (decision 29), shipping in v1 rather than later, because duplicate
  canonicals are the failure mode that ends the app.
- **Seed data**: roughly 300 canonical items and 2,000 aliases with deliberately
  deep Asian coverage (decision 30), shipped as a build-time asset.
- **A review queue** for references the cascade cannot resolve confidently, so
  an uncertain match never blocks a scan.

## Capabilities

### New Capabilities

- `ingredient-identity`: The canonical ingredient, alias, and product data
  model — what a food *is*, independent of how it was referenced. Covers
  canonical records and their per-class metadata, product/SKU records and their
  link to canonicals, alias storage including in-script CJK entries, seed data
  loading, duplicate prevention, and merge.
- `ingredient-matching`: How a raw reference from any channel resolves to a
  canonical ingredient. Covers string normalisation, the five-step cascade and
  its confidence bands, alias write-back, ownership-biased disambiguation,
  batched model resolution, new-canonical proposal, and the unresolved-reference
  queue.

### Modified Capabilities

None. `openspec/specs/` is empty — this is the first change in the project, and
it adds behaviour alongside the existing calorie tracker without altering any of
it.

## Non-goals

- **Pantry stock itself.** `pantry_items`, quantities, fullness, locations, and
  expiry prediction are a separate change that builds on this one.
- **Depletion.** `consumption_events` and decrementing stock from a logged meal
  are out of scope here.
- **Producing raw strings.** This layer *consumes* references. The receipt
  scanner, the barcode camera flow, and the batched pantry capture UI that
  produce them are separate changes. Matching is tested against fixture strings.
- **The dinner decision.** Depends on this layer, specified separately.
- **Any change to existing calorie logging.** Meals, meal items, targets, and
  the estimation prompt are untouched.
- **UI beyond the minimum.** This change ships the confirm-a-match and
  merge-two-canonicals surfaces because the cascade is unusable without them.
  Catalogue browsing is not in scope.

## Impact

**Schema.** One new migration in `src/db/schema.ts`; `DROP_ALL` extended to
cover the new tables so "Delete all data" stays complete.

**Code.**
- `src/db/queries.ts` — all new SQL, per the repo convention.
- `src/logic/` — new `normalise.ts` and `match.ts`, both pure and unit-testable
  with no network.
- `src/api/` — a new resolution module alongside `vision.ts`, reusing the
  existing provider facade and key handling. No change to `keyStore.ts`.
- `src/types.ts` — new domain types mirroring the new tables.
- `assets/` — new seed data file. `hidden-ingredients.json` gains pantry-side
  fields but keeps its existing shape and consumers.

**Dependencies.** None added. Fuzzy matching uses a small hand-rolled trigram
score rather than a library, to avoid a dependency for one function.

**Cost.** Steps 4 and 5 spend API calls, batched one per receipt or capture
session rather than per line. Steps 1 through 3 are free, and the alias
write-back means the paid path is hit less over time.

**Risk.** The seed data is a real authoring cost — 300 canonical records with
shelf lives and typical-use amounts. It is on the critical path for the Asian
coverage that differentiates the product, so it cannot be skipped, but it can be
staged: ship a smaller high-confidence set first and grow it.
