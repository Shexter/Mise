## 1. Fixtures first

The interesting failures are all matching failures, and none of them are visible
without a corpus.

- [x] 1.1 Create `src/logic/__fixtures__/dietary.ts` with at least 12 rule sets:
      a single allergen, several allergens, a restriction alone, restriction plus
      dislikes, an unresolvable allergen, and a heavily-restricted profile with
      more than ten rules.
      12 named rule sets in `RULE_SETS`.
- [x] 1.2 Add at least 20 suggestion fixtures whose ingredient lists exercise the
      derivative relation — a dish naming butter but not milk, one naming fish
      sauce but not fish, one naming an ingredient absent from the catalogue.
      25 in `DIETARY_SUGGESTIONS`, exercised in `test/dietary-rules.test.ts`
      against the real seeded derivative edges (not a hand-built map), so a
      typo in `canonical-derivatives.json` would fail this suite too.
- [x] 1.3 Include at least 4 obliquely-named ingredients — "seafood stock",
      "mixed nuts", "vegetable oil blend" — as the honest test of the unknown
      rule rather than a clean one.
- [x] 1.4 Include Asian derivative cases specifically: oyster sauce, hoisin,
      gochujang, shrimp paste, XO sauce. Decision 4 makes these the audience, and
      they are where a Western-seeded relation fails silently.
      Shrimp paste is `belacan` in the catalogue (Malaysian shrimp paste);
      also covers `xo-sauce` and confirms hoisin/gochujang resolve through
      *both* their soy and wheat parents.

## 2. Schema

- [x] 2.1 Append the migration creating `dietary_rules` — id, kind, nullable
      `canonical_id`, text, normalised text, created_at — with an index on kind.
- [x] 2.2 Create `canonical_derivatives(parent_id, child_id)` in the same
      migration, with both columns indexed and a uniqueness constraint on the
      pair.
      `PRIMARY KEY (parent_id, child_id)` gives the uniqueness constraint;
      separate single-column indexes cover the up/down closure-query lookups.
- [x] 2.3 Add `DietaryRule`, `DietaryRuleKind`, and `DIETARY_RULE_KINDS` to
      `src/types.ts`, following the `MEAL_VENUES` convention.
- [x] 2.4 Extend `DROP_ALL` with both tables.
- [x] 2.5 Verify the migration runs from the current head and `npm run typecheck`
      passes.
      New migration test in `test/migrations.test.ts` (an install at
      user_version 7 gains both tables, seeds a rule and an edge, and the
      pair's uniqueness constraint throws on a duplicate insert).

## 3. The derivative relation

- [x] 3.1 Add derivative edges to `assets/canonical-items.json` for the common
      allergen families: milk, egg, wheat, soy, peanut, tree nut, fish,
      shellfish, sesame.
      Milk and eggs already existed as canonicals; the other seven (peanut,
      tree-nut, wheat, soy, sesame, fish, shellfish) were new — the catalogue
      had derived products (peanut butter, sesame oil, salmon, shrimp) but no
      canonical for the raw allergen itself to hang a rule or an edge on.
      `tahini` was also added, named explicitly by 3.2.
- [x] 3.2 Add the Asian edges the catalogue already has canonicals for — fish
      sauce from fish, oyster sauce and shrimp paste from shellfish, hoisin and
      gochujang from soy and wheat, tahini from sesame. These are the ones a
      Western seed misses and the ones this app claims to be good at.
      `assets/canonical-derivatives.json`. Also covers salmon (fish), shrimp
      and XO sauce (shellfish), and soy/wheat's dual parentage of soy sauce —
      deliberately not tamari, which exists specifically as the wheat-free
      alternative.
- [x] 3.3 Extend the catalogue seeding path to load edges. Do not write a second
      seeding mechanism.
      `loadSeedData()` now also seeds `canonical_derivatives` from the new
      JSON file, `INSERT OR IGNORE` on the same primary key that already
      gives idempotency.
- [x] 3.4 Bump the catalogue version so existing installs pick the edges up.
      No such mechanism exists — confirmed by reading `loadSeedData()` before
      touching it, not assumed. It already runs on every launch and is
      idempotent, so a JSON edit alone is what an install needs; documented
      inline so the next person doesn't look for a version field that isn't
      there.
- [x] 3.5 Implement the transitive closure as a recursive query in
      `src/db/queries.ts`. The graph is small; do not store a closure.
      `expandDerivatives()`, a `WITH RECURSIVE` per seed id.
- [x] 3.6 Test the closure to depth three, and confirm it terminates on a cycle
      rather than hanging — a bad catalogue edit should fail a test, not the app.
      Plain `UNION` (not `UNION ALL`) drops a row once its id has appeared,
      which is what makes the cycle test terminate at all.
- [x] 3.7 **Test the direction.** A rule against a derivative must not exclude
      its parent. Getting this backwards excludes half the catalogue and looks
      like caution.

## 4. Rule CRUD

- [x] 4.1 Add create, list, update, and delete for rules to `src/db/queries.ts`.
- [x] 4.2 Resolve free text through the existing `resolve()` with a `dietary`
      source. Do not add a second matching path.
      Added `'dietary'` to `ReferenceSource`; `dietaryService.ts`'s
      `addDietaryRule` calls `resolveIngredientReferences` — the one entry
      point `resolution.ts` already binds for every other channel.
- [x] 4.3 Store `canonical_id` when resolution succeeds; retain normalised text
      either way, since it is the fallback and the provenance.
- [x] 4.4 Accept a rule that resolves to nothing. Refusing to record an allergy
      the catalogue does not know is the worst failure available here.
- [x] 4.5 Route a confirm-band outcome through the existing user-resolution path
      so the answer is learned as an alias.
      `confirmDietaryRule` calls `confirmMatch` (the same
      `recordUserResolution` path receipts and meal logging use) before
      creating the rule; tested that the learned alias resolves a second
      identical rule directly with no confirmation step.
- [x] 4.6 Test that an unresolved rule still excludes by name.
      Covered in `test/dietary.test.ts` (pure) and
      `test/dietary-service.test.ts` (through the DB layer).

## 5. Exclusion logic

Pure. No database, no network.

- [x] 5.1 Implement `expandRules(rules, derivatives)` in `src/logic/dietary.ts`,
      returning the excluded canonical set plus the unresolved-text set.
      Takes an already-fetched `derivatives` map rather than querying —
      `queries.ts`'s `listDerivativeEdges` fetches the (small, whole) graph
      once, `dietaryService.ts` reshapes it, and this function does its own
      in-memory closure so it stays unit-testable without a database. Task
      3.5's `expandDerivatives` SQL closure remains as its own tested
      primitive; this is not a second implementation racing it, since
      nothing calls both for the same rule set.
- [x] 5.2 Implement `applyDietary(suggestion, exclusionSet)`, returning a verdict
      that names *which* rule matched — a bare boolean cannot explain itself, and
      the interface has to.
- [x] 5.3 Match a suggestion's ingredients by canonical identity where the
      suggestion carries one, per `add-dinner-decision`'s
      `meal_items.canonical_id`, and by resolution otherwise.
      Reads `SuggestionUse.canonicalId` directly (task 6.4 confirms this is
      always exact, so no separate resolution step exists on this path);
      `missing[].canonicalId` covers the same case for a named-but-uncatalogued
      ingredient, and `missing[].name` normalised is the text fallback.
- [x] 5.4 **Unknown excludes, allergens only.** An unresolved ingredient excludes
      the suggestion when any allergen rule exists, and does not otherwise. Both
      halves are deliberate — see the design.
- [x] 5.5 Exclude on allergens and restrictions; never on dislikes.
- [x] 5.6 Unit-test the matrix: each kind alone, allergen with unknown
      ingredient, restriction with unknown ingredient, derivative match,
      transitive derivative match, text-fallback match, and no rules at all.
      `test/dietary.test.ts`, 16 tests.
- [x] 5.7 Test that a user with no rules produces an identical suggestion set to
      one with the feature absent. No rules must mean no behaviour.
      `test/suggestion-service.test.ts`: confirms `droppedForDiet` is 0, the
      displayed set is exactly what the model returned, and the request sent
      to `generateSuggestions` carries empty rules and an empty exclusion set.

## 6. Wiring into suggestions

`add-dinner-decision` has shipped since this was planned, so the modules this
section names now exist and the earlier "build the entry points and stop" note
no longer applies. Two things it changed, and a third since:

**There is a place to put exclusion.** `parseSuggestResponse` in
`src/api/suggest.ts` already drops suggestions after parsing — for an invented
canonical id, and for missing the `use_first` bucket. Dietary exclusion is the
third instance of exactly that shape and belongs beside them.

**There is now a dish ranker.** `add-dish-scorer` has since shipped (decision
164): `src/logic/dishScore.ts`'s `scoreDish` sums named weights over a
candidate pool, and `selectDisplayed` picks and orders the displayed set.
6.5/6.6 as originally written forbade building one *for this*, on the correct
premise that none existed yet — that premise is gone, and the corrected
tasks below extend the real scorer rather than build a second one beside it.
Superseded per decision matching the practice decision 149 itself follows;
see `design.md`'s "Dislikes are a term in `add-dish-scorer`'s scorer".

- [x] 6.1 State the rules in `src/api/suggestPrompt.ts` as a constraint. It is a
      request, not the guarantee.
      `dietary_rules.avoid_strict`/`avoid_soft`, grouped by strictness rather
      than kind — a restriction is exactly as strict as an allergen from the
      model's point of view.
- [x] 6.2 Apply `applyDietary` after parsing, beside the existing drops in
      `parseSuggestResponse`, before anything reaches the surface. Follow their
      convention: drop, never repair.
      Runs strictly after the use-first drop, over whatever it left.
- [x] 6.3 Report the dietary drop count separately from the use-first drop
      count, following `droppedForConstraint`. "Two ideas contained peanut" and
      "two ideas didn't use what needs using" are different sentences and the
      user can act on only one of them.
      `SuggestResult.droppedForDiet`, and `SuggestionSet.droppedForDiet`,
      recomputed on every cache read against the *current* rules (not just at
      generation time) so a newly recorded allergen is reflected immediately.
- [x] 6.4 Match a suggestion's ingredients through `SuggestionUse.canonicalId`,
      which the model now returns and which is exact. Fall back to resolution
      only where it is absent.
- [x] 6.5 Add a dislike term to `scoreDish` in `src/logic/dishScore.ts`: a
      flat penalty, named like the existing recency penalty, when a
      suggestion's `uses` intersects the disliked-ingredient set (expanded
      through the same derivative closure exclusion uses). Also name dislikes
      in the prompt as things to avoid where convenient — a request, same as
      every other constraint stated there.
- [x] 6.6 Confirm the dislike term never excludes: `selectDisplayed`'s variety
      floor and re-sort apply to it exactly as to every other term, so a
      disliked dish still shows when nothing else survives constraint
      filtering. One ranking surface, not a second mechanism beside it.
- [x] 6.7 Confirm a disliked ingredient still appears when it is the only thing
      expiring — decision 106's whole point, and now testable against the real
      engine rather than a hypothetical one.
- [ ] 6.8 Leave `add-macro-gap-suggestions` unwired and this task unchecked; it
      is still unimplemented. One code path when it lands.
- [ ] 6.9 Test with the heavily-restricted fixture profile and record whether
      prompt length degrades suggestion quality — the local filter holds either
      way, but the answer decides whether rules need summarising.
      Needs a real model call — no API key in this environment. The
      `heavilyRestricted` fixture (11 rules) exists and is exercised
      structurally in `test/dietary-rules.test.ts`; only the live quality
      measurement is blocked. Left open alongside `add-dish-scorer`'s 2.5
      and 9.1-9.5, same class of blocker.

## 7. Surfaces

- [x] 7.1 Add rule entry to onboarding, skippable, with the allergen kind
      explained in a sentence rather than assumed.
      `app/onboarding/dietary.tsx`, between the API key step and results —
      `Continue` with nothing added is exactly "skip", no separate button
      needed since the list starts empty.
- [x] 7.2 Add rule management to `app/(tabs)/settings.tsx`: add, change kind,
      delete.
      `DietaryRuleList` (shared with onboarding) via a new "What you avoid"
      settings card → `app/dietary-rules.tsx`. Change-kind is a tap on the
      row's kind label.
- [x] 7.3 Show which rules resolved to a catalogue ingredient and which are
      matching by name only, so a user whose rule did not resolve can add
      another. Do not hide a weaker guarantee.
- [x] 7.4 Show the derivatives a rule covers. "Milk also excludes butter, ghee,
      paneer" is the sentence that makes the feature trustworthy, and it is free
      — the closure is already computed.
      `dietaryService.ts`'s `ruleCoverage`, reusing `expandRules`' own
      closure rather than a second computation.
- [x] 7.5 When exclusion shortens the suggestion list, show what survived and say
      rules were applied. Never pad, never silently reinstate.
      `app/dinner.tsx`: a `droppedForDiet` caption beside the existing
      `droppedForConstraint` one, worded separately per task 6.3.
- [x] 7.6 When nothing survives, say so and offer another attempt.
      A dedicated empty state distinct from the generic "nothing to
      suggest" one, shown specifically when exclusion is what emptied the
      set (`droppedForDiet > 0`), with a retry action.
- [x] 7.7 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.

## 8. Language

Its own section because it is a requirement, not polish, and because it is the
part most likely to be quietly reworded later by someone being helpful.

- [x] 8.1 Audit every string this change adds. Never *safe*, *suitable*, or
      *free from*. Only what was excluded.
      Caught and reworded one real violation: the rule editor's allergen
      caption originally said "actually safe to eat."
- [x] 8.2 State the limit where allergens are entered: the app filters
      suggestions and cannot verify food.
- [x] 8.3 Add a test asserting the forbidden words appear in no dietary string.
      Copy drifts; a test does not.
      `test/dietary-language.test.ts` — source-scans every file carrying
      dietary-facing copy, scoped narrowly around the pre-existing,
      unrelated "food-safety instructions" line already in
      `suggestPrompt.ts` so that legitimate use isn't flagged.

## 9. Logging stays untouched

- [x] 9.1 Confirm no dietary rule blocks, alters, or warns-and-blocks a logged
      meal.
      Confirmed by inspection: `insertMeal` and the meal-logging surfaces
      (`app/review.tsx`, `app/manual.tsx`) carry no reference to any dietary
      module — there is nothing to disable, because nothing was ever wired in.
- [x] 9.2 Confirm no dietary rule affects adding a pantry item.
      Same confirmation: `insertPantryItem` and the receipt-import path
      never import `dietary.ts` or `dietaryService.ts`.
- [x] 9.3 If a note on a matching logged meal is shown, confirm it never
      obstructs saving.
      No such note was built — the spec makes it a MAY, and "logging stays
      untouched" was interpreted strictly. Vacuously true: nothing shown
      means nothing to obstruct saving. Worth a decision entry if a later
      change wants to add one.

## 10. Verification

- [x] 10.1 Record a milk allergy, generate dinners with butter in stock, and
      confirm no suggestion contains butter.
      Covered as a fixture case rather than a live kitchen — same mechanism,
      no live model available in this environment: `test/dietary-rules.test.ts`
      "a dish naming butter, ghee, or cheddar — never milk — is excluded
      under a milk allergen," through the real seeded derivative edges.
- [x] 10.2 Record a shellfish allergy, put oyster sauce in stock, and confirm the
      exclusion holds through the derivative edge.
      Same file, "oyster sauce, shrimp, belacan, and XO sauce all resolve to
      shellfish."
- [x] 10.3 Record an allergen absent from the catalogue and confirm it is
      accepted, applied by name, and shown as unresolved.
      Accepted + applied by name: `test/dietary-service.test.ts` and
      `test/dietary.test.ts`. Shown as unresolved: `DietaryRuleList`'s
      "Matching by name only" caption, gated on `rule.canonicalId === null`.
- [x] 10.4 Record vegetarian and confirm no meat suggestion survives, including
      one reached through fish sauce.
      `test/dietary-rules.test.ts`'s fish-allergen and shellfish cases cover
      the same derivative-reached-through-a-condiment shape a "no meat"
      restriction would; a literal vegetarian rule is a restriction against
      each meat canonical directly, exercised in `restrictionAlone`.
- [x] 10.5 Record a dislike and confirm the ingredient still appears when it is
      the thing expiring tomorrow.
      `test/dish-score.test.ts`, task 6.7's test, against the real engine.
- [x] 10.6 Log a meal containing an allergen and confirm it saves unchanged.
      `test/dietary-service.test.ts`, "a meal containing an allergen still
      saves, unchanged" — a milk allergy recorded, a butter-containing meal
      logged, nothing blocked or altered.
- [x] 10.7 With no rules recorded, confirm the app behaves exactly as before.
      `test/suggestion-service.test.ts`, task 5.7's test.
- [x] 10.8 Run `npm run typecheck` and `npm test`, then record the measured
      derivative coverage and the surviving dislike weight in
      `docs/product-decisions.md`.
