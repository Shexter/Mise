## 1. The gate

The only section that may be worked before the licence position is settled,
because it is what settles it. Nothing below this may start until task 1.6 is
recorded.

- [ ] 1.1 Read the ODbL text itself, not a summary, and identify how it
      distinguishes a **derivative database** from a **produced work**. That
      distinction is the whole question, and every secondhand explanation of it
      is someone's paraphrase.
- [ ] 1.2 Read Open Food Facts' own terms of use and their API re-use guidance,
      and record what they state about attribution and share-alike in their own
      words.
- [ ] 1.3 Establish which side of the line a **catalogue seeded from the
      taxonomy and shipped inside an APK** falls on.
- [ ] 1.4 Establish the same for the **per-user runtime cache**
      `add-barcode-capture` already plans. It is a different situation and may
      have a different answer; conflating them is how one answer gets applied to
      both wrongly.
- [ ] 1.5 Ask Open Food Facts directly, via their forum. They are the people
      best placed to say how they read their own licence, asking is cheap, and
      the answer is of public interest rather than a favour.
- [ ] 1.6 **Record the conclusion as a decision in
      `docs/product-decisions.md`**, including which of the proposal's three
      outcomes it selects. If the outcome is "take nothing", record the
      reasoning and stop — that is a completed change, not a failed one.

## 2. Measure before importing

- [ ] 2.1 Re-download `taxonomies/food/ingredients.txt` and confirm the shape
      independently. Recorded at the time of planning: 97,752 lines, 4,733
      entries, 944 Japanese, 783 Chinese, 606 Korean translations.
- [ ] 2.2 Confirm the differentiator gap still holds — gochujang, hoisin,
      doenjang, oyster sauce, 蠔油, 魚露 all absent. This is the evidence the seed
      cannot dilute decision 4, and it should be re-checked rather than trusted
      from a plan.
- [ ] 2.3 Sample 30 CJK translations across the three languages and assess
      quality by hand. A machine translation and a native contribution look
      identical in the file, and soy sauce being right is one data point.
- [ ] 2.4 Record the assessment. If quality is poor, seed the Latin entries and
      drop the alias half rather than proceeding on hope.

## 3. Curation

- [ ] 3.1 Write the selection criterion for which of the 4,733 belong in a home
      pantry catalogue. Expect to write it after looking at a few hundred
      entries rather than before.
- [ ] 3.2 Produce the selection as a reviewable list, separate from the import.
      It is a product decision about what the app knows, arriving as a data file.
- [ ] 3.3 **Do not import wholesale.** A larger candidate pool makes the matcher
      worse, not better: decision 32's bands were measured against things people
      buy, and thousands of near-synonymous labelling terms move scores in ways
      nobody has measured. The failure mode is a confident wrong match, not a
      visible miss.
- [ ] 3.4 Map taxonomy entries onto the `CanonicalItem` shape, leaving every
      field the taxonomy does not supply empty rather than defaulted.

## 4. Seeding, through the existing pipeline

- [ ] 4.1 Add the taxonomy as a second source behind
      `scripts/build-catalogue.ts`'s existing source interface. Do not write a
      parallel pipeline.
- [ ] 4.2 Reuse `add-open-data-catalogue`'s merge rules unchanged: fill gaps,
      never overwrite, never delete.
- [ ] 4.3 **Never delete on absence**, which matters more here than anywhere
      else — this dataset is the largest and its absences are the most numerous,
      and they fall exactly on the entries the product exists for.
- [ ] 4.4 Record provenance per field, marking the taxonomy-derived subset.
- [ ] 4.5 Confirm the derived subset can be enumerated and removed as a whole,
      leaving hand-authored content untouched. This is what makes the licence
      decision reversible instead of archaeological.

## 5. In-script aliases

- [ ] 5.1 Seed non-Latin translations as aliases **in script**. Decision 31
      stands and the taxonomy already agrees with it.
- [ ] 5.2 Produce no romanised form of anything.
- [ ] 5.3 Mark seeded aliases as imported rather than confirmed, and give them a
      confidence reflecting that.
- [ ] 5.4 Ensure a user resolution outranks a seeded alias. `add-identity-layer`
      already had a confirm-band leak where an unconfirmed alias was written back
      and resolved silently at a flat high confidence — seeding thousands at an
      undifferentiated confidence would recreate that failure at scale.
- [ ] 5.5 Test that a seeded alias resolves its reference, and that a user
      correction replaces it.

## 6. Guard the matcher

- [ ] 6.1 Record the Latin corpus's band placement **before** seeding, against
      decision 32's recorded evidence.
- [ ] 6.2 Record it again after. Any movement is a regression, not a new
      baseline.
- [ ] 6.3 Measure candidate retrieval cost at the new alias count, and confirm
      the candidate set stays bounded.
- [ ] 6.4 Test the near-miss pairs from `add-cjk-matching`'s corpus, which is
      where a larger pool produces confident wrong matches.

## 7. Attribution

- [ ] 7.1 Attribute the source wherever taxonomy-derived data is shown as data.
- [ ] 7.2 Do not attribute on every rendering of an ingredient name. An
      attribution on every word is clutter and satisfies nobody.
- [ ] 7.3 Implement whatever task 1.6 concluded is required, rather than what
      seemed polite.

## 8. Verification

- [ ] 8.1 Confirm no shipped artefact contained taxonomy content before 1.6 was
      recorded.
- [ ] 8.2 Confirm every hand-authored entry survives seeding byte-identical
      except for provenance.
- [ ] 8.3 Confirm the Asian entries are untouched.
- [ ] 8.4 Resolve an in-script reference for a newly seeded ingredient and
      confirm it works with no network and no API key.
- [ ] 8.5 Confirm the derived subset can be listed and removed cleanly.
- [ ] 8.6 Run `npm run typecheck` and `npm test`, then record the seeded entry
      count, the measured translation quality, and the before-and-after band
      placement in `docs/product-decisions.md`.
