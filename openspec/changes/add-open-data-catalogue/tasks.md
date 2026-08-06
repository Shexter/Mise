## 1. Find out whether this is worth doing

Ordered first because it can end the change. Sixty-nine hand-authored entries
against 500+ US supermarket product names is not obviously a good match, and the
whole value depends on the hit rate.

- [ ] 1.1 Download the FoodKeeper dataset and record its real shape: row count,
      which fields are actually populated, and how the metric values are spelled.
      Work from the file, not from the documentation.
- [ ] 1.2 Run all 69 catalogue entries against it through the existing
      `resolve()` and record the hit rate, split into confident, uncertain, and
      no match.
- [ ] 1.3 **Report the number before building anything.** If confident matches
      are a small minority, say so — the honest outcome may be that this change
      is worth less than it looks, and that is a finding rather than a failure.
- [ ] 1.4 Record which of the Asian entries match anything. The expectation is
      almost none, and it is the evidence for why the never-delete rule exists.
- [ ] 1.5 Do the same for FoodData Central against the catalogue, with its free
      data.gov key. The key is for the build machine and never leaves it.

## 2. Types and schema

- [ ] 2.1 Add `earlyWarningDays: number | null` to `CanonicalItem`, alongside
      `shelfLifeDays`.
- [ ] 2.2 Add per-field provenance — `sources: Partial<Record<string, SourceId>>`
      — and a `SourceId` union with its `readonly` array, following the
      `MEAL_VENUES` convention.
- [ ] 2.3 Add nullable nutrition per 100 g: calories, protein, carbohydrate, fat.
      **Nullable, not defaulted.** Missing nutrition is unknown, not zero.
- [ ] 2.4 Append the migration adding these columns to canonical ingredients.
      Existing rows get provenance of hand-authored.
- [ ] 2.5 Confirm `DROP_ALL` covers canonicals rather than assuming it.
- [ ] 2.6 Verify the migration runs from the current head and `npm run typecheck`
      passes.

## 3. The build script

Runs on a developer machine. Nothing here ships.

- [ ] 3.1 Write `scripts/build-catalogue.ts`: fetch, map, match, merge, write.
- [ ] 3.2 Keep it out of the app bundle, and confirm nothing under `src/` or
      `app/` imports it.
- [ ] 3.3 Read the FoodData Central key from the environment. It must not be
      committed, and it must not reach the asset.
- [ ] 3.4 Make the script idempotent: running it twice with no dataset change
      produces no diff. Anything else makes the review worthless.
- [ ] 3.5 Emit a build report — matched, unmatched, filled, conflicting,
      skipped — as its primary output. The asset is the side effect; the report
      is what a person reads.

## 4. Mapping FoodKeeper

- [ ] 4.1 Map `Pantry_*` to `pantry`, `Refrigerate_*` to `fridge`, `Freeze_*` to
      `freezer`, matching `shelfLifeKey` in `src/logic/expiry.ts`.
- [ ] 4.2 Convert Days, Weeks, and Months to days.
- [ ] 4.3 **Produce no figure for a term.** *Indefinitely*, *When Ripe*, and
      *Not Recommended* are not durations. Indefinite as a large number gives the
      app an expiry date to display; Not Recommended as zero puts salt in
      `use_first` forever. `predictExpiry` already handles absence correctly —
      do not undermine it.
- [ ] 4.4 Take the **upper** bound as `shelfLifeDays` and the **lower** as
      `earlyWarningDays`. Do not average, and do not flatten.
- [ ] 4.5 Map the after-opening fields onto `openLifeDays`.
- [ ] 4.6 Ignore the after-thawing fields. The app has no concept of a thawed
      item and inventing one here would be the dataset driving the product.
- [ ] 4.7 Unit-test the mapping including every metric term and a range whose
      bounds are equal.

## 5. Matching

- [ ] 5.1 Resolve dataset rows through the existing `resolve()` with a `dataset`
      source. Do not write a second matcher — a build script that matches
      differently from the app produces a catalogue that behaves differently
      from the app that reads it.
- [ ] 5.2 Apply confident matches; report uncertain ones and apply nothing.
      A wrong match writes chicken's shelf life onto chicken liver and nothing
      downstream would ever detect it.
- [ ] 5.3 List unmatched dataset rows in the report, so a missing catalogue entry
      is visible as an opportunity rather than silence.

## 6. The merge rules

The section that protects the product from its own data pipeline.

- [ ] 6.1 Fill a field only where it is empty.
- [ ] 6.2 **Never overwrite a hand-authored value.**
- [ ] 6.3 **Never remove an ingredient because a dataset lacks it**, and never
      blank its fields. Measured: the OFF taxonomy has 4,733 ingredients and
      zero entries for gochujang, hoisin, doenjang, or oyster sauce; FoodKeeper
      will be no better. Decision 4 makes those the differentiator, and a
      delete-on-absence rule would remove the product's reason to exist in a
      commit that looked like a data refresh.
- [ ] 6.4 Report a conflict between a dataset value and a hand-authored one, and
      apply neither. Auto-keeping hides that the guess was wrong; auto-taking
      discards deliberate tuning.
- [ ] 6.5 Record provenance per field as values are written.
- [ ] 6.6 Test the merge directly: a hand-authored entry absent from every
      dataset survives a rebuild byte-identical except for provenance.
- [ ] 6.7 Test that a second rebuild after a dataset refresh with no relevant
      changes produces no diff.

## 7. Reading the new fields

- [ ] 7.1 Keep `predictExpiry` driven by `shelfLifeDays` — the upper bound.
      Expiry behaviour for the existing 69 entries must not move.
- [ ] 7.2 Make `bucketFor` open `use_soon` at `earlyWarningDays` where one
      exists, falling back to the current fixed window where it does not.
- [ ] 7.3 Confirm `use_first` is still driven by the expiry date alone, so
      decision 34's hard constraint reads exactly what it reads today.
- [ ] 7.4 Test an entry with a range, an entry with a single figure, and an entry
      with no figure at all.
- [ ] 7.5 Confirm no existing test's bucket expectations move for a
      single-figure entry.

## 8. Nutrition

- [ ] 8.1 Make ingredient nutrition available for a quantity with no model call,
      so manual entry has figures where today it has none.
- [ ] 8.2 **A photograph always wins.** A vision estimate of the actual plate
      outranks a table figure for the raw ingredient — the table describes 100 g
      of raw chicken thigh and the photograph was taken of something cooked in
      oil.
- [ ] 8.3 Keep missing nutrition unknown rather than zero, following
      `add-fibre-tracking`'s discipline. Do not silence a null with `?? 0`.
- [ ] 8.4 Test the fallback, the photograph precedence, and the unknown case.

## 9. Language

- [ ] 9.1 Audit every string this change touches. Expiry is described as
      expected **quality**. Never *safe*, *unsafe*, *safe to eat*, or *safe
      until*.
- [ ] 9.2 Add a test asserting those words appear in no expiry or shelf-life
      string, matching how decisions 108 and 129 are enforced. The source is a
      food safety publication and its vocabulary is contagious.
- [ ] 9.3 Make a figure's source visible where a user might reasonably ask,
      without turning every date into a citation.

## 10. Verification

- [ ] 10.1 Rebuild the catalogue and read the diff line by line. This is the
      review the whole design exists to make possible.
- [ ] 10.2 Confirm every Asian entry is untouched except for provenance.
- [ ] 10.3 Confirm no ingredient was removed.
- [ ] 10.4 Add an item whose shelf life now comes from FoodKeeper and confirm the
      predicted expiry is defensible against the published figure.
- [ ] 10.5 Confirm an ingredient whose source says *indefinitely* produces no
      expiry rather than a distant one.
- [ ] 10.6 Confirm the app makes no dataset request at runtime, with the network
      disabled.
- [ ] 10.7 Confirm no built artefact contains a data.gov key.
- [ ] 10.8 Run `npm run typecheck` and `npm test`, then record the measured hit
      rate, the number of conflicts, and the US-centricity limitation in
      `docs/product-decisions.md`.
