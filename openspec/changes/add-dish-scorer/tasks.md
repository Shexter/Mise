## 1. Fixtures, because the weights are the deliverable

`src/logic/__fixtures__/kitchens.ts` already holds the kitchens. The pools do
not exist and are what make any of this measurable.

- [ ] 1.1 Author a candidate pool per fixture kitchen — at least 10 suggestions
      each, in the shape `parseSuggestResponse` returns.
- [ ] 1.2 Include the cases selection exists for: two near-identical dishes, a
      dish clearing high value at risk but taking 90 minutes, a quick dish
      clearing almost nothing, a dish massively overshooting the day's calories,
      and one repeating something eaten two days ago.
- [ ] 1.3 Include a pool where the existing drops remove most of it, to exercise
      constraint headroom.
- [ ] 1.4 Include a pool of ten substantially similar dishes, for the variety
      floor.
- [ ] 1.5 Record, per fixture, the order you believe is right **before** writing
      the scorer. Writing the scorer first and then blessing its output is not
      measurement.

## 2. Over-generation

- [ ] 2.1 Add `CANDIDATE_POOL_SIZE` and `DISPLAYED_COUNT` as named constants.
- [ ] 2.2 Change `src/api/suggestPrompt.ts:32` to ask for the pool size in the
      nightly mode. Leave stretch mode alone — it selects a covering set, which
      is a different problem this change does not solve.
- [ ] 2.3 Parse a pool of any length. A model returning fewer than asked is
      ordinary, not a failure.
- [ ] 2.4 Confirm the request count is unchanged. This is more output on one
      request, not more requests — decision 40's daily cache is what makes the
      cost acceptable.
- [ ] 2.5 Measure quality per candidate against the fixtures: does asking for ten
      produce ten thinner ideas than asking for three produced three? Record it.
      If quality drops badly, the honest answer is a smaller pool and a weaker
      scorer.

## 3. Constraints first

- [ ] 3.1 Keep the existing drops in `parseSuggestResponse` — invented canonical
      id, and decision 136's use-first check — and run them over the pool.
- [ ] 3.2 **Do not turn any absolute into a weight.** A very large weight is an
      absolute that works until two large weights meet, and then something
      forbidden ranks first because the arithmetic said so. Decision 34's
      constraint and an allergen exclusion are not preferences that can lose a
      close contest.
- [ ] 3.3 Report drop counts against the pool, and fill the displayed count from
      what remains. A constraint removing three of ten should no longer shorten
      what the user sees.
- [ ] 3.4 Keep reporting when the pool is genuinely exhausted.
- [ ] 3.5 Test that a constraint-excluded candidate is never scored, even when it
      would score highest.

## 4. The scorer

Pure. No database, no network.

- [ ] 4.1 Implement `scoreDish(suggestion, context)` in `src/logic/dishScore.ts`.
- [ ] 4.2 Score six terms, all from facts already computed or already returned:
      value at risk cleared, expiry pressure, effort, calorie fit, familiarity,
      recency penalty.
- [ ] 4.3 **Read `effortMinutes`.** It has been in `Suggestion` and in the prompt
      contract since `add-dinner-decision` and nothing has ever consumed it —
      the model has been estimating it into a void.
- [ ] 4.4 Reuse `urgency` and `summarisePersonalisation` rather than
      recomputing. A scorer whose first act is to invent new signals is two
      changes wearing one name.
- [ ] 4.5 Use the suggestion's stated `kcalPerServing` as given. Do not
      recompute nutrition.
- [ ] 4.6 Every weight a named constant.
- [ ] 4.7 Unit-test each term in isolation, then the sum.
- [ ] 4.8 Test purity: the same pool and context twice gives an identical order.

## 5. Selection and variety

- [ ] 5.1 Implement `selectDisplayed(pool, context, count)`: take the top scorer,
      then repeatedly take the highest-scoring candidate sufficiently unlike
      everything already selected.
- [ ] 5.2 **Do not model variety as a weight.** Similarity is a property of a
      pair, not of a dish — a dish is only repetitive relative to what else is
      being shown, so the comparison belongs in selection.
- [ ] 5.3 Judge similarity on shared ingredients and cuisine lean, reusing
      `CUISINE_KEYWORDS`. **Not on dish name** — "chicken stir fry" and "pork
      stir fry" are different dinners with similar names, and "fried rice" and
      "chāhan" are the same dinner without one.
- [ ] 5.4 Keep the variety floor: if every candidate is alike, show alike
      candidates. One dinner idea is worse than three similar ones.
- [ ] 5.5 Test the floor, the swap (a lower-scoring differing candidate beating a
      higher-scoring repeat), and a pool smaller than the displayed count.

## 6. Never alter a suggestion

- [ ] 6.1 Confirm selection only orders and filters.
- [ ] 6.2 Confirm no ingredient is substituted, no quantity adjusted, no method
      edited — matching the drop-don't-repair convention decisions 136 and 150
      already set.
- [ ] 6.3 Test that a losing candidate is absent and unmodified rather than
      rewritten.

## 7. Caching the pool

- [ ] 7.1 Append the migration widening the suggestion cache to hold the pool
      alongside the displayed set.
- [ ] 7.2 Treat an existing cached row with no pool as a pool equal to its
      displayed set, so old rows degrade to today's behaviour rather than
      breaking.
- [ ] 7.3 Re-select from a cached pool with no request, so a newly recorded rule
      or a corrected dislike takes effect immediately and for free.
- [ ] 7.4 **Respect `computeFingerprint`.** A cached pool can outlive the stock
      that produced it, and re-ranking a stale pool would be worse than
      regenerating.
- [ ] 7.5 Confirm `DROP_ALL` covers the cache table rather than assuming it.
- [ ] 7.6 Test that re-selection makes no request and that a stale fingerprint
      forces regeneration.

## 8. Evidence

The section decision 149 exists to demand.

- [ ] 8.1 Score every fixture pool and compare against the orders recorded in
      1.5. Where they disagree, decide which is wrong — the intuition or the
      weights — and write down why.
- [ ] 8.2 Assert the resulting order per fixture in a test, so a weight change
      that reorders a fixture fails the build. Same protection decision 32's
      confidence bands have.
- [ ] 8.3 Record the measured pool size, the weights that survived, and the
      quality-per-candidate finding in `docs/product-decisions.md`.
- [ ] 8.4 Do not record a weight as settled that was never measured against
      anything.

## 9. Verification

- [ ] 9.1 Generate for a real kitchen with a real key and confirm three
      suggestions arrive from a larger pool.
- [ ] 9.2 Confirm the three shown are not three variations of one dish.
- [ ] 9.3 Confirm a kitchen with one very expensive expiring item surfaces a dish
      clearing it first.
- [ ] 9.4 Confirm a late-evening low-remaining-calorie day does not stop dishes
      appearing — decision 36 is unaffected by scoring.
- [ ] 9.5 Record a dietary rule against a cached day and confirm the displayed
      set changes with no request.
- [ ] 9.6 Run `npm run typecheck` and `npm test`.
