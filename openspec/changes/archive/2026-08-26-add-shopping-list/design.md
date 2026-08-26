## Context

Mise already has canonical identity, pantry status, recipe coverage, dinner missing-item data, confirmed receipt lines, and local SQLite persistence. The new capability must join those existing contracts without creating a second identity matcher or a second pantry-write path. See `proposal.md` and `specs/shopping-list/spec.md` for the product contract.

## Goals / Non-Goals

**Goals:**

- Keep one canonical shopping entry per resolved ingredient while retaining explainable source provenance.
- Make local list operations pure and testable independently of React Native and SQLite.
- Make receipt completion exact and reversible at the shopping-list layer.
- Append one forward-only migration and preserve unknown quantities as null.
- Keep Today uncrowded and put the feature in Pantry.

**Non-Goals:**

- Location, notifications, store aisles, retailer APIs, budgets, prices, sharing, and external recipe discovery.

## Decisions

### One item plus source rows, rather than one row per source

Use a `shopping_list_items` table with nullable `canonical_id`, plus `shopping_list_sources` rows. This allows pantry, recipe, suggestion, and manual reasons to converge on one item and disappear independently. A JSON source blob was rejected because it is difficult to query, migrate, and undo safely.

### Canonical identity is the deduplication key

Resolved entries merge by canonical ID. Unresolved manual entries merge only when their normalized free-text key matches exactly. Fuzzy matching never merges or completes an entry. This reuses the identity layer's trust boundary.

### Qualitative replenishment is the default

Pantry estimates expose status rather than a defensible buy amount. Recipe-stated and user-entered quantities remain nullable fields and may be shown. No inferred quantity is persisted.

### Receipt reconciliation is a list-only transition

Receipt confirmation already owns pantry writes. Shopping reconciliation runs after that confirmation and records exact matches separately. Undo changes only shopping status and match provenance; it never calls pantry reversal.

### Refresh is idempotent and source-aware

Opening Shop or receiving a relevant mutation runs a pure refresh plan. The plan adds missing active sources, removes stale automatic sources, preserves manual sources, and emits database operations. Database writes apply the plan transactionally where the existing query layer supports transactions.

### Category derives from existing food taxonomy

Use canonical food class/category where available, with `Other` for unresolved manual items. Store-specific aisles are deliberately deferred to avoid a second learned taxonomy.

### Migration and reset are additive

Append the next migration to `MIGRATIONS` after the current live head. Add all new tables to `DROP_ALL` and include shopping data in the existing export contract without exposing secrets.

## Risks / Trade-offs

- [Risk] Automatic low-stock entries can feel noisy. → Only `out`/`running_low` plus explicit recipe/suggestion gaps create entries; expiry alone does not.
- [Risk] Fuzzy receipt matches can mark the wrong purchase. → Auto-complete exact canonical/barcode identity only.
- [Risk] Source refresh could delete a user-maintained item. → Preserve manual provenance and never remove an item while any active source remains.
- [Risk] Receipt undo could accidentally reverse pantry stock. → Keep receipt match undo in shopping queries and never call stock-depletion reversal.
- [Risk] A new migration can conflict with parallel work. → Append once, verify the live schema ledger, and run migration tests before further schema changes.
