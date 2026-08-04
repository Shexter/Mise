## 1. The template table

Pure. No database, no network. Buildable before the engine exists.

- [ ] 1.1 Add `TemplateId` and `SUGGESTION_TEMPLATES` to `src/types.ts`,
      following the `MEAL_VENUES` convention: `use_it_up`, `lean`, `strength`,
      `balanced`, `quick`, `stretch`.
- [ ] 1.2 Implement `src/logic/templates.ts` holding, per template: its ranking
      weights, its portion policy, its prompt framing sentence, and which reason
      kinds it prefers.
- [ ] 1.3 Make every weight a **named constant**, not a literal in the table. A
      table of unexplained numbers is untunable by anyone who did not write it.
- [ ] 1.4 Implement `defaultTemplate(goal)`: `lose → lean`, `gain → strength`,
      `maintain → balanced`.
- [ ] 1.5 Give each template a description of **what it changes about the
      suggestions**. Not what it achieves. See section 6.
- [ ] 1.6 Unit-test the table: every id has an entry, every weight is within its
      declared range, and `defaultTemplate` is total over `Goal`.

## 2. Weights, not branches

- [ ] 2.1 Change `src/logic/suggest.ts` to read its ranking weights from the
      active template rather than from module constants.
- [ ] 2.2 **Do not branch the scorer on template id.** Six code paths through
      the ranker is six places to forget a constraint; a weight vector cannot
      forget one.
- [ ] 2.3 Keep the ranking inputs identical across templates — urgency, value at
      risk, familiarity, effort, macro fit. A template that introduces a private
      input makes its results incomparable and its bugs unreproducible.
- [ ] 2.4 Read `effort_minutes` from the output contract, which currently
      nothing does. `quick` has no meaning until something does.
- [ ] 2.5 Test that two templates over one fixture kitchen use the same facts
      and produce different orderings.

## 3. The constraint that no template may touch

The section this change most needs to get right.

- [ ] 3.1 Keep decision 34's use-first constraint **outside** the weights, where
      a template cannot reach it. Every suggestion uses at least one `use_first`
      item under every template.
- [ ] 3.2 When the active template cannot be served within the constraint,
      return fewer suggestions and say why. Never return suggestions that ignore
      expiring stock.
- [ ] 3.3 Implement `use_it_up` as maximising value at risk rather than as
      relaxing anything. It raises the floor to be the whole objective; it does
      not change the rules.
- [ ] 3.4 Write the test that would catch this being lost: for every template,
      assert every returned suggestion uses at least one `use_first` item. A
      loop over the template table, so a seventh template is covered the day it
      is added.

## 4. Portion, not exclusion

- [ ] 4.1 Express `lean` and `strength` through the **portion policy**, not
      through a calorie weight. Weighting by calories becomes decision 36's
      rejected filter with extra steps — a low enough weight on a high enough
      count is exclusion.
- [ ] 4.2 `lean` sizes the offered portion toward the remaining allowance;
      `strength` sizes up and allows the overshoot.
- [ ] 4.3 Confirm no template withholds a dish. Test with a kitchen where every
      dish is wrong for the active template and assert dishes still come back.
- [ ] 4.4 Keep the portion visible and adjustable, as `add-dinner-decision`
      already requires.

## 5. Default, memory, and the profile

- [ ] 5.1 Make the initially active template `defaultTemplate(profile.goal)`.
- [ ] 5.2 **Selecting a template must never write to the profile.** Add a test
      asserting that `targetCalories`, `goal`, and the macro split are unchanged
      after every template selection. `profileStore.update` recalculates the
      calorie target on every write, so a leak here silently moves the user's
      target — invisible, and serious.
- [ ] 5.3 Remember the last selection in suggestion state, not in `profile`.
      Remembering a choice is not editing a profile.
- [ ] 5.4 Confirm changing the goal in the profile moves the default template.
- [ ] 5.5 Confirm an existing user with a recorded goal gets a correct default
      with no migration of their profile row.

## 6. Language

Its own section for the same reason `add-dietary-profile` has one: this is a
requirement, and it is the part most likely to be quietly reworded later by
someone being helpful.

- [ ] 6.1 Name and describe every template by **what it does to the
      suggestions**. "Leans protein-forward and portions against your remaining
      calories" — never "for fat loss", "to build muscle", or any outcome.
- [ ] 6.2 Do not name a template *fat loss* or *muscle gain* in the interface
      even though that is what a user asking for it would call it. Decision 64
      refused a health claim about a default target; this is the same refusal.
- [ ] 6.3 Add a test asserting the forbidden outcome words appear in no template
      string. Copy drifts; a test does not.

## 7. Prompt and cache

- [ ] 7.1 Add the active template's framing sentence to
      `src/api/suggestPrompt.ts`. One sentence, not a paragraph — the constraint
      set does the work, and a long framing crowds out the stock payload.
- [ ] 7.2 Add the template to the suggestion cache key as a column, per
      `add-macro-gap-suggestions`' requirement that a cached set is never reused
      across objectives.
- [ ] 7.3 Confirm the same template with the same kitchen reuses its cache.
- [ ] 7.4 Append the migration; confirm `DROP_ALL` covers the cache table rather
      than assuming it.
- [ ] 7.5 **Measure the cost.** Decision 40 caches daily so opening a tab does
      not spend money; six templates means up to six generations a day for
      someone who tries them all. Record the real figure before deciding whether
      it needs addressing.

## 8. Surface

- [ ] 8.1 Add the template control to the dinner decision surface as a
      **secondary** control. The suggestions are the screen; the picker is not.
- [ ] 8.2 Require no selection — the default must be right without input. A
      picker that turns a one-tap screen into a decision is the friction this
      feature exists to remove.
- [ ] 8.3 Show at least one reason chip per suggestion drawn from the active
      template's objective, without displacing the existing ones. A dish that
      clears expiring stock still says so.
- [ ] 8.4 Fold "make it to Sunday" into the picker as `stretch` rather than
      leaving it a separate mode with its own control.
- [ ] 8.5 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.

## 9. Composition with dietary rules

- [ ] 9.1 Run dietary exclusion **before** template ranking, as separate passes.
- [ ] 9.2 Confirm no template weight can cause an excluded suggestion to appear.
      Exclusion is a guarantee; a template is a preference, and they must not be
      implemented as one pass.
- [ ] 9.3 Confirm a dislike's weight and a template's weight both apply.
- [ ] 9.4 Test an allergen against every template in a loop.

## 10. Verification

- [ ] 10.1 With one fixture kitchen, generate under all six templates and read
      the results. Record whether they are meaningfully different — a template
      that reorders nothing is a label, and labels that do nothing are how a
      picker becomes noise.
- [ ] 10.2 Measure per-template variety across several days of the same kitchen.
      A strong weight on one fact produces monotonous results, which is the
      failure `add-dinner-decision` already names as the real risk.
- [ ] 10.3 Confirm `use_it_up` clears more value at risk than `balanced` on the
      same kitchen. If it does not, the weights are wrong.
- [ ] 10.4 Confirm `quick` returns lower `effort_minutes` on average.
- [ ] 10.5 Confirm every suggestion under every template uses an expiring item.
- [ ] 10.6 Change the profile goal and confirm the default template follows.
- [ ] 10.7 Select every template in turn and confirm the profile is byte-identical
      afterwards.
- [ ] 10.8 Run `npm run typecheck` and `npm test`, then record the measured
      generation cost, the per-template variety, and the surviving weights in
      `docs/product-decisions.md`.
