## Context

See `proposal.md` — Why, and decision 67.

Current state after `add-identity-layer`:

- `src/logic/similarity.ts` scores a trigram Dice coefficient with a
  length-ratio penalty. Tuned and measured against a Latin corpus, where it
  performs well.
- `src/logic/normalise.ts` case-folds, strips punctuation, size tokens,
  weight-priced tails, store prefixes, and expands abbreviations. Non-Latin text
  passes through untouched, which was the requirement — but "untouched" also
  means unfolded.
- `src/db/queries.ts:getCandidateAliases` prefilters on a shared first trigram
  or a shared whole token.
- `MATCH_ACCEPT = 0.85` and `MATCH_CONFIRM = 0.60`, with band evidence recorded
  in decision 32.

The measured failure: `李錦記 蠔油` scores 0.27 against its own canonical.

## Goals / Non-Goals

**Goals:**

- In-script references match at quality comparable to the Latin path, offline.
- The Latin path is provably unchanged — it is measured, working, and regression
  here would be a bad trade.
- One seam where further scripts attach later.

**Non-Goals:**

- Translation, romanisation, embeddings, or seed-data growth. See the
  proposal's non-goals.
- Perfect segmentation. Chinese has no spaces and proper word segmentation is a
  research problem; character bigrams are the cheap approximation that works
  here and the design does not pretend otherwise.

## Decisions

### Script detection picks the n-gram size, and nothing else

A `dominantScript(text): 'han' | 'kana' | 'hangul' | 'latin' | 'mixed'` helper
driven by Unicode range counts. It selects an n-gram size and nothing more —
scoring stays one Dice coefficient over one n-gram set.

*Why:* the failure is entirely about n-gram size against string length. Han
ideographs are morpheme-dense, so a two-character compound (醬油, 蠔油, 味噌) is
a whole word and bigrams are the natural unit. Latin is character-sparse, so
trigrams are. Keeping everything else identical means the Latin path cannot
regress, and one function stays testable as one function.

*Alternative considered:* a separate scorer per script. Rejected — two scoring
functions means two things to tune and a caller that must know which to call.

### Han and Kana use bigrams; Hangul is decomposed first

Hangul syllable blocks are composed: 장 is ㅈ + ㅏ + ㅇ. Two visually similar
words can share no whole syllable while sharing most of their letters.

Applying NFD to Hangul before n-gramming, then using trigrams over the resulting
jamo, treats Korean as the alphabetic script it actually is.

*Why:* bucketing all three as "CJK" would repeat the original mistake in a new
place — Korean is not ideographic, and its failure mode is different from
Chinese. Hangul-specific handling is the difference between a fix and a
half-fix.

### NFKC folding is added to `normalise`, ahead of the existing steps

Full-width Latin (`ＫＩＫＫＯＭＡＮ`) and half-width Kana (`ｼｮｳﾕ`) fold to their
ordinary forms.

*Why:* both appear on real packaging and in some receipt encodings, and the
seeded aliases are written in ordinary forms. Folding first also means the
existing case-fold and punctuation steps see canonical characters.

*Care required:* NFKC is lossy for some Latin text — it rewrites ligatures and
some symbols. The Latin fixture corpus must be re-run to prove nothing moves
bands. This is the one place the change can silently damage working behaviour.

### The prefilter gains a script branch — the subtle part

`getCandidateAliases` currently matches on a shared first trigram or a shared
whole token. A CJK reference has no whole tokens in the Latin sense, and its
first trigram may be a third of the entire string.

For CJK, the prefilter matches on shared *bigrams* drawn from the reference,
against a bigram key stored per alias.

*Why this matters more than the scorer:* a perfect scoring function is worthless
if the correct candidate is never retrieved. Fixing `similarity.ts` alone
produces a change whose unit tests pass and whose end-to-end behaviour is
unchanged, which is a particularly expensive kind of wrong. This is why the spec
gives candidate retrieval its own requirement.

*Implementation note:* this likely needs an indexed helper column or table for
alias bigrams, populated at seed and write-back time. That is a schema change,
so it is a forward-only migration like everything else.

### Thresholds are re-measured, not re-used

The existing constants are applied to CJK scoring only after a CJK corpus shows
they separate correctly. If they do not, script-specific constants are added
beside them.

*Why:* reusing Latin thresholds unexamined is the same error that produced this
change, in the other direction. Bigram Dice over short strings has a different
score distribution from trigram Dice over long ones, and assuming otherwise is
unjustified.

## Risks / Trade-offs

**The Latin path regresses** → NFKC folding and a shared code path both touch
working, measured behaviour. Mitigation: the existing corpus and its asserted
confirm-band list run unchanged, and any band movement fails the build.

**Scorer fixed, retrieval not** → the failure mode described above, which looks
like success in unit tests. Mitigation: an end-to-end test resolving in-script
references through the real cascade and real queries, not through a stubbed
store.

**Bigrams over-match short strings** → two-character words share bigrams
promiscuously, so unrelated short ideographic names may score high. Mitigation:
the existing length-ratio penalty, extended to the bigram path, plus deliberately
including near-miss pairs in the corpus rather than only true pairs.

**Hangul decomposition changes alias storage assumptions** → decomposed forms
must not leak into stored aliases or displayed names, which would violate
decision 31's spirit. Mitigation: decomposition happens inside the scorer only;
storage and display keep the composed form.

## Migration Plan

A forward-only migration if the bigram prefilter needs its own index or table.
Additive; the existing alias tables are unchanged and repopulating the helper
structure from existing aliases is a one-pass backfill within the migration.

Rollback is additive — an older build ignores the helper structure and falls
back to the Latin prefilter, which is today's behaviour.

## Open Questions

- **Whether the bigram prefilter needs its own table or a column with an index.**
  Depends on measured query cost at realistic alias counts, which is an
  implementation measurement and changes no interface.
- **Whether Kana needs Hangul-style decomposition too.** Dakuten-marked
  characters (が versus か) compose similarly. Probably handled adequately by
  NFKC folding; the corpus will show it. Does not change the approach.
