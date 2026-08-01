## Why

Deep Asian ingredient coverage is the differentiator (decision 4), and in-script
aliases are how it is delivered (decision 31). The matcher built in
`add-identity-layer` does not support it.

Measured during that change: `李錦記 蠔油` scores **0.27** against its own
canonical ingredient — far below the 0.60 confirm threshold. The cause is
structural rather than a tuning problem. Trigram Dice similarity assumes words
made of many characters; a four-character Chinese phrase yields two trigrams, so
the coefficient is computed over a set too small to carry information. The
scorer was designed for Latin receipt abbreviations, where `CHKN THGH BNLS`
scores 0.91, and it silently fails to transfer.

The consequence is narrower than it sounds but lands in the worst place. Exact
in-script aliases resolve, because the seed file contains them. Everything else
falls through to model resolution — correct behaviour, and not broken, but it
means **offline CJK matching does not exist**, and every unseeded CJK reference
costs a model call until its alias is learned. A user photographing a Korean
sauce label in aeroplane mode gets nothing, while the equivalent English label
resolves locally.

Recorded as decision 67.

## What Changes

- **Script-aware similarity.** The scorer detects the dominant script of the
  strings being compared and uses an n-gram size suited to it: character
  bigrams for CJK ideographs, the existing trigrams for Latin. Two-character
  compounds carry real meaning in Chinese, Japanese, and Korean —
  醬油, 蠔油, 味噌 — so bigrams are the natural unit.
- **Mixed-script comparison.** Real strings are not purely one script. `李錦記
  蠔油 510ML` and `CJ 고추장` both mix scripts, and normalisation strips the size
  token but leaves the brand. The comparison must handle a Latin brand prefix
  against an in-script product name without one side dominating the score.
- **Han and Kana handled separately from Hangul.** Korean is alphabetic and
  syllable-composed; a Hangul syllable block decomposes into two or three
  letters. Naive character n-grams over Hangul behave differently from n-grams
  over Han ideographs, so the two need different handling rather than one
  "CJK" bucket.
- **Width and form folding.** Full-width Latin (`ＫＩＫＫＯＭＡＮ`) and
  half-width Kana (`ｼｮｳﾕ`) appear on real packaging and in some receipt
  encodings. Unicode NFKC folding maps them to their ordinary forms so they
  match the seeded aliases.
- **The threshold constants are revisited per script.** `MATCH_ACCEPT` and
  `MATCH_CONFIRM` were tuned on a Latin corpus. Bigram scores over short
  ideographic strings have a different distribution, and reusing Latin
  thresholds unexamined would repeat the mistake in the other direction.
- **A CJK fixture corpus**, so this is measured rather than asserted.

## Capabilities

### Modified Capabilities

- `ingredient-matching`: The approximate-matching requirement currently
  specifies confidence bands without reference to script, which the
  implementation satisfied while failing on non-Latin text. It gains a
  requirement that approximate matching works for non-Latin scripts, and that
  the offline steps of the cascade are script-independent.

## Non-goals

- **Translation.** Resolving 醬油 to `soy-sauce-light` is alias matching, not
  translation. The model still handles genuinely unknown foreign strings at
  step 4; this change is about the local steps.
- **Romanisation.** Decision 31 stands — in-script text is never transliterated,
  and this change must not introduce a romanisation path as a shortcut to
  making Latin trigrams work.
- **Expanding the seed alias set.** More in-script aliases would also help, and
  should happen, but that is seed-data authoring rather than a scoring change.
  This change makes unseeded strings matchable; growing the seed is separate.
- **Embeddings or a vector index.** Still overkill, and still adds a dependency
  and an offline model. Rejected in `add-identity-layer` for reasons that have
  not changed.
- **Other non-Latin scripts.** Thai, Devanagari, Arabic, and Cyrillic all have
  their own tokenisation quirks. Out of scope until the ingredient coverage
  justifies it; the script-detection seam introduced here is where they would
  attach.

## Impact

**Code.**
- `src/logic/similarity.ts` — script detection and per-script n-gram size. The
  exported `similarity` signature is unchanged, so callers do not move.
- `src/logic/normalise.ts` — NFKC folding added ahead of the existing steps.
  Must not disturb the Latin path, which is covered by existing tests.
- `src/db/queries.ts` — `getCandidateAliases` prefilters on shared first
  trigram or whole token. A CJK string may produce neither, so the prefilter
  needs a script-appropriate branch or the scorer never sees the right
  candidates.
- `src/logic/__fixtures__/` — a CJK corpus alongside the Latin one.

**Dependencies.** None. NFKC normalisation is available through
`String.prototype.normalize`, which Hermes supports.

**Risk.** The prefilter is the subtle part. Fixing the scorer while leaving the
candidate query Latin-shaped would produce a change that passes unit tests on
the scoring function and still fails end to end, because the correct candidate
is never retrieved. Called out in the spec with its own requirement.

**Depends on** `add-identity-layer`. It modifies that change's matcher, so it
should land after it and after the confirm-band fix.
