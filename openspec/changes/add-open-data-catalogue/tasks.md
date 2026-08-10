## 1. Find out whether this is worth doing

Ordered first because it can end the change. Sixty-nine hand-authored entries
against 500+ US supermarket product names is not obviously a good match, and the
whole value depends on the hit rate.

Measured 2026-08-06. The catalogue grew to 77 entries (8 allergen-class
markers — `peanut`, `tree-nut`, `wheat`, `soy`, `sesame`, `fish`, `shellfish`,
`tahini` — landed with `add-dietary-profile`) between when this task was
written and when it was run; the 69 vs. 77 figures below are not a
discrepancy, just two different points in the catalogue's history.

- [x] 1.1 Download the FoodKeeper dataset and record its real shape: row count,
      which fields are actually populated, and how the metric values are spelled.
      Work from the file, not from the documentation.
      The live `foodsafety.gov`/`fsis.usda.gov` hosts 403 every fetch — Akamai,
      confirmed with both a direct request and an independent fetch path, not
      an artifact of one tool. Recovered a July 2025 Wayback Machine snapshot
      of the real live export instead
      (`web.archive.org/web/20250702182320/https://www.fsis.usda.gov/shared/data/EN/foodkeeper.json`,
      `FMA-Data-v128.xlsx` per its own `fileName` field) — 13 months old, not
      current-today, but the authoritative file, not a third-party rebuild.
      **661 products.** Every row has at least one populated `*_Metric`
      field (none are metric-less). Population is sparse and uneven per
      field: `Name` 100%, `Keywords` 100%, `Name_subtitle` 60%,
      `DOP_Refrigerate_Min/Max/Metric` 36%, `Freeze_Metric`/`DOP_Pantry_Metric`/
      `DOP_Freeze_Metric` 30% each, `Pantry_Metric` 20%, and the
      `*_tips`/`*_Tips` fields 1-10%. `Refrigerate_After_Thawing_*` is
      essentially unpopulated (1% min, 0% max/metric) — task 4.6 already
      says to ignore it, and this confirms there is barely anything there to
      ignore.
      Metric spellings actually found, with counts across all `*_Metric`
      fields: `Months` 601, `Days` 332, `Weeks` 142, `Years` 138,
      `Not Recommended` 66, `Package use-by date` 36, `Indefinitely` 13,
      `When Ripe` 12, `Hours` 5, `Year` 2 (singular — an inconsistent spelling
      of `Years`, not a distinct term). The proposal/design docs anticipated
      Days/Weeks/Months/When Ripe/Indefinitely/Not Recommended; the file has
      three more terms than that: **`Years`, `Hours`, and `Package use-by
      date`**, plus the `Year`/`Years` singular/plural inconsistency. Task 4.2
      ("Convert Days, Weeks, and Months to days") and 4.3 (term list) are
      both incomplete as written against the real file.
- [x] 1.2 Run all 69 catalogue entries against it through the existing
      `resolve()` and record the hit rate, split into confident, uncertain, and
      no match.
      Run against the current 77, through the real `resolve()` cascade
      (`dbMatchStore()`, real migrations, real seed data, `node:sqlite` —
      same harness as `test/cjk-matching.test.ts`), source `dataset`, all 661
      FoodKeeper `Name`(`, Name_subtitle`) strings as raw references in one
      batch, no model resolver. Best status per canonical id, ties broken by
      confidence:
      **24 confident (resolved), 19 uncertain (needs_confirmation), 34 no
      match. 24/77 = 31%.**
      Confident: oyster-sauce, miso, sesame-oil, hoisin-sauce,
      tamarind-paste, sugar, vegetable-oil, butter, ghee, honey,
      dijon-mustard, garlic, ginger, banana, tomato, cucumber, cilantro,
      bok-choy, tofu-firm, chicken-breast, bacon, greek-yogurt, sesame,
      tahini.
      Uncertain: shaoxing-wine, rice-vinegar, sriracha, dried-pasta,
      all-purpose-flour, black-pepper, peanut-butter, mayonnaise,
      salad-dressing, coffee-beans, green-onion, napa-cabbage,
      shiitake-mushroom, chicken-thigh, ground-pork, cheddar-cheese,
      heavy-cream, peanut, shellfish.
      **A real cross-species mismatch, found by this run, not invented:**
      `chicken-breast` resolves confidently (0.87, `approximate`) against the
      FoodKeeper row "Turkey parts, breast halves, boneless" — scoring higher
      than the actually-correct "Chicken parts, breast halves, boneless"
      (0.64, `needs_confirmation`) in the same result set. The shared cut
      description ("parts, breast halves, boneless") outweighs the species
      word in the current similarity scorer. This is exactly the risk
      decision/task 5.2 names ("a wrong match writes chicken's shelf life
      onto chicken liver") — measured here, not hypothetical. Worth a look
      before group 5 applies confident matches unattended.
- [x] 1.3 **Report the number before building anything.** If confident matches
      are a small minority, say so — the honest outcome may be that this change
      is worth less than it looks, and that is a finding rather than a failure.
      31% confident, 55% confident-or-better (43/77). Not a small minority,
      not a strong majority either — FoodKeeper's coverage is real but
      partial, weighted toward base ingredients (produce, dairy, plain
      proteins) and thin on condiments/sauces and prepared/mixed items. The
      chicken/turkey mismatch above means "confident" here should not be read
      as "safe to apply unreviewed" — group 5's human-reviews-uncertain plan
      is doing real work, and on this evidence group 5.2's need to double-check
      even some *confident* matches for cross-item mismatches deserves a note,
      not just uncertain ones.
- [x] 1.4 Record which of the Asian entries match anything. The expectation is
      almost none, and it is the evidence for why the never-delete rule exists.
      28 Asian/Asian-cuisine entries identified (soy-sauce-light,
      soy-sauce-dark, tamari, doubanjiang, gochujang, gochugaru, fish-sauce,
      oyster-sauce, shaoxing-wine, mirin, miso, belacan, kecap-manis,
      sesame-oil, rice-vinegar, hoisin-sauce, xo-sauce, sriracha,
      five-spice, jasmine-rice, napa-cabbage, bok-choy, shiitake-mushroom,
      daikon, tofu-firm, frozen-dumplings, white-pepper, tamarind-paste).
      **7 confident, 5 uncertain, 16 no match (16/28 = 57%).**
      Confident: bok-choy, hoisin-sauce, miso, oyster-sauce, sesame-oil,
      tamarind-paste, tofu-firm. Uncertain: napa-cabbage, rice-vinegar,
      shaoxing-wine, shiitake-mushroom, sriracha. No match: belacan, daikon,
      doubanjiang, fish-sauce, five-spice, frozen-dumplings, gochugaru,
      gochujang, jasmine-rice, kecap-manis, mirin, soy-sauce-dark,
      soy-sauce-light, tamari, white-pepper, xo-sauce.
      The design doc's expectation was "almost none" — the measured number is
      softer than that (43% hit something) but the pattern holds where it
      matters: every fermented/regional condiment that is this catalogue's
      actual differentiator (gochujang, doubanjiang, belacan, kecap-manis,
      mirin, tamari) has **no match**. What does match is the more
      generic/Americanized entries (bok choy, tofu, oyster sauce, hoisin).
      The never-delete rule's justification stands; "almost none" should be
      revised to "none of the differentiating ones, real coverage on the
      common ones."
- [x] 1.5 Do the same for FoodData Central against the catalogue, with its free
      data.gov key. The key is for the build machine and never leaves it.
      `USDA_API_KEY` from `.env`, `GET .../foods/search?query={displayName}&dataType=Foundation,SR%20Legacy`
      (restricted to the two generic/unbranded datasets — nutrition per
      generic ingredient is the goal, not per-brand). No `resolve()`
      equivalent exists for FDC yet, so this is a query-and-read-the-results
      exercise, not a scored cascade — noted as a methodology difference from
      1.2/1.4, not glossed over.
      **7/77 zero hits:** doubanjiang, gochujang, gochugaru, mirin, belacan,
      kecap-manis, daikon — the same regional-condiment gap FoodKeeper has,
      plus daikon (FoodKeeper *did* have nothing for daikon either).
      Of the 70 with hits, the free-text search's top-ranked result is
      frequently wrong even when relevant entries exist further down or not
      at all: `salt`→"Butter, salted", `milk`→"Crackers, milk",
      `tomato`→"Tomato powder", `chicken-breast`→"Lunchmeat, chicken breast,
      sliced", `banana`→"Bananas, dehydrated, or banana powder",
      `tree-nut`→"Tree fern, cooked, with salt" (wrong food entirely).
      Reading top-3 by hand rather than trusting rank 1: **41 confident**
      (clean generic top-of-list match, e.g. `garlic`→"Garlic, raw"),
      **24 uncertain** (real hits exist but the top result is an off-cut,
      processed, flavoured, or branded variant requiring a human pick),
      **5 spurious** (hits exist — `dried-pasta`, `frozen-dumplings`,
      `shaoxing-wine`, `tree-nut`, `xo-sauce` — but everything returned is
      off-topic; functionally no match), **7 zero-hit**. 41/77 = 53%
      confident, but 12/77 (16%) return hits that are all noise, which
      `totalHits > 0` alone would have hidden.
      `soy-sauce-light`, `soy-sauce-dark`, `tamari`, and `soy` all land on
      the *same single* SR Legacy "Soy sauce made from soy (tamari)" entry —
      FDC does not distinguish light/dark/tamari nutritionally, which bears
      on how finely group 8's nutrition mapping can actually key by variety.
      **This is the real fix for `add-macro-gap-suggestions`'s nutrition
      gap, conditionally:** FDC covers the 77-entry catalogue about as well
      as FoodKeeper covers shelf life, but a naive top-1 API call would
      silently attach wrong nutrition to ~16% of ingredients (the spurious +
      some uncertain cases) — group 8 needs real disambiguation logic
      (category filtering, not top-1-by-relevance), not a thin wrapper
      around the search endpoint.

## 2. Types and schema

- [x] 2.1 Add `earlyWarningDays: number | null` to `CanonicalItem`, alongside
      `shelfLifeDays`.
- [x] 2.2 Add per-field provenance — `sources: Partial<Record<string, SourceId>>`
      — and a `SourceId` union with its `readonly` array, following the
      `MEAL_VENUES` convention.
- [x] 2.3 Add nullable nutrition per 100 g: calories, protein, carbohydrate, fat.
      **Nullable, not defaulted.** Missing nutrition is unknown, not zero.
- [x] 2.4 Append the migration adding these columns to canonical ingredients.
      Existing rows get provenance of hand-authored.
- [x] 2.5 Confirm `DROP_ALL` covers canonicals rather than assuming it.
- [x] 2.6 Verify the migration runs from the current head and `npm run typecheck`
      passes.

## 3. The build script

Runs on a developer machine. Nothing here ships.

- [x] 3.1 Write `scripts/build-catalogue.ts`: fetch, map, match, merge, write.
- [x] 3.2 Keep it out of the app bundle, and confirm nothing under `src/` or
      `app/` imports it.
- [x] 3.3 Read the FoodData Central key from the environment. It must not be
      committed, and it must not reach the asset.
- [x] 3.4 Make the script idempotent: running it twice with no dataset change
      produces no diff. Anything else makes the review worthless.
- [x] 3.5 Emit a build report — matched, unmatched, filled, conflicting,
      skipped — as its primary output. The asset is the side effect; the report
      is what a person reads.

## 4. Mapping FoodKeeper

- [x] 4.1 Map `Pantry_*` to `pantry`, `Refrigerate_*` to `fridge`, `Freeze_*` to
      `freezer`, matching `shelfLifeKey` in `src/logic/expiry.ts`.
- [x] 4.2 Convert Hours, Days, Weeks, Months, and Year/Years to days.
- [x] 4.3 **Produce no figure for a term.** *Indefinitely*, *When Ripe*,
      *Package use-by date*, and
      *Not Recommended* are not durations. Indefinite as a large number gives the
      app an expiry date to display; Not Recommended as zero puts salt in
      `use_first` forever. `predictExpiry` already handles absence correctly —
      do not undermine it.
- [x] 4.4 Take the **upper** bound as `shelfLifeDays` and the **lower** as
      `earlyWarningDays`. Do not average, and do not flatten.
- [x] 4.5 Map the after-opening fields onto `openLifeDays`.
- [x] 4.6 Ignore the after-thawing fields. The app has no concept of a thawed
      item and inventing one here would be the dataset driving the product.
- [x] 4.7 Unit-test the mapping including every metric term and a range whose
      bounds are equal.

## 5. Matching

- [x] 5.1 Resolve dataset rows through the existing `resolve()` with a `dataset`
      source. Do not write a second matcher — a build script that matches
      differently from the app produces a catalogue that behaves differently
      from the app that reads it.
- [x] 5.1a **Confident is not the same as correct — measured, not hypothetical.**
      Task 1.2 found `chicken-breast` resolving at 0.87 (`approximate`, above
      the accept band) against FoodKeeper's *Turkey* parts row, beating the
      correct *Chicken* row at 0.64. The shared cut description ("parts, breast
      halves, boneless") outweighs the species word in the current scorer.
      Applying that unattended writes turkey's shelf life onto chicken, and
      nothing downstream would ever detect it.
- [x] 5.1b Guard cross-item mismatches before applying a confident dataset
      match: require the head noun to agree, or surface any match whose losing
      candidates include a same-family alternative. A dataset row is matched
      once at build time by a script, so the cheap answer — put it in the
      review pile — costs a human a minute and costs the catalogue nothing.
- [x] 5.1c Add `chicken-breast` against the FoodKeeper corpus as a regression
      fixture, so whatever guard is chosen is measured against the case that
      motivated it rather than asserted.
- [x] 5.2 Apply confident matches; report uncertain ones and apply nothing.
      A wrong match writes chicken's shelf life onto chicken liver and nothing
      downstream would ever detect it.
- [x] 5.3 List unmatched dataset rows in the report, so a missing catalogue entry
      is visible as an opportunity rather than silence.

## 6. The merge rules

The section that protects the product from its own data pipeline.

- [x] 6.1 Fill a field only where it is empty.
- [x] 6.2 **Never overwrite a hand-authored value.**
- [x] 6.3 **Never remove an ingredient because a dataset lacks it**, and never
      blank its fields. Measured: the OFF taxonomy has 4,733 ingredients and
      zero entries for gochujang, hoisin, doenjang, or oyster sauce; FoodKeeper
      will be no better. Decision 4 makes those the differentiator, and a
      delete-on-absence rule would remove the product's reason to exist in a
      commit that looked like a data refresh.
- [x] 6.4 Report a conflict between a dataset value and a hand-authored one, and
      apply neither. Auto-keeping hides that the guess was wrong; auto-taking
      discards deliberate tuning.
- [x] 6.5 Record provenance per field as values are written.
- [x] 6.6 Test the merge directly: a hand-authored entry absent from every
      dataset survives a rebuild byte-identical except for provenance.
- [x] 6.7 Test that a second rebuild after a dataset refresh with no relevant
      changes produces no diff.

## 7. Reading the new fields

- [x] 7.1 Keep `predictExpiry` driven by `shelfLifeDays` — the upper bound.
      Expiry behaviour for the existing 69 entries must not move.
- [x] 7.2 Make `bucketFor` open `use_soon` at `earlyWarningDays` where one
      exists, falling back to the current fixed window where it does not.
- [x] 7.3 Confirm `use_first` is still driven by the expiry date alone, so
      decision 34's hard constraint reads exactly what it reads today.
- [x] 7.4 Test an entry with a range, an entry with a single figure, and an entry
      with no figure at all.
- [x] 7.5 Confirm no existing test's bucket expectations move for a
      single-figure entry.

## 8. Nutrition

- [x] 8.1 Make ingredient nutrition available for a quantity with no model call,
      so manual entry has figures where today it has none.
- [x] 8.2 **A photograph always wins.** A vision estimate of the actual plate
      outranks a table figure for the raw ingredient — the table describes 100 g
      of raw chicken thigh and the photograph was taken of something cooked in
      oil.
- [x] 8.3 Keep missing nutrition unknown rather than zero, following
      `add-fibre-tracking`'s discipline. Do not silence a null with `?? 0`.
- [x] 8.4 Test the fallback, the photograph precedence, and the unknown case.

## 9. Language

- [x] 9.1 Audit every string this change touches. Expiry is described as
      expected **quality**. Never *safe*, *unsafe*, *safe to eat*, or *safe
      until*.
- [x] 9.2 Add a test asserting those words appear in no expiry or shelf-life
      string, matching how decisions 108 and 129 are enforced. The source is a
      food safety publication and its vocabulary is contagious.
- [x] 9.3 Make a figure's source visible where a user might reasonably ask,
      without turning every date into a citation.

## 10. Verification

- [x] 10.1 Rebuild the catalogue and read the diff line by line. This is the
      review the whole design exists to make possible.
- [x] 10.2 Confirm every Asian entry is untouched except for provenance.
- [x] 10.3 Confirm no ingredient was removed.
- [x] 10.4 Add an item whose shelf life now comes from FoodKeeper and confirm the
      predicted expiry is defensible against the published figure.
- [x] 10.5 Confirm an ingredient whose source says *indefinitely* produces no
      expiry rather than a distant one.
- [x] 10.6 Confirm the app makes no dataset request at runtime, with the network
      disabled.
- [x] 10.7 Confirm no built artefact contains a data.gov key.
- [x] 10.8 Run `npm run typecheck` and `npm test`, then record the measured hit
      rate, the number of conflicts, and the US-centricity limitation in
      `docs/product-decisions.md`.

## 11. Owner in-app acceptance

Implementation and automated verification are complete. Keep this change
unarchived until the owner completes these checks in the installed app.

- [ ] 11.1 Upgrade an existing installation with saved data. Confirm the app
      opens and the catalogue migration preserves the existing database.
- [ ] 11.2 Add a banana to the fridge with a known purchase date. Confirm the
      predicted date uses FoodKeeper's three-day figure, shows its source, and
      describes expected quality rather than safety.
- [ ] 11.3 In manual meal entry, select Olive oil and enter 100 g. Confirm the
      app shows 884 kcal and recalculates the figures when quantity changes.
- [ ] 11.4 Select an ingredient with partial nutrition, such as Green onion.
      Confirm missing figures stay blank instead of becoming zero.
- [ ] 11.5 Disable network access and repeat one expiry and nutrition lookup.
      Record owner acceptance before permitting archival.

## 12. Dark soy nutrition remediation

- [x] 12.1 Add CoFID 2021 to the source registry as Open Government Licence
      v3.0 data, including the required attribution and no runtime dependency.
- [x] 12.2 Add the reviewed CoFID row `17-721`, "Soy sauce, light and dark
      varieties", as build input for Dark soy sauce: 79 kcal, 3.0 g protein,
      17.9 g carbohydrate, and unknown fat per 100 g.
- [x] 12.3 Merge the reviewed row through the existing fill-empty and
      per-field-provenance rules; do not overwrite Light soy sauce's existing
      FoodData Central values and do not coerce trace fat to zero.
- [x] 12.4 Show explicit manual-entry guidance when a selected catalogue
      ingredient has no nutrition at all, while retaining partial values and
      blanks for partially known nutrition.
- [x] 12.5 Test CoFID provenance, attribution, Dark soy scaling for grams and
      volume, trace-fat handling, unavailable guidance, partial nutrition, and
      the absence of runtime dataset requests.
- [x] 12.6 Run `npm run typecheck`, `npm test`, `git diff --check`, and strict
      OpenSpec validation. Keep group 11 unchecked for owner device acceptance.
