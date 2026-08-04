## 1. Fixtures first

The interesting failures are all matching failures, and none of them are visible
without a corpus.

- [ ] 1.1 Create `src/logic/__fixtures__/dietary.ts` with at least 12 rule sets:
      a single allergen, several allergens, a restriction alone, restriction plus
      dislikes, an unresolvable allergen, and a heavily-restricted profile with
      more than ten rules.
- [ ] 1.2 Add at least 20 suggestion fixtures whose ingredient lists exercise the
      derivative relation — a dish naming butter but not milk, one naming fish
      sauce but not fish, one naming an ingredient absent from the catalogue.
- [ ] 1.3 Include at least 4 obliquely-named ingredients — "seafood stock",
      "mixed nuts", "vegetable oil blend" — as the honest test of the unknown
      rule rather than a clean one.
- [ ] 1.4 Include Asian derivative cases specifically: oyster sauce, hoisin,
      gochujang, shrimp paste, XO sauce. Decision 4 makes these the audience, and
      they are where a Western-seeded relation fails silently.

## 2. Schema

- [ ] 2.1 Append the migration creating `dietary_rules` — id, kind, nullable
      `canonical_id`, text, normalised text, created_at — with an index on kind.
- [ ] 2.2 Create `canonical_derivatives(parent_id, child_id)` in the same
      migration, with both columns indexed and a uniqueness constraint on the
      pair.
- [ ] 2.3 Add `DietaryRule`, `DietaryRuleKind`, and `DIETARY_RULE_KINDS` to
      `src/types.ts`, following the `MEAL_VENUES` convention.
- [ ] 2.4 Extend `DROP_ALL` with both tables.
- [ ] 2.5 Verify the migration runs from the current head and `npm run typecheck`
      passes.

## 3. The derivative relation

- [ ] 3.1 Add derivative edges to `assets/canonical-items.json` for the common
      allergen families: milk, egg, wheat, soy, peanut, tree nut, fish,
      shellfish, sesame.
- [ ] 3.2 Add the Asian edges the catalogue already has canonicals for — fish
      sauce from fish, oyster sauce and shrimp paste from shellfish, hoisin and
      gochujang from soy and wheat, tahini from sesame. These are the ones a
      Western seed misses and the ones this app claims to be good at.
- [ ] 3.3 Extend the catalogue seeding path to load edges. Do not write a second
      seeding mechanism.
- [ ] 3.4 Bump the catalogue version so existing installs pick the edges up.
- [ ] 3.5 Implement the transitive closure as a recursive query in
      `src/db/queries.ts`. The graph is small; do not store a closure.
- [ ] 3.6 Test the closure to depth three, and confirm it terminates on a cycle
      rather than hanging — a bad catalogue edit should fail a test, not the app.
- [ ] 3.7 **Test the direction.** A rule against a derivative must not exclude
      its parent. Getting this backwards excludes half the catalogue and looks
      like caution.

## 4. Rule CRUD

- [ ] 4.1 Add create, list, update, and delete for rules to `src/db/queries.ts`.
- [ ] 4.2 Resolve free text through the existing `resolve()` with a `dietary`
      source. Do not add a second matching path.
- [ ] 4.3 Store `canonical_id` when resolution succeeds; retain normalised text
      either way, since it is the fallback and the provenance.
- [ ] 4.4 Accept a rule that resolves to nothing. Refusing to record an allergy
      the catalogue does not know is the worst failure available here.
- [ ] 4.5 Route a confirm-band outcome through the existing user-resolution path
      so the answer is learned as an alias.
- [ ] 4.6 Test that an unresolved rule still excludes by name.

## 5. Exclusion logic

Pure. No database, no network.

- [ ] 5.1 Implement `expandRules(rules, derivatives)` in `src/logic/dietary.ts`,
      returning the excluded canonical set plus the unresolved-text set.
- [ ] 5.2 Implement `applyDietary(suggestion, exclusionSet)`, returning a verdict
      that names *which* rule matched — a bare boolean cannot explain itself, and
      the interface has to.
- [ ] 5.3 Match a suggestion's ingredients by canonical identity where the
      suggestion carries one, per `add-dinner-decision`'s
      `meal_items.canonical_id`, and by resolution otherwise.
- [ ] 5.4 **Unknown excludes, allergens only.** An unresolved ingredient excludes
      the suggestion when any allergen rule exists, and does not otherwise. Both
      halves are deliberate — see the design.
- [ ] 5.5 Exclude on allergens and restrictions; never on dislikes.
- [ ] 5.6 Unit-test the matrix: each kind alone, allergen with unknown
      ingredient, restriction with unknown ingredient, derivative match,
      transitive derivative match, text-fallback match, and no rules at all.
- [ ] 5.7 Test that a user with no rules produces an identical suggestion set to
      one with the feature absent. No rules must mean no behaviour.

## 6. Wiring into suggestions

- [ ] 6.1 State the rules in `src/api/suggestPrompt.ts` as a constraint. It is a
      request, not the guarantee.
- [ ] 6.2 Apply `applyDietary` to every returned suggestion **after** parsing,
      before anything reaches the surface.
- [ ] 6.3 Add the dislike weight to the ranking in `src/logic/suggest.ts` as a
      named constant. A dislike loses a close contest; it does not delete a
      candidate.
- [ ] 6.4 Confirm a high value-at-risk item can still outrank a dislike. If it
      cannot, the weight is a filter wearing a different hat.
- [ ] 6.5 Apply the same exclusion in `add-macro-gap-suggestions`. One code path,
      both surfaces.
- [ ] 6.6 Test with the heavily-restricted fixture profile and record whether
      prompt length degrades suggestion quality — the local filter holds either
      way, but the answer decides whether rules need summarising.

## 7. Surfaces

- [ ] 7.1 Add rule entry to onboarding, skippable, with the allergen kind
      explained in a sentence rather than assumed.
- [ ] 7.2 Add rule management to `app/(tabs)/settings.tsx`: add, change kind,
      delete.
- [ ] 7.3 Show which rules resolved to a catalogue ingredient and which are
      matching by name only, so a user whose rule did not resolve can add
      another. Do not hide a weaker guarantee.
- [ ] 7.4 Show the derivatives a rule covers. "Milk also excludes butter, ghee,
      paneer" is the sentence that makes the feature trustworthy, and it is free
      — the closure is already computed.
- [ ] 7.5 When exclusion shortens the suggestion list, show what survived and say
      rules were applied. Never pad, never silently reinstate.
- [ ] 7.6 When nothing survives, say so and offer another attempt.
- [ ] 7.7 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.

## 8. Language

Its own section because it is a requirement, not polish, and because it is the
part most likely to be quietly reworded later by someone being helpful.

- [ ] 8.1 Audit every string this change adds. Never *safe*, *suitable*, or
      *free from*. Only what was excluded.
- [ ] 8.2 State the limit where allergens are entered: the app filters
      suggestions and cannot verify food.
- [ ] 8.3 Add a test asserting the forbidden words appear in no dietary string.
      Copy drifts; a test does not.

## 9. Logging stays untouched

- [ ] 9.1 Confirm no dietary rule blocks, alters, or warns-and-blocks a logged
      meal.
- [ ] 9.2 Confirm no dietary rule affects adding a pantry item.
- [ ] 9.3 If a note on a matching logged meal is shown, confirm it never
      obstructs saving.

## 10. Verification

- [ ] 10.1 Record a milk allergy, generate dinners with butter in stock, and
      confirm no suggestion contains butter.
- [ ] 10.2 Record a shellfish allergy, put oyster sauce in stock, and confirm the
      exclusion holds through the derivative edge.
- [ ] 10.3 Record an allergen absent from the catalogue and confirm it is
      accepted, applied by name, and shown as unresolved.
- [ ] 10.4 Record vegetarian and confirm no meat suggestion survives, including
      one reached through fish sauce.
- [ ] 10.5 Record a dislike and confirm the ingredient still appears when it is
      the thing expiring tomorrow.
- [ ] 10.6 Log a meal containing an allergen and confirm it saves unchanged.
- [ ] 10.7 With no rules recorded, confirm the app behaves exactly as before.
- [ ] 10.8 Run `npm run typecheck` and `npm test`, then record the measured
      derivative coverage and the surviving dislike weight in
      `docs/product-decisions.md`.
