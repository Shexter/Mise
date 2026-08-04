## 1. The engine seam

Do this inside `add-dinner-decision` if it has not landed. Retrofitting a
parameter into a single-purpose engine means unpicking its signature.

- [ ] 1.1 Give the engine an `objective` of `dinner | stretch | macro_gap`,
      selecting a ranking function and an instruction block. Payload shaping,
      model call, parsing, and caching stay shared.
- [ ] 1.2 Include the objective in the cache fingerprint, so a dinner set is
      never served to a macro-gap request.
- [ ] 1.3 Test that two objectives against the same kitchen produce different
      results and do not share a cache entry.

## 2. Fixtures

- [ ] 2.1 Extend the kitchen fixtures with gap scenarios: a large protein gap
      late at night, a small one at a mealtime, a gap the kitchen cannot close,
      and a kitchen whose only expiring item does not supply the targeted macro.
- [ ] 2.2 Record a model response per scenario so shape assertions run without a
      provider.

## 3. Gap ranking

Pure logic. No database, no network.

- [ ] 3.1 Implement `gapScore(item, canonical, macro)` ranking by contribution
      to the targeted macro.
- [ ] 3.2 Use approaching expiry only to separate comparable contributors.
      **Expiry must not override contribution** — an expiring ingredient that
      does not supply the macro is not an answer, and this inversion from the
      dinner objective is the point of having two.
- [ ] 3.3 Compute the best achievable contribution from stock, so an unclosable
      gap is known before the model is asked.
- [ ] 3.4 Unit-test all four fixture scenarios, especially that the expiring
      non-contributor does not rank first.

## 4. Scale and prompt

- [ ] 4.1 Put the shortfall, the hour, and `mealTypeForTime`'s answer in the
      payload.
- [ ] 4.2 Add the macro-gap instruction block: close the stated gap, size the
      answer to the shortfall and the hour, use only stock.
- [ ] 4.3 Instruct that a partial answer must state its contribution rather than
      implying the gap is met.
- [ ] 4.4 Keep decision 64's rule — no health claims, no advice about how much
      of a macro anyone should eat.
- [ ] 4.5 Reject canonical ids outside the candidate list at parse time, as the
      other objectives already do.

## 5. Surface

- [ ] 5.1 Make the bars in `src/components/MacroBars.tsx` pressable, with an
      accessible label naming the macro and its shortfall.
- [ ] 5.2 Route a press to the suggestion surface with that macro as objective.
- [ ] 5.3 Do nothing when the macro is at or above target.
- [ ] 5.4 State an unclosable gap plainly, and state the contribution of a
      partial answer.
- [ ] 5.5 Add no prompt, notification, or badge. Pull-only is a rule, not a
      default.
- [ ] 5.6 Tokens from `src/constants/theme.ts`, no literals; canonical display
      names throughout.

## 6. Logging what was eaten

- [ ] 6.1 Reuse the cook-this path from `add-dinner-decision` — the suggestion's
      ingredients become meal items carrying canonical ids.
- [ ] 6.2 Confirm the targeted macro's figure for the day moves after logging.
- [ ] 6.3 Confirm stock is debited by identity, not by name.

## 7. Verification

- [ ] 7.1 Shape-assert the fixtures: a late small gap yields a small item, not a
      slab of protein; a mealtime gap may yield a meal.
- [ ] 7.2 Confirm the unclosable-gap kitchen reports that plainly rather than
      offering a fifth of an answer framed as a solution.
- [ ] 7.3 Confirm the expiring non-contributor kitchen ranks contribution first.
- [ ] 7.4 Confirm no prompt, notification, or badge appears for a shortfall.
- [ ] 7.5 Confirm a met target offers nothing.
- [ ] 7.6 Run `npm run typecheck` and `npm test`, then record observations on
      answer quality in `docs/product-decisions.md`.
