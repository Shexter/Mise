## 1. Corpus first

Nothing is tunable without something to measure against, and the whole change
exists because a scoring assumption went unmeasured.

- [x] 1.1 Create `src/logic/__fixtures__/cjk-lines.ts` with at least 30 real
      references: Chinese, Japanese, and Korean product names, brand-plus-name
      pairs (`李錦記 蠔油`, `CJ 고추장`, `キッコーマン 醤油`), full-width and
      half-width variants, and size tokens attached.
      33 fixtures in `CJK_LINES`. `キッコーマン 醤油` is present as a `review`
      row, not `accept`/`confirm` — see 4b.1.
- [x] 1.2 Include deliberate near-miss pairs — different foods with similar
      short names — so over-matching is measurable and not just absence of
      evidence.
      `CJK_NEAR_MISSES`, 11 pairs across Han, single-character Han, Hangul,
      and romanised Latin.
- [x] 1.3 Record the current score for every fixture against its canonical, as
      the before-picture. `李錦記 蠔油` at 0.27 is the reference point.
      Recorded in decision 67: 李錦記 蠔油/蠔油 0.267, CJ 고추장/고추장 0.545,
      海天生抽/生抽 0.250, 蚝油/蠔油 0.000 (measured against the pre-change
      trigram-only scorer).

## 2. Script detection

- [x] 2.1 Implement `dominantScript(text)` in `src/logic/similarity.ts`
      returning `han | kana | hangul | latin | mixed`, from Unicode range
      counts.
      Han and Kana are one *family* internally (both use bigrams, so nothing
      downstream needs to tell them apart) — `mixed` fires when Latin and any
      CJK-family script are both present, not when Han and Kana are.
- [x] 2.2 Unit-test it across the CJK corpus, the Latin corpus, and mixed
      strings, including strings that are mostly digits or punctuation.
      `src/logic/similarity.test.ts`, `describe('dominantScript ...')`.

## 3. Normalisation

- [x] 3.1 Add NFKC folding to `src/logic/normalise.ts` ahead of the existing
      steps, so full-width Latin and half-width Kana reach the seeded forms.
- [x] 3.2 Re-run the existing Latin normaliser tests unchanged. NFKC is lossy
      for some Latin text — if anything moves, stop and narrow the fold rather
      than updating the expectations.
      Nothing moved — the full pre-existing `normalise.test.ts` suite passed
      unedited (only new `describe` blocks were added).

## 4. Script-aware scoring

- [x] 4.1 Make n-gram size a function of detected script: bigrams for Han and
      Kana, trigrams for Latin.
- [x] 4.2 Apply NFD decomposition to Hangul before n-gramming and score
      trigrams over the resulting jamo — Korean is alphabetic, and treating it
      as ideographic is a half-fix.
- [x] 4.3 Handle `mixed` so a Latin brand cannot dominate an in-script product
      name.
      Token-segmented: each whitespace-separated token is n-grammed by its
      *own* script and the sets unioned, so a short brand token contributes
      only its own few grams. `CJ 고추장` scores 0.84 against `고추장` this
      way (was 0.55 under the unmodified Latin trigram path).
- [x] 4.4 Extend the length-ratio penalty to the bigram path, since short
      ideographic strings share bigrams promiscuously.
      Measured the opposite problem first: the *existing* Latin-tuned penalty
      (no penalty above a 2:1 character-length ratio) zeroed out the flagship
      case, because a 2-4 character CJK word means any brand token at all
      exceeds 2:1. `CJK_LENGTH_RATIO_MULTIPLIER = 3` (vs `2` for Latin),
      applied whenever either side is non-Latin — provably unreachable by a
      Latin-vs-Latin comparison, so decision 32's corpus cannot be affected by
      it. Near-miss pairs (1.2) still stay below `MATCH_CONFIRM` with the
      looser multiplier — see the `CJK_NEAR_MISSES` test.
- [x] 4.5 Keep the exported `similarity` signature unchanged so no caller moves.
- [x] 4.6 Re-run the Latin corpus and confirm every fixture's band placement is
      identical to decision 32's recorded evidence. Any movement is a
      regression, not a new baseline.
      Unchanged — `similarity.test.ts`'s decision-32 confirm-band list and
      accept/non-pair lists pass unedited.

## 4a. Han variant forms

`蠔油` and `蚝油` are the same oyster sauce. A Hong Kong bottle prints one, a
mainland bottle prints the other, and the same shopper buys both.

- [x] 4a.1 Add a simplified/traditional fold to `src/logic/normalise.ts`, applied
      **for matching only** — a mapping table, not a library, since the set of
      characters the food catalogue actually uses is small and a dependency for
      this is disproportionate.
- [x] 4a.2 Restrict the table to characters appearing in the catalogue, and
      generate it from the catalogue so it stays honest as the catalogue grows.
      Built at module load from `assets/item-aliases.json`'s own paired
      `zh-Hans`/`zh-Hant` aliases — not hand-authored, so a new paired alias
      extends the table with no code change. A real bug surfaced building
      this: a canonical with more than one same-locale alias (shaoxing-wine's
      `料酒`, a synonym, sitting next to its real `绍兴酒`/`紹興酒` pair) was
      silently displacing the true pair under a naive "last alias wins"
      approach. Fixed with a same-position-character-overlap heuristic that
      picks the true pair among same-length candidates and skips a genuine
      tie rather than guessing.
- [x] 4a.3 **Never convert stored aliases or displayed names.** Decision 31 keeps
      the composed original; showing a Hong Kong user a simplified name they did
      not write is the same class of mistake as romanising it for them.
      `foldHanVariants` is exported separately from `normalise()` and only
      called inside `similarity.ts`'s scoring path. Verified in
      `test/cjk-matching.test.ts`: a Han-variant match writes back the alias
      exactly as typed, not the folded form.
- [x] 4a.4 Fold on both sides of the comparison, so the direction of the
      difference does not matter.
- [x] 4a.5 Add both variants of at least five ingredients to the corpus and test
      the fold in both directions.
      Six pairs tested in `similarity.test.ts`: soy sauce, oyster sauce,
      Shaoxing wine, hoisin sauce, doubanjiang, XO sauce.

## 4b. Romanised references

The gap the rest of this change does not close. Decision 4's audience frequently
types `gochujang`, not `고추장` — an English-language phone keyboard, a recipe
site's spelling, a receipt line printed in Latin by a Western supermarket. These
are Latin-script strings, so script detection sends them down the Latin path,
where they are compared against a seeded romanisation that may be spelled
differently.

- [x] 4b.1 Audit the corpus for romanisation variants the catalogue would miss:
      `gochujang` / `kochujang` / `go chu jang`, `doenjang` / `dwenjang`,
      `shoyu` / `shôyu` / `shoyu sauce`, `char siu` / `char siew` / `chashu`,
      `bok choy` / `pak choi` / `bak choy`. Record which resolve today.
      Measured against the real cascade before seeding: `kochujang` 0.70
      (already confirm-band via approximate — seeded anyway for a silent
      resolution), `go chu jang` 0.55 (below confirm, genuinely needed
      seeding), `shoyu` vs `soy sauce` 0.125 (no textual overlap — only
      seeding closes this), `bak choy` 0.67 (already confirm-band, seeded for
      silence). `doenjang`/`dwenjang` and `char siu`/`char siew`/`chashu` have
      **no canonical ingredient in this catalogue at all** — out of scope
      (non-goal: expanding the seed set is catalogue authoring, not a scoring
      change). Recorded as a known gap, not silently dropped.
- [x] 4b.2 Strip diacritics and macrons in normalisation — `shōyu` and `shoyu`
      are one word, and only one of them is typeable on a phone.
      NFD-decompose, strip the Combining Diacritical Marks block only, NFC-
      recompose — round-trips Hangul and Han/Kana untouched (they decompose
      into a different Unicode block), tested directly.
- [x] 4b.3 Collapse spacing and hyphenation before scoring, so `char siu`,
      `char-siu`, and `charsiu` reach the same form. This is where the trigram
      scorer loses most: a space changes several trigrams in a short string.
      Hyphens already collapsed to spaces via the existing punctuation-strip
      step — no code change needed, confirmed with a direct test. A solid
      compound with no separator at all (`charsiu`) is a genuinely different
      string no normalisation step can safely guess apart; closed by seeding
      the specific spelling (4b.4), not by loosening scoring further.
- [x] 4b.4 Seed the common romanisation variants as aliases rather than
      inventing a transliteration algorithm. Romanisation systems disagree with
      each other and with how people actually spell; a table of what people
      write is truer than a rule for what they ought to write.
      Added to `assets/item-aliases.json`: `kochujang`, `go chu jang`,
      `gochukaru` → gochujang/gochugaru; `shoyu`, `shoyu sauce` → soy-sauce-
      light; `bak choy` → bok-choy.
- [x] 4b.5 **Test the near-misses.** Loosening a Latin matcher for romanisations
      is exactly how over-matching gets introduced, and short romanised words
      collide readily. Assert the 1.2 near-miss pairs stay apart.
      `kochujang`/`gochugaru` in `CJK_NEAR_MISSES`, asserted both in
      `similarity.test.ts` (score) and `test/cjk-matching.test.ts` (real
      cascade — each resolves to its own canonical, never the other's).
- [x] 4b.6 Re-run the Latin corpus after each loosening step. Band placement must
      be identical to decision 32's evidence — this work must not be paid for by
      the English path.
      Unchanged throughout — nothing in 4b touches the Latin scoring path
      itself, only normalisation (a no-op on the existing corpus, verified)
      and the seed alias table (additive).

## 5. Candidate retrieval

The scorer is worthless if the right candidate is never retrieved. This is the
part that makes the change real.

- [x] 5.1 Add a bigram key structure for aliases — column with index, or its own
      table — as a forward-only migration appended to `MIGRATIONS`.
      Migration 9, `alias_bigrams(alias_id, bigram)`, indexed on both columns.
- [x] 5.2 Backfill it from existing aliases inside the same migration.
      A recursive CTE over `item_aliases`, restricted to non-ASCII
      `alias_norm` values, in the same migration statement.
- [x] 5.3 Populate it on seed load and on every alias write-back.
      `ensureAliasBigrams` called from `loadSeedData` (a backfill pass over
      every non-Latin alias, since `INSERT OR IGNORE` can keep an existing
      row's id rather than the freshly generated one), `recordAlias`, and
      `recordUserResolution`.
- [x] 5.4 Branch `getCandidateAliases` in `src/db/queries.ts` on script: shared
      bigrams for CJK, the existing first-trigram-or-token path for Latin.
- [x] 5.5 Confirm the candidate set stays bounded at realistic alias counts, and
      record the measured cost.
      111 non-Latin aliases produce 364 `alias_bigrams` rows (~3.3 rows per
      alias, expected for 2-4 character CJK words). Candidate sets for real
      fixtures ranged 4-8 rows, both well inside the `LIMIT 200` shared with
      the Latin path.
- [x] 5.6 Extend `DROP_ALL` if a new table was added.

## 6. Thresholds

- [x] 6.1 Score the whole CJK corpus and record the band distribution the way
      decision 32 records the Latin one.
      Recorded in decision 67. Accept band: exact/folded matches at 0.95
      (the exact-alias step's confidence cap) or 1 (direct scorer output).
      Confirm band, 4 fixtures: `CJ 고추장 500G` 0.84, `go chu jang paste`
      0.80, `たまご 12個` 0.67, `연어 필렛` 0.63, `李錦記 蠔油 510ML` 0.60 —
      range 0.60-0.84, entirely inside the existing band.
- [x] 6.2 Decide from that evidence whether `MATCH_ACCEPT` and `MATCH_CONFIRM`
      transfer. If they do not, add script-specific constants beside them,
      named and adjustable.
      They transfer unchanged — every measured CJK score landed on the
      correct side of both thresholds. What did **not** transfer was the
      length-ratio penalty's multiplier (4.4) — a different, narrower
      constant than the accept/confirm bands themselves.
- [x] 6.3 Assert the CJK confirm-band membership in a test, so a scorer change
      that moves the band fails the build — matching how the Latin band is
      protected.
      `test/cjk-matching.test.ts`'s full-corpus band test asserts every
      `CJK_LINES` fixture's `offline` expectation through the real cascade.

## 7. End to end

- [x] 7.1 Integration-test in-script references through the real cascade with
      real queries and real seed data — not a stubbed store. A scorer fixed
      without retrieval fixed passes unit tests and fails here, which is the
      whole point of this task.
      `test/cjk-matching.test.ts`, real migrations + real seed data + real
      SQLite (`node:sqlite`), no stubbed store.
- [x] 7.2 Confirm an unseeded in-script reference now resolves locally, with no
      network and no API key.
      `李錦記 蠔油 510ML` — no `model` option passed to `resolve()` at all in
      that test, and it still lands in the confirm band.
- [x] 7.3 Confirm decomposed or folded forms never reach stored aliases or
      displayed names — storage and display keep the composed original
      (decision 31).
      Two dedicated tests: a Han-variant match writes back the exact typed
      form (not the simplified fold used to score it), and a mixed/Hangul
      match's stored `alias_norm` is NFC-normal (not the NFD jamo used
      internally to score it).
- [x] 7.4 Run `npm run typecheck` and `npm test`, then update decision 67 in
      `docs/product-decisions.md` with the measured after-picture and close it.
      `npm run typecheck`: clean. `npm test`: 411 passed, 30 files (was 382
      before this change). Decision 67 updated below.
