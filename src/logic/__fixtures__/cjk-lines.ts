import type { OfflineExpectation, ReferenceFixture } from '@/logic/__fixtures__/receipt-lines';

/**
 * Real-shaped CJK references (decision 67, `add-cjk-matching`), the same
 * shape as `RECEIPT_LINES` — a raw string, the canonical it should mean, and
 * how far the offline cascade (steps 1 to 3, no API key) should get. Task
 * 1.1: at least 30 real references across Chinese, Japanese, and Korean,
 * brand-plus-name pairs, full-width and half-width variants, size tokens,
 * and traditional/simplified pairs. Every `offline` value below was measured
 * against the real cascade — real seed data, real migrations, real queries
 * (see `test/cascade.test.ts`'s CJK suite) — not asserted from reasoning.
 *
 * `李錦記 蠔油` is the flagship case: 0.27 before this change (decision 67),
 * 0.60 after — script-aware bigram scoring plus the CJK candidate prefilter
 * (task 5) together, not either alone. See `RECEIPT_LINES` for the same
 * fixture in the receipt corpus.
 */
export const CJK_LINES: readonly ReferenceFixture[] = [
  // Exact seeded aliases with a size token attached — the prefilter and
  // scorer are not exercised here, only that size-stripping still works
  // ahead of a non-Latin string.
  { raw: '白菜 500G', slug: 'napa-cabbage', offline: 'accept' },
  { raw: '豆腐 14OZ', slug: 'tofu-firm', offline: 'accept' },
  { raw: '고추장 500G', slug: 'gochujang', offline: 'accept' },
  { raw: '冷凍餃子', slug: 'frozen-dumplings', offline: 'accept' },
  { raw: '닭가슴살 1LB', slug: 'chicken-breast', offline: 'accept' },
  { raw: '삼겹살', slug: 'pork-belly', offline: 'accept' },
  { raw: '새우 1LB', slug: 'shrimp', offline: 'accept' },
  { raw: '椎茸 200G', slug: 'shiitake-mushroom', offline: 'accept' },
  { raw: '표고버섯', slug: 'shiitake-mushroom', offline: 'accept' },
  { raw: '생강', slug: 'ginger', offline: 'accept' },
  { raw: '大蒜', slug: 'garlic', offline: 'accept' },
  { raw: '고수', slug: 'cilantro', offline: 'accept' },
  { raw: '萝卜', slug: 'daikon', offline: 'accept' },
  { raw: '배추', slug: 'napa-cabbage', offline: 'accept' },
  { raw: '蚝油 400G', slug: 'oyster-sauce', offline: 'accept' },
  { raw: '豆瓣醬 250G', slug: 'doubanjiang', offline: 'accept' },
  { raw: '紹興酒 640ML', slug: 'shaoxing-wine', offline: 'accept' },
  { raw: 'xo醬', slug: 'xo-sauce', offline: 'accept' },
  { raw: '海天生抽 500ML', slug: 'soy-sauce-light', offline: 'accept' },

  // Brand-plus-product, in script. The structural failure this change
  // exists to fix — a short brand token pushes a bare product alias well
  // past the length ratio a Latin-tuned penalty would allow.
  { raw: '李錦記 蠔油 510ML', slug: 'oyster-sauce', offline: 'confirm' },
  { raw: 'CJ 고추장 500G', slug: 'gochujang', offline: 'confirm' },
  { raw: '연어 필렛', slug: 'salmon', offline: 'confirm' },
  { raw: 'たまご 12個', slug: 'eggs', offline: 'confirm' },

  // Han traditional/simplified variant, task 4a — matched only through
  // folding; `蚝油` above is the alias already seeded in simplified form,
  // this is the same product referenced in traditional characters instead.
  { raw: '蠔油', slug: 'oyster-sauce', offline: 'accept' },

  // Romanised references, task 4b — spelling and spacing variants of an
  // already-established canonical, seeded rather than transliterated.
  { raw: 'kochujang', slug: 'gochujang', offline: 'accept' },
  { raw: 'go chu jang paste', slug: 'gochujang', offline: 'confirm' },
  { raw: 'shoyu', slug: 'soy-sauce-light', offline: 'accept' },
  { raw: 'bak choy', slug: 'bok-choy', offline: 'accept' },
  { raw: "shōyu", slug: 'soy-sauce-light', offline: 'accept' },

  // Too little to work with locally: a Latin brand name of real length (not
  // an initialism) still drowns a two-character in-script product even with
  // the mixed-script and length-ratio changes, and a phonetic kana spelling
  // of a word seeded only in kanji is a different string, not a variant of
  // one. Both are honest limits, not bugs — the model resolves them once,
  // and write-back makes the cost one-time (decision 67).
  { raw: 'ＫＩＫＫＯＭＡＮ 醤油', slug: 'soy-sauce-light', offline: 'review' },
  { raw: 'ｼｮｳﾕ', slug: 'soy-sauce-light', offline: 'review' },
  // A real, different product with no seeded alias of its own — correctly
  // unresolved, not a gap in this change (non-goal: expanding the seed set).
  { raw: '오뚜기 진간장', slug: null, offline: 'review' },
];

/**
 * Deliberate near-miss pairs (task 1.2): different foods with short,
 * partially overlapping names, so over-matching is measured rather than
 * assumed absent. Every pair here resolves to its *own* canonical through
 * the real cascade (`test/cascade.test.ts`), never the other's.
 */
export const CJK_NEAR_MISSES: readonly [
  raw: string,
  slug: string,
  distinctFrom: string,
][] = [
  // Light vs dark soy sauce — share the second character, differ in kind.
  ['生抽', 'soy-sauce-light', 'soy-sauce-dark'],
  ['老抽', 'soy-sauce-dark', 'soy-sauce-light'],
  // Cilantro vs shiitake — share the first character (香, "fragrant").
  ['香菜', 'cilantro', 'shiitake-mushroom'],
  ['香菇', 'shiitake-mushroom', 'cilantro'],
  // Garlic vs ginger, Hangul — no shared syllable, and NFD jamo trigrams
  // must not manufacture one.
  ['마늘', 'garlic', 'ginger'],
  ['생강', 'ginger', 'garlic'],
  // Garlic vs ginger, single-character Han forms.
  ['蒜', 'garlic', 'ginger'],
  ['姜', 'ginger', 'garlic'],
  // Chicken breast vs thigh, Hangul — share the first syllable (닭, chicken).
  ['닭가슴살', 'chicken-breast', 'chicken-thigh'],
  ['닭다리살', 'chicken-thigh', 'chicken-breast'],
  // Romanised near-miss (task 4b.5) — loosening the Latin matcher for
  // romanisation must not let these collide.
  ['kochujang', 'gochujang', 'gochugaru'],
  ['gochugaru', 'gochugaru', 'gochujang'],
];

export type { OfflineExpectation };
