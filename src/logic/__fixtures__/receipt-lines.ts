/**
 * Real-shaped receipt strings, each paired with the canonical it should end
 * at and how far the *offline* cascade (steps 1 to 3, no API key) should get:
 *
 * - `accept`  — resolves silently, by exact alias or a high approximate score
 * - `confirm` — resolves but is flagged for one-tap confirmation
 * - `review`  — lands in the review queue; step 4 (the model) would take it
 *
 * The `review` rows are not failures: a receipt string the local cascade
 * cannot read costs one model call once, then is free forever via alias
 * write-back. The `confirm` set is the tuning evidence for decision 32.
 */

export type OfflineExpectation = 'accept' | 'confirm' | 'review';

export interface ReferenceFixture {
  raw: string;
  /** The canonical the reference means. Null for lines that are not food. */
  slug: string | null;
  offline: OfflineExpectation;
}

export const RECEIPT_LINES: readonly ReferenceFixture[] = [
  // Exact alias hits after normalisation strips sizes, brands, and prices.
  { raw: 'KIKKO SOY 500ML', slug: 'soy-sauce-light', offline: 'accept' },
  { raw: 'GV SOY SAUCE 15OZ', slug: 'soy-sauce-light', offline: 'accept' },
  { raw: 'LKK OYSTER SAUCE', slug: 'oyster-sauce', offline: 'accept' },
  { raw: 'OYSTER SAUCE 510G', slug: 'oyster-sauce', offline: 'accept' },
  { raw: 'FISH SAUCE 24OZ', slug: 'fish-sauce', offline: 'accept' },
  { raw: 'SHAOXING WINE 640ML', slug: 'shaoxing-wine', offline: 'accept' },
  { raw: 'MIRIN 300ML', slug: 'mirin', offline: 'accept' },
  { raw: 'BELACAN 250G', slug: 'belacan', offline: 'accept' },
  { raw: 'SESAME OIL 250ML', slug: 'sesame-oil', offline: 'accept' },
  { raw: 'RICE VINEGAR 296ML', slug: 'rice-vinegar', offline: 'accept' },
  { raw: 'SRIRACHA 17OZ', slug: 'sriracha', offline: 'accept' },
  { raw: 'JASMINE RICE 5LB', slug: 'jasmine-rice', offline: 'accept' },
  { raw: 'SPAGHETTI 16OZ', slug: 'dried-pasta', offline: 'accept' },
  { raw: 'ROLLED OATS 42OZ', slug: 'oats', offline: 'accept' },
  { raw: 'AP FLOUR 5LB', slug: 'all-purpose-flour', offline: 'accept' },
  { raw: 'BANANAS 0.62 LB @ 0.59/LB', slug: 'banana', offline: 'accept' },
  { raw: 'BOK CHOY 1.24 LB @ 1.99/LB', slug: 'bok-choy', offline: 'accept' },
  { raw: 'GRND PORK 1LB', slug: 'ground-pork', offline: 'accept' },
  { raw: 'LRG EGGS 12CT', slug: 'eggs', offline: 'accept' },
  { raw: 'WHL MILK 1GAL', slug: 'milk', offline: 'accept' },
  { raw: '2% MILK', slug: 'milk', offline: 'accept' },
  { raw: "TJ'S FRZ DUMPLINGS", slug: 'frozen-dumplings', offline: 'accept' },
  { raw: 'GRN ONION BNCH', slug: 'green-onion', offline: 'accept' },

  // CJK receipt lines, in script end to end (decision 31).
  { raw: '白菜', slug: 'napa-cabbage', offline: 'accept' },
  { raw: '豆腐', slug: 'tofu-firm', offline: 'accept' },
  { raw: '海天生抽', slug: 'soy-sauce-light', offline: 'accept' },
  { raw: '冷凍餃子', slug: 'frozen-dumplings', offline: 'accept' },
  { raw: '고추장 500G', slug: 'gochujang', offline: 'accept' },

  // Approximate matches: abbreviation or word-order noise the trigram
  // scorer has to absorb. Expected band measured against the scorer.
  { raw: 'GOCHUJANG PASTE 500G', slug: 'gochujang', offline: 'confirm' },
  { raw: 'MISO PASTE WHT', slug: 'miso', offline: 'confirm' },
  { raw: 'KECAP MANIS ABC 600ML', slug: 'kecap-manis', offline: 'accept' },
  { raw: 'ORG CHKN BRST BNLS', slug: 'chicken-breast', offline: 'confirm' },
  { raw: 'CHKN THGH BNLS', slug: 'chicken-thigh', offline: 'accept' },
  { raw: 'PORK BELLY SLCD', slug: 'pork-belly', offline: 'confirm' },
  { raw: '365 ORG PNUT BUTTER', slug: 'peanut-butter', offline: 'confirm' },
  { raw: 'ATLANTIC SALMON FIL', slug: 'salmon', offline: 'accept' },
  { raw: 'SHREDDED CHED CHSE', slug: 'cheddar-cheese', offline: 'accept' },
  { raw: 'GREEK YOG PLAIN 32OZ', slug: 'greek-yogurt', offline: 'accept' },
  { raw: 'HVY CREAM PINT', slug: 'heavy-cream', offline: 'confirm' },
  { raw: 'SIG OLIVE OIL EV 750ML', slug: 'olive-oil', offline: 'accept' },
  { raw: 'TOFU FIRM 14OZ', slug: 'tofu-firm', offline: 'confirm' },
  { raw: 'NAPA CABBAGE HEAD', slug: 'napa-cabbage', offline: 'confirm' },
  { raw: 'SHRMP RAW 1LB', slug: 'shrimp', offline: 'confirm' },

  // Brand-led lines the scorer still reads, at reduced confidence.
  { raw: 'CJ GOCHUJANG 1KG', slug: 'gochujang', offline: 'confirm' },
  { raw: '3 CRABS FISH SAUCE', slug: 'fish-sauce', offline: 'confirm' },

  // Too mangled or too brand-specific for local steps: queued for the model
  // or for review, and learned as aliases once resolved.
  { raw: '李錦記 蠔油', slug: 'oyster-sauce', offline: 'review' },
  { raw: 'KS ORG EVOO 2L', slug: 'olive-oil', offline: 'review' },
];

/** Lines that are not food at all. The cascade must queue, never throw. */
export const NON_FOOD_LINES: readonly string[] = [
  'GIFT WRAP RIBBON',
  'AA BATTERIES 4PK',
  'PAPER TOWELS 6CT',
  'DISH SOAP REFILL',
];
