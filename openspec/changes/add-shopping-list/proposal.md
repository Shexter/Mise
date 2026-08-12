## Why

Mise already captures pantry stock, recipes, dinner suggestions, and receipts, but it stops before the grocery trip. Users can see what is low or missing yet still have to remember what to buy and reconcile the haul manually. This change closes that loop with a local-first shopping list that turns pantry and recipe signals into an actionable grocery haul and safely reconciles confirmed receipts.

This implements the local-first and explainable-stock principles in decisions 5, 9, 11, 35, 60, 68, 95, 122, and 161. It complements `add-shop-locations`; it does not require location permission.

## What Changes

- Add one unified shopping list inside Pantry as a `Stock · Recipes · Shop` subsection.
- Add open entries for `out` and `running_low` pantry items, explicit recipe gaps, dinner-suggestion gaps, and manual additions.
- Deduplicate entries by canonical identity while retaining source explanations.
- Use qualitative need states by default; show measurable quantities only when user- or recipe-stated.
- Group entries by existing food-class/category taxonomy.
- Add recipe and dinner-suggestion actions to add only currently missing ingredients.
- Reconcile confirmed receipt lines against exact canonical/barcode shopping entries.
- Auto-complete only high-confidence matches and provide an undo path that never reverses pantry effects.
- Persist list items, source provenance, and receipt matches locally; include them in reset/export behavior where appropriate.

## Capabilities

### New Capabilities

- `shopping-list`: A local, explainable grocery list sourced from pantry, recipes, suggestions, manual entries, and confirmed receipts.

### Modified Capabilities

- `pantry-navigation`: Pantry gains a Shop subsection while Today remains focused on current-day nutrition and meals.
- `recipe-coverage`: Saved recipes can add their unresolved or missing ingredients to the shopping list.
- `receipt-reconciliation`: Confirmed receipt lines may complete exact shopping-list matches with reversible list-only state changes.

## Non-goals

- No store-specific aisles, retailer integrations, price tracking, budgets, household sharing, or push notifications.
- No location permission; location-aware prompts remain a separate `add-shop-locations` concern.
- No automatic pantry writes from merely checking off a shopping item.
- No inferred measurable replenishment quantities from uncertain stock estimates.
- No recipe discovery or external recipe corpus.

## Impact

- `src/types.ts`, `src/db/schema.ts`, and `src/db/queries.ts` gain shopping-list models, a forward-only migration, CRUD, provenance, and receipt-match persistence.
- New pure shopping-list logic handles source merging, canonical deduplication, grouping, quantity copy, receipt eligibility, and undo transitions.
- Pantry, recipe detail, dinner suggestion, receipt review, export, and delete-all surfaces gain small integrations.
- New Pantry Shop UI uses existing theme tokens and shared components; no new dependency is required.
- Automated unit and UI contract tests cover local behavior. Real-device acceptance remains open for the owner.
