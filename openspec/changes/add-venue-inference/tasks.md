## 1. Fixtures

- [ ] 1.1 Collect at least 15 meal photographs across venues: home kitchens,
      restaurant tables, takeaway containers on a home table, and a packed lunch
      at a desk. The middle two are where a naive guess fails.
- [ ] 1.2 Pair several with a pantry state, so the stock-match signal can be
      tested against a photograph rather than in isolation.
- [ ] 1.3 Record a model response per photograph so combination tests need no
      provider.

## 2. The estimator's contribution

- [ ] 2.1 Add an optional venue assessment to the schema in `src/api/prompt.ts`,
      with a short instruction on what distinguishes a restaurant setting from a
      home one.
- [ ] 2.2 Make `src/api/parse.ts` treat it as optional. A response without it is
      a valid estimate — the calorie path must not regress for a secondary field.
- [ ] 2.3 **One request.** Do not add a second call; the model is already looking
      at this photograph.
- [ ] 2.4 Measure per-venue accuracy across the fixtures and record it before
      anything downstream trusts the field.

## 3. Local signals

Pure logic. No network.

- [ ] 3.1 Compute stock match as the **ratio** of the meal's items resolving to
      canonicals currently in stock — not a boolean. A restaurant dish
      containing chicken you also own is the case a boolean gets wrong.
- [ ] 3.2 Compute outstanding portions: batches logged with a multiplier, less
      the leftovers meals since logged against that dish.
- [ ] 3.3 Add the queries these need to `src/db/queries.ts`, reading
      `consumption_events` and `meals`.
- [ ] 3.4 Unit-test both signals, including a fully-consumed batch offering
      nothing.

## 4. Combination

- [ ] 4.1 Implement `inferVenue(assessment, stockMatch, outstandingPortions)` in
      `src/logic/venue.ts`.
- [ ] 4.2 Define the stock-match threshold as a named constant.
- [ ] 4.3 **Resolve uncertainty to home.** A missed decrement breaks decision 3's
      promise and is discovered mid-cook; a phantom one is repaired by decision
      55's receipt re-anchor and softened by decision 53's drift counter. This
      default is deliberate — do not change it without changing that reasoning.
- [ ] 4.4 Unit-test the decision table exhaustively: each signal alone, each
      pair, all three agreeing, all three conflicting, and none present.

## 5. Learned defaults

- [ ] 5.1 Add a migration for per-dish venue defaults, keyed on the normalised
      dish name.
- [ ] 5.2 Record a default when the user changes the venue.
- [ ] 5.3 Rank the learned default **with** the other signals rather than above
      them, so a photograph plainly showing a home kitchen still wins.
- [ ] 5.4 Let a later correction replace an earlier one.
- [ ] 5.5 Extend `DROP_ALL`.
- [ ] 5.6 Test that a corrected dish guesses correctly next time and remains
      changeable.

## 5a. Paths where the venue is already known

Added after `add-dinner-decision` shipped. `src/logic/suggestionService.ts:218`
now hardcodes `venue: 'home'` for a cooked suggestion, which did not exist when
this change was planned.

- [ ] 5a.1 Leave that hardcoded venue exactly as it is. Running inference over a
      meal whose origin the app knows replaces certainty with a weighted opinion.
- [ ] 5a.2 Route inference only through the paths where the venue is genuinely
      unknown — a photograph and a manual entry. Do not apply it at the review
      screen indiscriminately, which is the natural and wrong implementation.
- [ ] 5a.3 **Record no learned default from a known venue.** The suggestion path
      can only ever emit `home`, so learning from it stores a value carrying no
      information and then ranks it against real evidence.
- [ ] 5a.4 Test that cooking a suggestion produces `home` with the inference
      function never called, and that the learned-defaults table is untouched
      afterwards.

## 6. Review screen

- [ ] 6.1 Replace the sticky default in `app/review.tsx:105` with the inferred
      preselection.
- [ ] 6.2 Keep the control exactly as changeable as it is now — one action, and
      the user's choice always wins.
- [ ] 6.3 Confirm no stock moves before the user has seen the selection and
      committed.
- [ ] 6.4 Clear the servings multiplier when the venue moves away from home,
      per decision 51.
- [ ] 6.5 Tokens from `src/constants/theme.ts`, no literals.

## 7. Verification

- [ ] 7.1 Log a home-cooked meal made from stock and confirm home is preselected.
- [ ] 7.2 Log a restaurant meal with a real photograph and confirm out is
      preselected.
- [ ] 7.3 Log a takeaway eaten at a home table — the hard case — and record what
      it guesses rather than asserting a result.
- [ ] 7.4 Log a four-serving batch, then the same dish again, and confirm
      leftovers is offered.
- [ ] 7.5 Log the remaining portions and confirm leftovers stops being offered.
- [ ] 7.6 Enter a meal by hand with no photograph and confirm home is
      preselected.
- [ ] 7.7 Confirm changing the venue is still a single action in every case.
- [ ] 7.8 Run `npm run typecheck` and `npm test`, then record measured accuracy
      and the surviving threshold in `docs/product-decisions.md`.
