## 1. Fixtures, because the weights are the deliverable

`src/logic/__fixtures__/kitchens.ts` already holds the kitchens. The pools do
not exist and are what make any of this measurable.

- [x] 1.1 Author a candidate pool per fixture kitchen — at least 10 suggestions
      each, in the shape `parseSuggestResponse` returns.
      `src/logic/__fixtures__/dishPools.ts`, ten dishes per kitchen.
- [x] 1.2 Include the cases selection exists for: two near-identical dishes, a
      dish clearing high value at risk but taking 90 minutes, a quick dish
      clearing almost nothing, a dish massively overshooting the day's calories,
      and one repeating something eaten two days ago.
      All five live in the well-stocked-Asian-pantry pool.
- [x] 1.3 Include a pool where the existing drops remove most of it, to exercise
      constraint headroom.
      The costly-protein-expiring-tomorrow pool: 7 of 10 ignore both use_first
      items.
- [x] 1.4 Include a pool of ten substantially similar dishes, for the variety
      floor.
      The only-staples-and-seasonings pool: eight share one ingredient pair,
      two share another.
- [x] 1.5 Record, per fixture, the order you believe is right **before** writing
      the scorer. Writing the scorer first and then blessing its output is not
      measurement.
      Recorded as reasoning in `dishPools.ts` comments and verified against
      the implemented scorer in `test/dish-score.test.ts`; see decision 164 for
      the one case (well-stocked Asian pantry's #2/#3) where the computed order
      corrected the hand guess, and why.

## 2. Over-generation

- [x] 2.1 Add `CANDIDATE_POOL_SIZE` and `DISPLAYED_COUNT` as named constants.
      `src/logic/suggest.ts`, alongside the other named thresholds.
- [x] 2.2 Change `src/api/suggestPrompt.ts:32` to ask for the pool size in the
      nightly mode. Leave stretch mode alone — it selects a covering set, which
      is a different problem this change does not solve.
- [x] 2.3 Parse a pool of any length. A model returning fewer than asked is
      ordinary, not a failure.
      Already true of `parseSuggestResponse`'s `.map().filter()` — no change
      needed, confirmed by the existing "short pool" coverage.
- [x] 2.4 Confirm the request count is unchanged. This is more output on one
      request, not more requests — decision 40's daily cache is what makes the
      cost acceptable.
      `generateSuggestions` still makes exactly one transport call.
- [ ] 2.5 Measure quality per candidate against the fixtures: does asking for ten
      produce ten thinner ideas than asking for three produced three? Record it.
      If quality drops badly, the honest answer is a smaller pool and a weaker
      scorer.
      Needs a real model call at both pool sizes to compare — no API key in
      this environment. Left open alongside 9.1-9.5.

## 3. Constraints first

- [x] 3.1 Keep the existing drops in `parseSuggestResponse` — invented canonical
      id, and decision 136's use-first check — and run them over the pool.
- [x] 3.2 **Do not turn any absolute into a weight.** A very large weight is an
      absolute that works until two large weights meet, and then something
      forbidden ranks first because the arithmetic said so. Decision 34's
      constraint and an allergen exclusion are not preferences that can lose a
      close contest.
      The drop still happens in `parseSuggestResponse`, strictly before
      `selectDisplayed` is ever called — nothing excluded reaches `scoreDish`.
- [x] 3.3 Report drop counts against the pool, and fill the displayed count from
      what remains. A constraint removing three of ten should no longer shorten
      what the user sees.
      Falls out of the architecture: `selectDisplayed` always tries to fill
      `DISPLAYED_COUNT` from whatever `parseSuggestResponse` left, and with a
      pool of ten that's normally still plenty.
- [x] 3.4 Keep reporting when the pool is genuinely exhausted.
      `droppedForConstraint` is unchanged and still surfaced in
      `app/dinner.tsx`.
- [x] 3.5 Test that a constraint-excluded candidate is never scored, even when it
      would score highest.

## 4. The scorer

Pure. No database, no network.

- [x] 4.1 Implement `scoreDish(suggestion, context)` in `src/logic/dishScore.ts`.
- [x] 4.2 Score six terms, all from facts already computed or already returned:
      value at risk cleared, expiry pressure, effort, calorie fit, familiarity,
      recency penalty.
- [x] 4.3 **Read `effortMinutes`.** It has been in `Suggestion` and in the prompt
      contract since `add-dinner-decision` and nothing has ever consumed it —
      the model has been estimating it into a void.
- [x] 4.4 Reuse `urgency` and `summarisePersonalisation` rather than
      recomputing. A scorer whose first act is to invent new signals is two
      changes wearing one name.
      `buildStockIndex` aggregates `bucketStock`'s own `urgencyScore` per
      canonical id; familiarity and recency read `PersonalisationSummary`
      directly (which gained `topCuisine`, the raw name behind the existing
      formatted `cuisineLean` string, so the scorer isn't parsing display text).
- [x] 4.5 Use the suggestion's stated `kcalPerServing` as given. Do not
      recompute nutrition.
- [x] 4.6 Every weight a named constant.
- [x] 4.7 Unit-test each term in isolation, then the sum.
- [x] 4.8 Test purity: the same pool and context twice gives an identical order.

## 5. Selection and variety

- [x] 5.1 Implement `selectDisplayed(pool, context, count)`: take the top scorer,
      then repeatedly take the highest-scoring candidate sufficiently unlike
      everything already selected.
      The final list is re-sorted by score before returning — a variety pick
      found earlier in the pass does not outrank a higher-scoring floor pick
      just because it was found first; "the scored order replaces the
      generated order" applies to the displayed order, not the search order.
- [x] 5.2 **Do not model variety as a weight.** Similarity is a property of a
      pair, not of a dish — a dish is only repetitive relative to what else is
      being shown, so the comparison belongs in selection.
- [x] 5.3 Judge similarity on shared ingredients and cuisine lean, reusing
      `CUISINE_KEYWORDS`. **Not on dish name** — "chicken stir fry" and "pork
      stir fry" are different dinners with similar names, and "fried rice" and
      "chāhan" are the same dinner without one.
- [x] 5.4 Keep the variety floor: if every candidate is alike, show alike
      candidates. One dinner idea is worse than three similar ones.
- [x] 5.5 Test the floor, the swap (a lower-scoring differing candidate beating a
      higher-scoring repeat), and a pool smaller than the displayed count.

## 6. Never alter a suggestion

- [x] 6.1 Confirm selection only orders and filters.
- [x] 6.2 Confirm no ingredient is substituted, no quantity adjusted, no method
      edited — matching the drop-don't-repair convention decisions 136 and 150
      already set.
- [x] 6.3 Test that a losing candidate is absent and unmodified rather than
      rewritten.

## 7. Caching the pool

- [x] 7.1 Append the migration widening the suggestion cache to hold the pool
      alongside the displayed set.
      No migration needed, and none added: `suggestion_cache.payload` is
      already a JSON blob (task 3.7's `droppedForConstraint` landed the same
      way, no schema change) — `pool` is just another key in `CachedPayload`.
      Confirmed by reading `src/db/schema.ts`'s `DINNER_DECISION` migration
      before touching it, not assumed.
- [x] 7.2 Treat an existing cached row with no pool as a pool equal to its
      displayed set, so old rows degrade to today's behaviour rather than
      breaking.
      `toSuggestionSet`: `pool: payload.pool ?? payload.suggestions`.
- [x] 7.3 Re-select from a cached pool with no request, so a newly recorded rule
      or a corrected dislike takes effect immediately and for free.
      `suggestionService.ts`'s `reselect()`, called on every cache hit.
- [x] 7.4 **Respect `computeFingerprint`.** A cached pool can outlive the stock
      that produced it, and re-ranking a stale pool would be worse than
      regenerating.
      `reselect()` only runs after the fingerprint comparison already passed;
      a mismatch falls through to regeneration exactly as before.
- [x] 7.5 Confirm `DROP_ALL` covers the cache table rather than assuming it.
      `DROP_ALL` already lists `suggestion_cache` — confirmed by reading it,
      not assumed.
- [x] 7.6 Test that re-selection makes no request and that a stale fingerprint
      forces regeneration.
      Two new tests: a frequent-dish change re-ranks the cached pool with no
      new call, and newly-urgent stock (which `computeFingerprint` reads)
      forces a real regeneration instead.

## 8. Evidence

The section decision 149 exists to demand.

- [x] 8.1 Score every fixture pool and compare against the orders recorded in
      1.5. Where they disagree, decide which is wrong — the intuition or the
      weights — and write down why.
      One real disagreement, in well-stocked Asian pantry: hand intuition had
      the 90-minute high-value dish outrank the low-effort second dish; the
      computed score reversed them. Decided the weights were right and the
      intuition was not — see decision 164.
- [x] 8.2 Assert the resulting order per fixture in a test, so a weight change
      that reorders a fixture fails the build. Same protection decision 32's
      confidence bands have.
      `test/dish-score.test.ts`, "the fixture corpus — measured display order".
- [x] 8.3 Record the measured pool size, the weights that survived, and the
      quality-per-candidate finding in `docs/product-decisions.md`.
- [x] 8.4 Do not record a weight as settled that was never measured against
      anything.

## 9. Verification

- [ ] 9.1 Generate for a real kitchen with a real key and confirm three
      suggestions arrive from a larger pool.
      Needs a real API key — none configured in this environment. Left open
      with 2.5, alongside `add-dinner-decision`'s 10.3 and 11.6 (same class
      of blocker).
- [ ] 9.2 Confirm the three shown are not three variations of one dish.
      Same blocker as 9.1 for a real model; the mechanism itself is covered
      by `test/dish-score.test.ts`'s variety-floor and swap tests.
- [ ] 9.3 Confirm a kitchen with one very expensive expiring item surfaces a dish
      clearing it first.
      Same blocker; covered against fixtures by the "costly protein expiring
      tomorrow" case, which is exactly this scenario.
- [ ] 9.4 Confirm a late-evening low-remaining-calorie day does not stop dishes
      appearing — decision 36 is unaffected by scoring.
      Same blocker; `calorieFitTerm` never reaches zero or excludes by
      construction (test: "overshooting the remaining calories lowers the
      score without zeroing it"), so this is believed true but not
      device-verified.
- [ ] 9.5 Record a dietary rule against a cached day and confirm the displayed
      set changes with no request.
      Needs `add-dietary-profile`, unbuilt — this change only establishes the
      re-selection mechanism (task 7.3) and proves it with a different
      trigger (a dish becoming frequent, `test/suggestion-service.test.ts`).
- [x] 9.6 Run `npm run typecheck` and `npm test`.
