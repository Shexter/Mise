## 1. Fixtures first

The failure mode here is boredom, not exceptions. Nothing that only checks for
crashes will catch it, so the corpus comes before the feature.

- [x] 1.1 Create `src/logic/__fixtures__/kitchens.ts` with at least 6 whole
      kitchen states: a well-stocked Asian pantry, a nearly-empty fridge, one
      with a costly protein expiring tomorrow, one with nothing urgent, one with
      only staples and seasonings, one with a freezable item expiring beside a
      non-freezable one.
- [x] 1.2 Pair each with a meal history — cuisine lean, repeat dishes, and
      something eaten yesterday that must not be suggested again.
- [x] 1.3 Record a model response per kitchen, so shape assertions run without a
      provider in the loop.

## 2. Schema

- [x] 2.1 Append a migration adding nullable `meal_items.canonical_id`
      referencing `canonical_items`. Nullable is load-bearing: null means
      "resolve by name", which is today's behaviour, so no backfill.
- [x] 2.2 Add the suggestion cache table, holding the generated set, its date,
      and a fingerprint of the inputs that would change the answer.
- [x] 2.3 Extend `DROP_ALL` with the cache table.
- [x] 2.4 Add `Suggestion`, `SuggestionSet`, and `UrgencyBucket` to
      `src/types.ts` with their `readonly` value arrays.
- [x] 2.5 Verify the migration runs from the current head and `npm run typecheck`
      passes.

## 3. Urgency and bucketing

Pure logic. No database, no network.

- [x] 3.1 Implement `urgency(item, canonical)` in `src/logic/suggest.ts` from
      days remaining, `price_cents`, and freezability via `isFreezable`.
- [x] 3.2 Discount freezable items — freezing rescues them without cooking, so
      they are genuinely less pressing (decision 20).
- [x] 3.3 Weight by value at risk, so a costly item outranks a cheap one
      expiring the same day (decision 35).
- [x] 3.4 Bucket stock into `use_first`, `use_soon`, and `available`.
- [x] 3.5 Unit-test against the fixture kitchens, including the equal-date
      different-value case and the freezable-versus-not case.

## 4. History and personalisation

- [x] 4.1 Add `getRecentMeals(days)` to `src/db/queries.ts`. Nothing reads a
      window today — `getMealsForDate` and `getLoggedDates` are all that exist.
- [x] 4.2 Implement a pure summariser producing cuisine lean, frequent dishes,
      and a recently-eaten list.
- [x] 4.3 Pass summaries in the payload, never the raw history. It is cheaper,
      and the user's full eating record then never leaves the device.
- [x] 4.4 Unit-test the summariser against the fixture histories.

## 5. Payload and prompt

- [x] 5.1 Read stock through a dedicated query carrying `qtyRemaining` and
      `priceCents` — **not** through `PantryEntry`, which omits both by design.
      Decision 15 constrains display, not computation.
- [x] 5.2 Compress staples and seasonings to a summary line; send urgent stock,
      proteins, and produce in full.
- [x] 5.3 Write `src/api/suggestPrompt.ts` following `src/api/prompt.ts`: raw
      JSON only, explicit schema, ingredients identified by canonical id.
- [x] 5.4 State the use-first constraint as a rule in the prompt, not as an
      ordering. Sorting hopes for the behaviour; a rule produces it.
- [x] 5.5 Include remaining calories and the macro gap as context, with an
      explicit instruction not to exclude dishes for exceeding them.
- [x] 5.6 Instruct against food-safety guidance, per decision 64.
- [x] 5.7 Implement `src/api/suggest.ts` through the existing provider facade and
      `src/api/errors.ts`, following `src/api/resolve.ts`.
- [x] 5.7a Take the objective as a parameter from the outset — `dinner` and
      `stretch` here, with `macro_gap` following in
      `add-macro-gap-suggestions`. Retrofitting one into a single-purpose engine
      means unpicking its signature, and the identity layer's ownership-bias
      seam is the precedent: ship the mechanism, let the later change fill it.
      Already satisfied: `SuggestionMode` (`'tonight' | 'stretch'`) is threaded
      through `suggestPrompt.ts`, `suggest.ts`, and `suggestionService.ts` as a
      parameter, not hardcoded — added retroactively to this file by later
      planning; no code change was needed.
- [x] 5.8 Reject canonical ids not present in the candidate list at parse time,
      as `resolve.ts` already does for invented ids.

## 6. Caching

- [x] 6.1 Compute an input fingerprint over urgent stock, remaining calories, and
      recently eaten.
- [x] 6.2 Reuse a cached set when the fingerprint matches; regenerate when it
      does not.
- [x] 6.3 Make explicit refresh the only on-demand path that spends a call.
- [x] 6.4 Confirm reopening the surface with nothing changed makes no request.

## 7. Cooking a suggestion

The point of the change (decision 61). This is the path that produces better
depletion data than a photograph can.

- [x] 7.1 Build "I cooked this": turn the suggestion into `meal_items` carrying
      the suggestion's amounts **and** its canonical ids.
- [x] 7.2 Ask how many servings it made, defaulting to the suggestion's own
      figure, feeding decision 10's multiplier.
- [x] 7.3 Commit through the existing meal flow. Do not add a parallel path —
      depletion, totals, reversal, and editing already work on meals.
- [x] 7.4 Extend `planDepletion` to prefer a carried `canonicalId` over name
      resolution, keeping name resolution for items without one.
- [x] 7.5 Test that a cooked suggestion debits a seasoning by identity, and that
      a photographed meal still resolves by name.
- [x] 7.6 Test that an item whose name is ambiguous but whose canonical is
      carried debits the carried ingredient.
- [x] 7.7 Confirm photographing the finished dish overrides the suggestion's
      figures.

## 8. Surface

- [x] 8.1 Build the suggestion surface: three dishes, each with calories, reason
      chips, effort, and what it uses. Components from `src/components`, tokens
      from `src/constants/theme.ts`, no literals.
- [x] 8.2 Show missing ingredients as missing rather than hiding the suggestion.
- [x] 8.3 Show fit against remaining calories, offering a smaller portion where a
      dish overshoots rather than withholding it.
- [x] 8.4 Frame method as an idea, never as a tested recipe.
- [x] 8.5 Handle no-key and offline plainly, leaving pantry and calorie features
      working, and keep cached suggestions readable offline.
- [x] 8.6 Show canonical display names throughout.

## 9. Make it to Sunday

- [x] 9.1 Add the stretch mode: N dinners from current stock requiring no
      shopping, reusing overlapping ingredients.
- [x] 9.2 State the shortfall honestly where stock does not reach the chosen day.
      Padding the plan with uncookable dishes is the failure to avoid.
- [x] 9.3 Reuse the same payload and engine; only the objective differs.

## 10. Verification

- [x] 10.1 Shape-assert across the fixture kitchens using the recorded responses:
      every suggestion uses an urgent item where one exists, none repeats a
      recently-eaten dish, and the set mixes familiar with unfamiliar.
- [x] 10.2 Confirm the nothing-urgent kitchen still produces suggestions.
- [ ] 10.3 Cook a suggestion end to end with a real key and confirm the seasoning
      it named is debited.
- [x] 10.4 Confirm a four-serving batch debits four servings' worth, and a
      leftover portion afterwards debits nothing.
- [x] 10.5 Confirm no rendered surface shows a computed quantity or an estimated
      remaining mass. A price paid is allowed; an estimated gram figure is not.
- [x] 10.6 Run `npm run typecheck` and `npm test`, then record suggestion quality
      observations and the history window that survived in
      `docs/product-decisions.md`.

## 11. The use-first constraint is not yet enforced locally

Found in review after group 10 landed. `src/api/suggestPrompt.ts:19` states the
constraint to the model as a hard requirement, and nothing downstream checks
that the model obeyed it. `parseSuggestions` in `src/api/suggest.ts` validates
that every `uses` entry cites a known candidate and drops a suggestion left with
no valid uses — good hygiene, and not this. The spec says *every suggestion it
offers SHALL use at least one ingredient from the most urgent group whenever
that group is non-empty*, which is a promise about what the app shows, not about
what it asked for.

This is the same shape as decision 103, argued there for allergens: the prompt
is a request and the local check is the guarantee. It matters more here than it
looks, because decision 34 is what separates this feature from a recipe chatbot,
and a silent drift into "mostly uses expiring stock" is invisible — the
suggestions still look plausible.

- [ ] 11.1 After parsing, drop any suggestion whose `uses` intersect the
      `use_first` bucket emptily, whenever that bucket is non-empty.
- [ ] 11.2 Do not repair a dropped suggestion by substituting an ingredient.
      Returning fewer is honest; rewriting the model's dish is not.
- [ ] 11.3 When dropping leaves fewer than the surface expects, say the
      constraint was applied rather than silently showing two.
- [ ] 11.4 Leave the prompt sentence in place. Asking and checking are both
      worth doing — the ask is what makes the check rarely fire.
- [ ] 11.5 Test with a stubbed response that ignores the constraint, and assert
      the offending suggestions do not reach the caller. This is the test that
      would have caught it.
- [ ] 11.6 Record the observed compliance rate — how often a real model returns
      a suggestion the check has to drop. If it is near zero the check is cheap
      insurance; if it is not, decision 34 needs a louder prompt as well.
