/**
 * Normalises a raw food reference into its lookup form.
 *
 * Runs before every alias lookup; receipt matching lives or dies here. Pure —
 * no imports from `db` or `api`.
 *
 * Non-Latin scripts pass through untouched: the character classes below match
 * on Unicode letters, so 醬油 and 간장 survive every step and are never
 * transliterated (decision 31).
 *
 * `foldHanVariants` (decision 67, `add-cjk-matching`, task 4a) is exported
 * separately and NOT part of the main pipeline below — it is used by
 * `similarity.ts` for scoring only. Stored aliases and displayed names keep
 * whichever variant — simplified or traditional — they were written in.
 */

import itemAliasSeed from '../../assets/item-aliases.json';

/**
 * Store-brand prefixes stripped from the front of a receipt line, compared
 * after case-folding and punctuation removal (`TJ'S` arrives here as `tjs`).
 * Exported data rather than an inline literal so it can grow.
 */
export const STORE_BRAND_PREFIXES: readonly string[] = [
  'gv', // Great Value (Walmart)
  'tjs', // Trader Joe's
  'kro', // Kroger
  '365', // Whole Foods
  'sig', // Signature (Safeway/Albertsons)
  'eq', // Equate (Walmart)
  'ks', // Kirkland Signature (Costco)
  'sb', // Store brand, generic
];

/**
 * Store-specific prefixes, consulted first when the receipt's own store is
 * known (`add-receipt-import`) — knowing a receipt is from Trader Joe's
 * makes stripping `TJ'S` correct rather than speculative. Keyed by a
 * substring of the store name as printed, matched case-insensitively.
 */
const STORE_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  walmart: ['gv', 'eq'],
  'trader joe': ['tjs'],
  kroger: ['kro'],
  'whole foods': ['365'],
  safeway: ['sig'],
  albertsons: ['sig'],
  costco: ['ks'],
  target: ['gg', 'upup'], // Good & Gather, Up&Up
};

function prefixesForStore(store: string | undefined): readonly string[] {
  if (!store) return [];
  const key = store.toLowerCase();
  for (const [name, prefixes] of Object.entries(STORE_PREFIXES)) {
    if (key.includes(name)) return prefixes;
  }
  return [];
}

/**
 * Retailer abbreviation dictionary, applied token by token after size and
 * price stripping. Exported data so it can grow without touching the code.
 */
export const ABBREVIATIONS: Readonly<Record<string, string>> = {
  grn: 'green',
  bnch: 'bunch',
  chkn: 'chicken',
  ckn: 'chicken',
  bnls: 'boneless',
  sknls: 'skinless',
  org: 'organic',
  frz: 'frozen',
  slcd: 'sliced',
  swt: 'sweet',
  shrmp: 'shrimp',
  brst: 'breast',
  thgh: 'thigh',
  grnd: 'ground',
  lrg: 'large',
  hvy: 'heavy',
  pnut: 'peanut',
  veg: 'vegetable',
  whl: 'whole',
  wht: 'white',
  chse: 'cheese',
  ched: 'cheddar',
  tmto: 'tomato',
  onin: 'onion',
  bttr: 'butter',
  yog: 'yogurt',
  choc: 'chocolate',
};

/** `0.62 LB @ 0.59/LB`, `@ 2.99/EA` — the priced-by-weight tail of a line. */
const WEIGHT_PRICED_TAIL =
  /\d*\.?\d*\s*(lb|kg|g|oz|ea|ct)?\s*@\s*\$?\d+\.?\d*\s*(\/\s*(lb|kg|g|oz|ea|ct))?/gi;

/** `500ML`, `2 LB`, `12CT`, `1.5 L` — package size tokens. */
const SIZE_TOKEN =
  /(?<![\p{L}\p{N}])\d+\.?\d*\s*(ml|l|g|kg|mg|oz|lb|lbs|ct|pk|pc|pcs|pack|count|fl oz|floz|gal|qt|pt)(?![\p{L}])/giu;

/** Apostrophes vanish rather than split, so `TJ'S` folds to `tjs`. */
const APOSTROPHES = /['’]/g;

/** Everything that is not a Unicode letter, number, or whitespace. */
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

/**
 * Combining Diacritical Marks (U+0300–U+036F) — what Latin accents and
 * macrons decompose into under NFD. Built from numeric code points rather
 * than typed as a literal character range: combining marks render attached
 * to whatever precedes them, so a mistyped boundary would be invisible in
 * source. Deliberately narrow — Hangul syllables also decompose under NFD,
 * but into Hangul Jamo, a different block entirely, so this strip never
 * touches them. `stripDiacritics` decomposes, removes marks in this block
 * only, then recomposes — round-tripping anything it should not have
 * touched back to its original form.
 */
const LATIN_DIACRITIC = new RegExp(
  `[${String.fromCodePoint(0x0300)}-${String.fromCodePoint(0x036f)}]`,
  'g',
);

/**
 * `shōyu` and `shoyu` are one word, and only one of them is typeable on a
 * phone (task 4b.2, decision 67). NFD-then-strip-then-NFC round-trips any
 * script whose composed form does not involve this specific mark block —
 * confirmed for Hangul by `normalise.test.ts`.
 */
function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(LATIN_DIACRITIC, '').normalize('NFC');
}

interface AliasSeedEntry {
  alias: string;
  canonicalId: string;
  locale?: string;
}

/**
 * A traditional-character → simplified-character fold, for matching only
 * (task 4a). Built once, from the catalogue's own paired aliases — every
 * canonical that has both a `zh-Hans` and a `zh-Hant` alias of the same
 * length contributes whichever characters differ between them. This is
 * "generated from the catalogue" in the sense task 4a.2 asks for: it can
 * only ever contain characters the catalogue actually uses, and it grows
 * automatically as more paired aliases are seeded — there is no separate
 * table to remember to regenerate.
 */
function buildHanVariantFold(): ReadonlyMap<string, string> {
  // A canonical can carry more than one alias per locale — a real
  // simplified/traditional pair alongside an unrelated synonym in the same
  // script (shaoxing-wine has both `绍兴酒`/`紹興酒`, a variant pair, and
  // `料酒`, a different word for the same thing). Keeping every alias per
  // locale, rather than the last one seen, is what stops the synonym from
  // silently displacing the real pair.
  const byCanonical = new Map<string, { hans: string[]; hant: string[] }>();
  for (const entry of itemAliasSeed as AliasSeedEntry[]) {
    if (entry.locale !== 'zh-Hans' && entry.locale !== 'zh-Hant') continue;
    const bucket = byCanonical.get(entry.canonicalId) ?? { hans: [], hant: [] };
    if (entry.locale === 'zh-Hans') bucket.hans.push(entry.alias);
    else bucket.hant.push(entry.alias);
    byCanonical.set(entry.canonicalId, bucket);
  }

  const fold = new Map<string, string>();
  for (const { hans, hant } of byCanonical.values()) {
    for (const traditional of hant) {
      // More than one same-length Hans alias can sit on the same
      // canonical — a real variant pair still shares most characters
      // unchanged, where an unrelated same-length synonym typically shares
      // none (`醬油`/`酱油` share `油`; `醬油`/`生抽` share nothing). The
      // candidate with the most same-position matches is the pair; a tie
      // is genuinely ambiguous and skipped rather than guessed.
      let best: string | null = null;
      let bestOverlap = -1;
      let tied = false;
      for (const simplified of hans) {
        if (simplified.length !== traditional.length) continue;
        let overlap = 0;
        for (let i = 0; i < simplified.length; i += 1) {
          if (simplified[i] === traditional[i]) overlap += 1;
        }
        if (overlap > bestOverlap) {
          best = simplified;
          bestOverlap = overlap;
          tied = false;
        } else if (overlap === bestOverlap) {
          tied = true;
        }
      }
      if (!best || tied) continue;

      for (let i = 0; i < best.length; i += 1) {
        const simplifiedChar = best[i];
        const traditionalChar = traditional[i];
        if (
          simplifiedChar &&
          traditionalChar &&
          simplifiedChar !== traditionalChar
        ) {
          fold.set(traditionalChar, simplifiedChar);
        }
      }
    }
  }
  return fold;
}

const HAN_VARIANT_FOLD = buildHanVariantFold();

/**
 * Folds traditional Han characters to their simplified counterpart, where
 * the catalogue's own seed data establishes the mapping. Matching only —
 * never call this on a value that will be stored or displayed (decision 31,
 * task 4a.3).
 */
export function foldHanVariants(value: string): string {
  let out = '';
  for (const ch of value) out += HAN_VARIANT_FOLD.get(ch) ?? ch;
  return out;
}

export interface NormaliseOptions {
  /** The receipt's own store name, when known, e.g. "Trader Joe's". */
  store?: string;
}

/**
 * Reduces a raw reference (`KIKKO SOY 500ML`) to its matchable form
 * (`kikko soy`). Steps, in order: NFKC width/form fold, strip Latin
 * diacritics, case-fold, strip weight-priced tails, strip punctuation, strip
 * size tokens, expand retailer abbreviations, drop a leading store-brand
 * prefix, collapse whitespace.
 *
 * NFKC folding (task 3.1) maps full-width Latin (`ＫＩＫＫＯＭＡＮ`) and
 * half-width Kana (`ｼｮｳﾕ`) to their ordinary forms, so packaging and some
 * receipt encodings reach the same form as the seeded aliases. It runs
 * first, so every step after it sees canonical characters. Both this and
 * the diacritic strip are no-ops on plain ASCII and round-trip Hangul, so
 * neither changes the existing Latin or CJK test corpus.
 *
 * When a store is given, that store's own prefixes are consulted alongside
 * `STORE_BRAND_PREFIXES` rather than instead of it — the generic list stays
 * as the fallback, so a caller with no store keeps today's behaviour
 * exactly, and this signature stays valid for every existing single-argument
 * call site.
 */
export function normalise(raw: string, options?: NormaliseOptions): string {
  const folded = stripDiacritics(raw.normalize('NFKC'))
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(WEIGHT_PRICED_TAIL, ' ')
    .replace(PUNCTUATION, ' ')
    .replace(SIZE_TOKEN, ' ');

  let tokens = folded
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => ABBREVIATIONS[token] ?? token);

  const prefixes = [...prefixesForStore(options?.store), ...STORE_BRAND_PREFIXES];
  const first = tokens[0];
  if (tokens.length > 1 && first && prefixes.includes(first)) {
    tokens = tokens.slice(1);
  }

  return tokens.join(' ');
}
