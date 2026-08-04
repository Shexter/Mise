/**
 * Normalises a raw food reference into its lookup form.
 *
 * Runs before every alias lookup; receipt matching lives or dies here. Pure —
 * no imports from `db` or `api`.
 *
 * Non-Latin scripts pass through untouched: the character classes below match
 * on Unicode letters, so 醬油 and 간장 survive every step and are never
 * transliterated (decision 31).
 */

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

export interface NormaliseOptions {
  /** The receipt's own store name, when known, e.g. "Trader Joe's". */
  store?: string;
}

/**
 * Reduces a raw reference (`KIKKO SOY 500ML`) to its matchable form
 * (`kikko soy`). Steps, in order: case-fold, strip weight-priced tails,
 * strip punctuation, strip size tokens, expand retailer abbreviations,
 * drop a leading store-brand prefix, collapse whitespace.
 *
 * When a store is given, that store's own prefixes are consulted alongside
 * `STORE_BRAND_PREFIXES` rather than instead of it — the generic list stays
 * as the fallback, so a caller with no store keeps today's behaviour
 * exactly, and this signature stays valid for every existing single-argument
 * call site.
 */
export function normalise(raw: string, options?: NormaliseOptions): string {
  const folded = raw
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
