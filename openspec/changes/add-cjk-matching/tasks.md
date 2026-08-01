## 1. Corpus first

Nothing is tunable without something to measure against, and the whole change
exists because a scoring assumption went unmeasured.

- [ ] 1.1 Create `src/logic/__fixtures__/cjk-lines.ts` with at least 30 real
      references: Chinese, Japanese, and Korean product names, brand-plus-name
      pairs (`李錦記 蠔油`, `CJ 고추장`, `キッコーマン 醤油`), full-width and
      half-width variants, and size tokens attached.
- [ ] 1.2 Include deliberate near-miss pairs — different foods with similar
      short names — so over-matching is measurable and not just absence of
      evidence.
- [ ] 1.3 Record the current score for every fixture against its canonical, as
      the before-picture. `李錦記 蠔油` at 0.27 is the reference point.

## 2. Script detection

- [ ] 2.1 Implement `dominantScript(text)` in `src/logic/similarity.ts`
      returning `han | kana | hangul | latin | mixed`, from Unicode range
      counts.
- [ ] 2.2 Unit-test it across the CJK corpus, the Latin corpus, and mixed
      strings, including strings that are mostly digits or punctuation.

## 3. Normalisation

- [ ] 3.1 Add NFKC folding to `src/logic/normalise.ts` ahead of the existing
      steps, so full-width Latin and half-width Kana reach the seeded forms.
- [ ] 3.2 Re-run the existing Latin normaliser tests unchanged. NFKC is lossy
      for some Latin text — if anything moves, stop and narrow the fold rather
      than updating the expectations.

## 4. Script-aware scoring

- [ ] 4.1 Make n-gram size a function of detected script: bigrams for Han and
      Kana, trigrams for Latin.
- [ ] 4.2 Apply NFD decomposition to Hangul before n-gramming and score
      trigrams over the resulting jamo — Korean is alphabetic, and treating it
      as ideographic is a half-fix.
- [ ] 4.3 Handle `mixed` so a Latin brand cannot dominate an in-script product
      name.
- [ ] 4.4 Extend the length-ratio penalty to the bigram path, since short
      ideographic strings share bigrams promiscuously.
- [ ] 4.5 Keep the exported `similarity` signature unchanged so no caller moves.
- [ ] 4.6 Re-run the Latin corpus and confirm every fixture's band placement is
      identical to decision 32's recorded evidence. Any movement is a
      regression, not a new baseline.

## 5. Candidate retrieval

The scorer is worthless if the right candidate is never retrieved. This is the
part that makes the change real.

- [ ] 5.1 Add a bigram key structure for aliases — column with index, or its own
      table — as a forward-only migration appended to `MIGRATIONS`.
- [ ] 5.2 Backfill it from existing aliases inside the same migration.
- [ ] 5.3 Populate it on seed load and on every alias write-back.
- [ ] 5.4 Branch `getCandidateAliases` in `src/db/queries.ts` on script: shared
      bigrams for CJK, the existing first-trigram-or-token path for Latin.
- [ ] 5.5 Confirm the candidate set stays bounded at realistic alias counts, and
      record the measured cost.
- [ ] 5.6 Extend `DROP_ALL` if a new table was added.

## 6. Thresholds

- [ ] 6.1 Score the whole CJK corpus and record the band distribution the way
      decision 32 records the Latin one.
- [ ] 6.2 Decide from that evidence whether `MATCH_ACCEPT` and `MATCH_CONFIRM`
      transfer. If they do not, add script-specific constants beside them,
      named and adjustable.
- [ ] 6.3 Assert the CJK confirm-band membership in a test, so a scorer change
      that moves the band fails the build — matching how the Latin band is
      protected.

## 7. End to end

- [ ] 7.1 Integration-test in-script references through the real cascade with
      real queries and real seed data — not a stubbed store. A scorer fixed
      without retrieval fixed passes unit tests and fails here, which is the
      whole point of this task.
- [ ] 7.2 Confirm an unseeded in-script reference now resolves locally, with no
      network and no API key.
- [ ] 7.3 Confirm decomposed or folded forms never reach stored aliases or
      displayed names — storage and display keep the composed original
      (decision 31).
- [ ] 7.4 Run `npm run typecheck` and `npm test`, then update decision 67 in
      `docs/product-decisions.md` with the measured after-picture and close it.
