## Context

See `proposal.md` — Why, for motivation, and `docs/identity-layer.md` for the
long-form design this document condenses into implementable decisions.

Constraints that shape the approach:

- **All SQL lives in `src/db/queries.ts`.** No SQL in logic, components, or API
  modules.
- **Migrations are forward-only.** `MIGRATIONS` in `src/db/schema.ts` is
  append-only; `MIGRATIONS[n]` upgrades `user_version` from `n` to `n+1`. The
  shipped `INITIAL_SCHEMA` is not editable.
- **No server, no accounts.** Everything is on-device SQLite, and the only
  outbound calls go to the user's chosen vision provider under their own key.
- **`expo-sqlite` ships SQLite without FTS5 guarantees or trigram extensions.**
  Approximate matching cannot assume a full-text extension is available.
- **TypeScript strict throughout**, and there is currently no test runner in the
  repo — `npm run typecheck` is the only automated gate that exists today.

## Goals / Non-Goals

**Goals:**

- One resolution entry point that every channel calls, so matching behaviour
  cannot drift between the receipt path and the meal-log path.
- The common path costs nothing: no network, no API key, no model call.
- Matching improves with use, without the user being asked to train it.
- Seed data is a plain data file, editable by a non-programmer, because it will
  be edited far more often than the code that reads it.

**Non-Goals:**

- Semantic embeddings or a vector index. Overkill for a few hundred canonical
  ingredients, and it would add a dependency and an offline model.
- A general-purpose fuzzy search library. One scoring function is needed, not a
  search engine.
- Cross-device sync of learned aliases. Local-first (decision 5); the alias
  table is per-install and rebuilt from seed on reinstall.

## Decisions

### Resolution is one function with a source tag, not one per channel

A single `resolve(references, source, options)` returns a result per reference:
resolved with confidence and method, needs-confirmation, or unresolved. Channels
differ only in the `source` tag they pass and in what they do with the outcome.

*Why:* the cascade, the confidence bands, and the write-back rule must be
identical everywhere. Four call sites implementing their own variant is how the
receipt path and the meal-log path end up disagreeing about what `soy sauce`
means. *Alternative considered:* per-channel resolvers sharing helpers —
rejected because the shared part is nearly all of it.

### Batch-first API shape

`resolve` takes an array and returns an array, even for a single reference.

*Why:* step 4 must batch into one request per receipt (spec: *Model-assisted
resolution is batched*). An API that takes one reference at a time makes the
batched call an awkward special case, and the natural implementation becomes one
request per line — the exact thing the spec forbids. Taking an array makes the
correct behaviour the default and the single-reference call a trivial case.

### Approximate matching is a hand-rolled trigram Dice coefficient

Score two normalised strings by the Dice coefficient over their character
trigram sets, with a length-ratio penalty to stop short strings matching long
ones.

*Why:* roughly thirty lines, no dependency, no native module, and it runs fine
over a few thousand aliases on a phone. *Alternatives considered:* SQLite FTS5
(not guaranteed available through `expo-sqlite`, and it is a relevance search
rather than a similarity score); Levenshtein distance (poor on the
transposition-and-abbreviation errors receipts actually contain, e.g.
`KIKKO SOY` against `kikkoman soy sauce`); a library such as Fuse.js (a
dependency for one function).

Candidate aliases are pulled by a cheap SQL prefilter — a shared first trigram
or a shared token — then scored in TypeScript. Scoring every alias in the table
on every lookup is avoidable and would get slower as the table grows.

### Thresholds are named constants in one module

`MATCH_ACCEPT = 0.85` and `MATCH_CONFIRM = 0.60`, exported from the matching
module.

*Why:* decision 32 is open and these are explicitly placeholders. Naming them in
one place means tuning is a one-line change rather than a hunt through call
sites. The spec requires them to be adjustable, and this is the cheapest form of
adjustable that does not invent a settings surface nobody asked for.

### Seed data is JSON in `assets/`, loaded once and idempotently

Two files: `assets/canonical-items.json` and `assets/item-aliases.json`, loaded
on first launch, keyed on the canonical slug so a re-run is a no-op.

*Why:* `assets/hidden-ingredients.json` already establishes this pattern in the
repo, and JSON is editable by whoever authors the 300 records without touching
TypeScript. Loading is idempotent so a seed-version bump can add rows to an
existing install without duplicating what is there.

*Trade-off:* the seed file is parsed at startup. At a few hundred records this
is immaterial; if it grows past a few thousand, move the load behind a version
check that skips parsing entirely when the shipped version matches the stored
one.

### `hidden-ingredients.json` gains fields rather than being replaced

The file keeps its shape and its existing consumers in
`src/constants/hiddenIngredients.ts`. It gains an optional `canonicalId` per
entry linking each quick-pick to a canonical ingredient.

*Why:* its `defaultQuantity` and `unit` are already the typical-use figure the
seasoning depletion model needs (decision 13). Linking rather than duplicating
means one number, not two that drift. Nothing in the calorie path changes.

### Merge is a transaction over three tables, and is not undoable

Repoint `item_aliases.canonical_id` and `products.canonical_id`, then delete the
absorbed canonical, in one transaction.

*Why:* the spec requires aliases and products to survive. A transaction is the
only way the intermediate state is never observable. *Undo was considered and
rejected for this change:* it needs a tombstone plus a reverse operation, and
the destructive case is bounded — merging two ingredients that should have
stayed separate is recoverable by creating the second one again, since aliases
re-learn. Worth revisiting once pantry items reference canonicals.

### Duplicate prevention reuses the matcher

Before creating a canonical ingredient, run its proposed display name through
approximate matching against existing canonical names. Above `MATCH_ACCEPT`,
reuse the existing one. Between the thresholds, ask.

*Why:* the "is this the same thing" question is the same question the matcher
already answers. A second, differently-tuned similarity check would be a second
thing to keep correct.

### Ownership bias is a scoring input, not a post-filter

Candidates get a bonus for being in stock, opened, and frequently used, applied
before the thresholds are compared.

*Why:* as a post-filter it can only break ties. As a scoring input it can lift a
slightly-worse textual match that is actually in the user's kitchen above a
better textual match that is not — which is the behaviour the spec describes.
The bonus must stay small enough that it cannot promote a genuinely wrong match
above `MATCH_ACCEPT` on its own.

### Model resolution reuses the existing provider facade

A new `src/api/resolve.ts` sits beside `vision.ts` and goes through the same
provider selection and key handling. It gets its own prompt module mirroring
`src/api/prompt.ts`, and returns raw JSON parsed by the same discipline.

*Why:* provider selection, error taxonomy (`src/api/errors.ts`), and key access
are already solved and already confined. Reimplementing any of it would put a
second copy of the key-handling rules in play, which decision 5's privacy story
cannot afford. No change to `keyStore.ts`.

## Risks / Trade-offs

**Seed data authoring is the critical path** → 300 records with shelf lives and
typical-use amounts is real work, and it gates the Asian coverage that
differentiates the product. Mitigation: stage it. Ship a smaller
high-confidence set that covers the common Asian pantry, and grow it — the
schema and loader do not change as it grows.

**Placeholder thresholds will misbehave on real receipts** → 0.85 and 0.60 are
guesses. Too wide a confirm band nags; too narrow silently mismatches, which is
worse. Mitigation: named constants, plus a fixture set of real receipt strings
built during implementation so tuning has something to run against.

**Trigram scoring degrades as the alias table grows** → every resolution scores
a candidate set in TypeScript. Mitigation: the SQL prefilter bounds the
candidate set; if it stops bounding it well, add an indexed first-trigram
column before reaching for a heavier approach.

**Ownership bias can entrench an early mistake** → once a wrong canonical is in
stock, it is preferred, which makes the same wrong match more likely next time.
Mitigation: a user correction writes an alias that wins by exact match on every
subsequent lookup, which outranks any biased approximate score.

**Batched model resolution is all-or-nothing per request** → one malformed
response loses every reference in the batch. Mitigation: unresolved references
fall to the review queue rather than erroring, which the spec already requires;
a failed batch degrades to "these need review", not to a failed scan.

**No test runner exists in the repo** → the pure logic here is exactly what
should be unit tested, and there is currently nothing to run tests with.
Mitigation: the task breakdown installs a minimal runner before the logic tasks,
since the normaliser and the scorer are the two places where correctness is
cheap to verify and expensive to eyeball.

## Migration Plan

One new entry appended to `MIGRATIONS` in `src/db/schema.ts`, taking
`user_version` from 1 to 2, creating `canonical_items`, `item_aliases`,
`products`, and `match_queue` with their indexes. No existing table is altered
and no existing migration is edited.

`DROP_ALL` in the same file gains the four new tables, so *Settings → Delete all
data* stays complete (spec: *Ingredient identity data is covered by data
deletion*).

Rollback: the change is additive. An install that has run the migration and then
loads an older build keeps the tables and ignores them; nothing in the existing
calorie path reads them. There is no destructive step to reverse.

## Open Questions

- **Seed set size for the first cut.** The spec requires named Asian
  ingredients to be present; the exact count beyond that is a content decision
  that can be answered while authoring, and does not change the schema, the
  loader, or the tasks.
- **Whether `match_queue` entries expire.** A reference nobody reviews for six
  months is probably noise. Deferrable: it is a cleanup policy over one table,
  and adding it later changes no interface.
