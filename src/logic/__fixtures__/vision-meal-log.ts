import type { ReferenceFixture } from './receipt-lines';

/**
 * The same foods as the receipt fixtures, phrased the way the vision
 * estimator and the meal log produce them — full descriptions and generic
 * ingredient names rather than retail abbreviations. Every channel must
 * reach the same canonical (see `docs/identity-layer.md`).
 */

export const VISION_REFERENCES: readonly ReferenceFixture[] = [
  { raw: 'Kikkoman soy sauce, 500ml bottle', slug: 'soy-sauce-light', offline: 'confirm' },
  { raw: 'Lee Kum Kee oyster sauce', slug: 'oyster-sauce', offline: 'accept' },
  { raw: 'toasted sesame oil', slug: 'sesame-oil', offline: 'accept' },
  { raw: 'extra firm tofu', slug: 'tofu-firm', offline: 'accept' },
  { raw: 'steamed jasmine rice', slug: 'jasmine-rice', offline: 'confirm' },
  { raw: 'shiitake mushrooms', slug: 'shiitake-mushroom', offline: 'accept' },
  { raw: 'boneless skinless chicken breast', slug: 'chicken-breast', offline: 'accept' },
  { raw: 'plain greek yogurt', slug: 'greek-yogurt', offline: 'accept' },
];

export const MEAL_LOG_REFERENCES: readonly ReferenceFixture[] = [
  { raw: 'soy sauce', slug: 'soy-sauce-light', offline: 'accept' },
  { raw: 'scallions', slug: 'green-onion', offline: 'accept' },
  { raw: 'spring onions', slug: 'green-onion', offline: 'accept' },
  { raw: 'gochujang', slug: 'gochujang', offline: 'accept' },
  { raw: 'korean chili paste', slug: 'gochujang', offline: 'accept' },
  { raw: '간장', slug: 'soy-sauce-light', offline: 'accept' },
  { raw: '醬油', slug: 'soy-sauce-light', offline: 'accept' },
  { raw: 'firm tofu', slug: 'tofu-firm', offline: 'accept' },
  { raw: 'pak choi', slug: 'bok-choy', offline: 'accept' },
  { raw: 'prawns', slug: 'shrimp', offline: 'accept' },
  { raw: 'minced pork', slug: 'ground-pork', offline: 'accept' },
  { raw: 'whole milk', slug: 'milk', offline: 'accept' },
  { raw: 'cheddar', slug: 'cheddar-cheese', offline: 'accept' },
  { raw: 'olive oil', slug: 'olive-oil', offline: 'accept' },
  { raw: 'gyoza', slug: 'frozen-dumplings', offline: 'accept' },
  { raw: '만두', slug: 'frozen-dumplings', offline: 'accept' },
  { raw: 'coriander leaves', slug: 'cilantro', offline: 'confirm' },
  { raw: 'fried egg', slug: 'eggs', offline: 'review' },
  { raw: 'cooking wine', slug: 'shaoxing-wine', offline: 'confirm' },
];
