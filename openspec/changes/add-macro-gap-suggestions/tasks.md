## 1. Existing-engine seam

- [x] 1.1 Extend the shipped suggestion request context with a macro-gap mode
      and targeted macro while preserving `tonight` and `stretch` callers.
- [x] 1.2 Isolate every macro-gap request in the suggestion cache. Append a
      forward-only migration if the current mode-based cache key cannot carry
      the target macro without collisions.
- [x] 1.3 Regression-test cache reads, dietary filtering, candidate validation,
      dish scoring, and cook-this behaviour for existing tonight/stretch modes.

## 2. Measurable pantry contribution

- [x] 2.1 Define protein, carbohydrate, and fat gap targets from the shipped
      daily-target and consumed-meal calculation; defer fibre to fibre tracking.
- [x] 2.2 Implement local candidate eligibility and contribution calculation
      from nullable per-100 g catalogue nutrition and defensible quantities.
- [x] 2.3 Return an explicit insufficient-data outcome when no owned stock has
      known nutrition for the requested macro; never coerce missing data to zero.
- [x] 2.4 Implement macro-first ranking with expiry only as a tiebreak among
      comparable known contributors, plus the best measurable contribution.

## 3. Fixtures and prompt

- [x] 3.1 Add offline fixtures for late large and small gaps, mealtime gaps,
      unclosable gaps, expiring non-contributors, and unknown-nutrition stock.
- [ ] 3.2 Record provider responses for the fixture cases so shape assertions
      run without a key or network.
- [x] 3.3 Add a macro-gap prompt block containing the target, shortfall, clock,
      meal type, known contribution, and partial-coverage qualification.
- [x] 3.4 Preserve canonical-id candidate validation and the no-health-claims
      rule for macro-gap parsing and presentation.
- [x] 3.5 Extend the same suggestion response contract with optional whole-dish
      estimated macros and explicit estimate provenance; record fixture responses.

## 4. Pull-only surface

- [x] 4.1 Make below-target protein, carbohydrate, and fat bars pressable with
      accessible labels naming the macro and shortfall.
- [x] 4.2 Route a press to the existing suggestion review surface with the
      macro-gap request; a met target has no action.
- [x] 4.3 State insufficient data, an unclosable measurable gap, and a partial
      measurable contribution plainly; add no prompt, notification, or badge.
- [x] 4.4 Use theme tokens and canonical display names throughout.

## 5. Logging and verification

- [x] 5.1 Reuse the shipped cook-this path so accepted suggestions create meals
      with canonical identities and debit stock by identity.
- [x] 5.2 Calculate known recipe macros locally at acceptance, use the initial
      response's labelled whole-dish estimate only for an unresolved remainder,
      and make no second provider request. Append a forward-only nullable-meal
      nutrition migration; propagate unknown nutrients through totals, editing,
      Today display, and macro-gap eligibility without coercing them to zero.
- [x] 5.3 Test all fixture outcomes, cache isolation, expiry tiebreaks, and the
      absence of push affordances; run `npm run typecheck` and `npm test`.
- [ ] 5.4 Record answer-quality observations and partial-coverage limitations in
      `docs/product-decisions.md` after real-provider review.
