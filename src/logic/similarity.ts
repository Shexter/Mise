/**
 * Approximate string similarity for alias matching: a character-n-gram Dice
 * coefficient with a length-ratio penalty. Pure and dependency-free.
 *
 * Works on normalised strings (see `normalise.ts`). N-gram size is chosen
 * per script (decision 67, `add-cjk-matching`): trigrams for Latin, where a
 * word is many characters; bigrams for Han and Kana, where a two-character
 * compound is already a whole word; trigrams over NFD-decomposed jamo for
 * Hangul, which is alphabetic rather than ideographic and behaves like
 * Latin once decomposed. A mixed-script string (a Latin brand prefixing an
 * in-script product name) is scored token by token, each token using its
 * own script's n-gram size, so the brand cannot drown the product name out.
 */

import { foldHanVariants } from '@/logic/normalise';

/**
 * The confidence bands for approximate matches (decision 32 — OPEN).
 * Above `MATCH_ACCEPT`: accept silently. Between the two: accept but flag
 * for one-tap confirmation. Below `MATCH_CONFIRM`: treat as unresolved.
 * Placeholders, deliberately named and kept in one place so tuning against
 * real receipts is a one-line change. Decision 67 measured that these also
 * hold for the CJK corpus — see `docs/product-decisions.md`.
 */
export const MATCH_ACCEPT = 0.85;
export const MATCH_CONFIRM = 0.6;

export type Script = 'han' | 'kana' | 'hangul' | 'latin' | 'mixed';

// Unicode block boundaries, spelled as \u{} escapes rather than the literal
// characters — a typed CJK literal is one keystroke away from a homoglyph at
// a different code point, and a wrong boundary here would silently
// misclassify scripts rather than fail loudly.
/** CJK Unified Ideographs, Extension A, and Compatibility Ideographs. */
const HAN = /[\u{4E00}-\u{9FFF}\u{3400}-\u{4DBF}\u{F900}-\u{FAFF}]/u;
/** Hiragana + Katakana, Katakana Phonetic Extensions, halfwidth Katakana. */
const KANA = /[\u{3040}-\u{30FF}\u{31F0}-\u{31FF}\u{FF65}-\u{FF9F}]/u;
/** Hangul Syllables, Jamo, Compatibility Jamo, Jamo Extended-A/B. */
const HANGUL =
  /[\u{AC00}-\u{D7A3}\u{1100}-\u{11FF}\u{3130}-\u{318F}\u{A960}-\u{A97F}\u{D7B0}-\u{D7FF}]/u;
const LATIN = /[A-Za-z]/;

/**
 * The dominant script of a string, by Unicode range counts. `mixed` is
 * returned when more than one script *family* is present — Han and Kana
 * count as one family here, since both use the same n-gram size and nothing
 * downstream needs to tell them apart to score correctly; Hangul and Latin
 * are the two families that actually need different handling.
 */
export function dominantScript(text: string): Script {
  let han = 0;
  let kana = 0;
  let hangul = 0;
  let latin = 0;
  for (const ch of text) {
    if (HAN.test(ch)) han += 1;
    else if (KANA.test(ch)) kana += 1;
    else if (HANGUL.test(ch)) hangul += 1;
    else if (LATIN.test(ch)) latin += 1;
  }

  const familiesPresent = [han + kana > 0, hangul > 0, latin > 0].filter(
    Boolean,
  ).length;
  if (familiesPresent === 0) return 'latin';
  if (familiesPresent > 1) return 'mixed';
  if (hangul > 0) return 'hangul';
  if (latin > 0) return 'latin';
  return kana > han ? 'kana' : 'han';
}

/**
 * Character trigrams with boundary padding (two spaces in front, one behind,
 * pg_trgm style) so short strings still produce a usable set.
 */
export function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 3; i += 1) {
    grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

/** Character bigrams, one-character padding on each side. */
export function bigrams(value: string): Set<string> {
  const padded = ` ${value} `;
  const grams = new Set<string>();
  for (let i = 0; i <= padded.length - 2; i += 1) {
    grams.add(padded.slice(i, i + 2));
  }
  return grams;
}

/**
 * Hangul syllable blocks are composed — a syllable decomposes into two or
 * three jamo. NFD decomposes a syllable before trigramming, so two words
 * sharing most of their letters score as similar even when they share no
 * whole syllable — treating Korean as the alphabetic script it is, rather
 * than as ideographic like Han. The decomposition happens here only:
 * nothing stores or displays this form (decision 31).
 */
function hangulTrigrams(value: string): Set<string> {
  return trigrams(value.normalize('NFD'));
}

/**
 * A mixed-script string is scored token by token, each token using its own
 * script's n-gram size, and the sets unioned. A short Latin brand token then
 * contributes only its own few grams rather than reshaping the whole
 * string's n-grams around word-boundary noise — which is what let a brand
 * prefix drown out the product name it was attached to.
 */
function mixedGrams(value: string): Set<string> {
  const tokens = value.split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length <= 1) return trigrams(value);

  const grams = new Set<string>();
  for (const token of tokens) {
    for (const gram of ngramsFor(token)) grams.add(gram);
  }
  return grams;
}

function ngramsFor(value: string): Set<string> {
  switch (dominantScript(value)) {
    case 'han':
    case 'kana':
      return bigrams(value);
    case 'hangul':
      return hangulTrigrams(value);
    case 'mixed':
      return mixedGrams(value);
    case 'latin':
    default:
      return trigrams(value);
  }
}

/**
 * Similarity in [0, 1]. Dice over a script-appropriate n-gram set,
 * discounted when the strings differ badly in length — which is what stops
 * `soy` matching `soy sauce dark` on containment alone, and (decision 67)
 * discourages short ideographic words from over-matching on shared bigrams.
 *
 * Han variant folding (traditional/simplified) is applied before scoring,
 * on both sides, so a reference and alias written in different variants of
 * the same characters still compare as identical (task 4a). Folding never
 * touches stored aliases or displayed names — it happens here, for scoring
 * only.
 */
/**
 * Only differences past this many-to-one are penalised; abbreviation is
 * normal on receipts and a mild mismatch should not drag a good n-gram
 * score down. Tuned against the Latin corpus (decision 32) — unchanged.
 */
const LATIN_LENGTH_RATIO_MULTIPLIER = 2;

/**
 * A CJK "word" is a two-to-four character compound, so any brand token at
 * all pushes a brand-plus-product reference well past a 2:1 character-length
 * ratio against a bare product alias — `李錦記 蠔油` (6 characters) against
 * `蠔油` (2) is 3:1 before the brand is even long. The Latin multiplier would
 * zero out a correct match on length alone. Measured against the CJK corpus
 * (decision 67, task 4.4): applies whenever either side is not pure Latin,
 * so it can never affect a Latin-vs-Latin comparison — decision 32's corpus
 * is unreachable by this constant.
 */
const CJK_LENGTH_RATIO_MULTIPLIER = 3;

export function similarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a === b) return 1;

  const foldedA = foldHanVariants(a);
  const foldedB = foldHanVariants(b);
  if (foldedA === foldedB) return 1;

  const gramsA = ngramsFor(foldedA);
  const gramsB = ngramsFor(foldedB);
  let shared = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) shared += 1;
  }
  const denominator = gramsA.size + gramsB.size;
  const dice = denominator === 0 ? 0 : (2 * shared) / denominator;

  const bothLatin =
    dominantScript(foldedA) === 'latin' && dominantScript(foldedB) === 'latin';
  const multiplier = bothLatin
    ? LATIN_LENGTH_RATIO_MULTIPLIER
    : CJK_LENGTH_RATIO_MULTIPLIER;
  const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  const penalty = Math.min(1, ratio * multiplier);

  return dice * penalty;
}
