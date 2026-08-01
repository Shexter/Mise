## 1. Test harness and fixtures

Nothing here needs a network or an API key. It comes first because the
normaliser and the similarity scorer are where correctness is cheap to verify
and expensive to eyeball.

- [x] 1.1 Add a test runner to the repo (`jest-expo` or `vitest` with a React
      Native-safe config), an `npm test` script, and one passing smoke test.
      Keep it out of the Expo bundle.
- [x] 1.2 Create `src/logic/__fixtures__/receipt-lines.ts` with at least 40 real
      receipt strings covering abbreviations, size tokens, weight-priced tails,
      store-brand prefixes, and CJK product names, each paired with the
      canonical slug it should resolve to.
- [x] 1.3 Create a matching fixture set for vision and meal-log phrasings of the
      same foods, so the same canonical is reachable from every channel.

## 2. Schema and types

- [x] 2.1 Append migration 2 to `MIGRATIONS` in `src/db/schema.ts` creating
      `canonical_items`, `item_aliases`, `products`, and `match_queue` with the
      indexes from `docs/identity-layer.md`. Do not edit `INITIAL_SCHEMA`.
- [x] 2.2 Extend `DROP_ALL` in `src/db/schema.ts` with the four new tables so
      *Delete all data* stays complete.
- [x] 2.3 Add domain types to `src/types.ts` mirroring the new tables:
      `CanonicalItem`, `ItemAlias`, `Product`, `QueuedMatch`, plus the
      `FoodClass` and `StorageLocation` unions with their `readonly` value
      arrays, following the existing `MEASURE_UNITS` pattern.
- [x] 2.4 Verify the migration runs on a fresh install and on an install already
      at `user_version = 1`, and that `npm run typecheck` passes.

## 3. Normalisation

- [x] 3.1 Implement `src/logic/normalise.ts`: case-fold, strip punctuation,
      collapse whitespace. Pure, no imports from `db` or `api`.
- [x] 3.2 Add size-token and weight-priced-tail stripping (`500ML`, `2 LB`,
      `0.62 LB @ 0.59/LB`).
- [x] 3.3 Add the store-brand prefix list and the retailer abbreviation
      dictionary (`grn`, `bnch`, `chkn`, `bnls`, `org`, `frz`, `slcd`, `swt`),
      as exported data rather than inline literals so they can grow.
- [x] 3.4 Ensure non-Latin scripts pass through unmodified — no
      transliteration, no stripping of CJK characters.
- [x] 3.5 Unit-test the normaliser against the fixtures from 1.2 and 1.3.

## 4. Similarity scoring

- [x] 4.1 Implement a trigram Dice coefficient with a length-ratio penalty in
      `src/logic/similarity.ts`. Pure and dependency-free.
- [x] 4.2 Export `MATCH_ACCEPT = 0.85` and `MATCH_CONFIRM = 0.60` as named
      constants from one module (decision 32 is open — these are placeholders
      and must be adjustable in one place).
- [x] 4.3 Unit-test scoring on the receipt fixtures, asserting that known pairs
      land above `MATCH_ACCEPT` and known non-pairs below `MATCH_CONFIRM`.
      Record any fixture that lands in the confirm band — that set is the
      tuning evidence for decision 32.

## 5. Seed data

- [x] 5.1 Define the seed file shape and write `assets/canonical-items.json`
      with a first cut covering common Western staples and the Asian set named
      in the spec (doubanjiang, gochujang, fish sauce, oyster sauce, Shaoxing
      wine, mirin, miso, belacan), each with class, default location, unopened
      and opened shelf life, and typical use amount.
- [x] 5.2 Write `assets/item-aliases.json`, including in-script CJK aliases
      (`醬油`, `간장`) and common receipt abbreviations, each pointing at a
      canonical slug.
- [x] 5.3 Implement idempotent seed loading in `src/db/queries.ts`, keyed on
      canonical slug so re-running adds new rows without duplicating existing
      ones.
- [x] 5.4 Call the loader on launch from the existing database init path in
      `src/db/index.ts`, and verify a fresh install resolves `gochujang` with no
      network and no API key.

## 6. Local queries and the offline cascade

- [x] 6.1 Add read queries to `src/db/queries.ts`: canonical by slug, product by
      barcode, alias by exact normalised form, and the candidate prefilter for
      approximate matching (shared first trigram or shared token).
- [x] 6.2 Add write queries: insert canonical, insert alias, insert product,
      enqueue unresolved reference.
- [x] 6.3 Implement the batch-first entry point `resolve(references, source,
      options)` in `src/logic/match.ts`, returning per-reference outcomes of
      resolved / needs-confirmation / unresolved with confidence and method.
- [x] 6.4 Implement cascade steps 1 to 3 — barcode, exact alias, approximate
      alias — with early exit at the first step meeting its confidence bar.
- [x] 6.5 Implement alias write-back for approximate and user-confirmed
      resolutions.
- [x] 6.6 Implement ownership bias as a scoring input applied before threshold
      comparison, bounded so it cannot lift a match above `MATCH_ACCEPT` on its
      own. Ranking order: in stock, then opened, then frequently used.
- [x] 6.7 Integration-test the offline cascade end to end against the fixtures
      with no network and no API key configured, asserting that unknown
      references are reported unresolved rather than throwing.

## 7. Model-assisted resolution

First point in the change that needs an API key.

- [x] 7.1 Write `src/api/resolvePrompt.ts` mirroring the conventions of
      `src/api/prompt.ts`: raw JSON out, no prose, explicit schema.
- [x] 7.2 Implement `src/api/resolve.ts` beside `vision.ts`, reusing the
      existing provider facade, key access, and `src/api/errors.ts` taxonomy.
      Do not touch `keyStore.ts`.
- [x] 7.3 Send one batched request per call, including candidate canonicals and
      the ingredients the user currently has.
- [x] 7.4 Wire step 4 into the cascade, reached only when steps 1 to 3 leave
      references unresolved.
- [x] 7.5 Implement step 5, proposing a new canonical with class, location,
      shelf life, and typical use amount.
- [x] 7.6 Route a malformed or failed batch response to the review queue rather
      than surfacing an error, so a failed batch degrades to "needs review".

## 8. Duplicate prevention and merge

- [x] 8.1 Gate canonical creation behind an approximate-match check against
      existing canonical names, reusing the scorer from group 4. Above
      `MATCH_ACCEPT` reuse; between thresholds ask.
- [x] 8.2 Implement merge in `src/db/queries.ts` as one transaction: repoint
      `item_aliases.canonical_id` and `products.canonical_id`, then delete the
      absorbed canonical.
- [x] 8.3 Test that aliases from both sides resolve to the survivor, products
      follow, and the absorbed canonical stops appearing as a match candidate.

## 9. Minimal surfaces

Only what makes the cascade usable. Catalogue browsing is out of scope.

- [x] 9.1 Build the confirm-a-match surface for needs-confirmation outcomes,
      using components from `src/components` and tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.
- [x] 9.2 Build the review queue screen: queued references with their original
      text and captured context, resolvable in one tap, writing an alias on
      resolution.
- [x] 9.3 Build the merge surface: pick two canonicals, confirm, merge.
- [x] 9.4 Confirm every ingredient shown anywhere uses the canonical display
      name and never the raw observed text.

## 10. Wiring and verification

- [x] 10.1 Add optional `canonicalId` to each entry in
      `assets/hidden-ingredients.json` and to the `HiddenIngredient` type,
      leaving the existing shape and the calorie path unchanged.
- [x] 10.2 Verify *Settings → Delete all data* clears the four new tables and
      that a subsequent launch reloads only the shipped seed set.
- [x] 10.3 Run the full fixture suite offline, then once with a key configured,
      and record which fixtures land in the confirm band as the tuning evidence
      for decision 32.
      *Note: the offline run and the confirm-band recording are done (see
      decision 32 and `similarity.test.ts`). No API key exists in the CI
      environment, so the keyed pass is covered by the fake-resolver
      integration tests in `test/model-resolution.test.ts` and should be
      repeated on a device with a real key before shipping.*
- [x] 10.4 Run `npm run typecheck` and `npm test`, then update decision 32 in
      `docs/product-decisions.md` with the measured thresholds.
