import type { DietaryRule, Suggestion, SuggestionMissing, SuggestionUse } from '@/types';

/**
 * Dietary rule sets and suggestion fixtures for `add-dietary-profile`
 * (task 1). The interesting failures here are all matching failures —
 * a derivative missed, an oblique name not caught, a direction reversed —
 * and none of them are visible without a corpus that deliberately goes
 * looking for them, the same reasoning behind `kitchens.ts` and
 * `dishPools.ts`.
 */

let counter = 0;
function nextId(): string {
  counter += 1;
  return `rule-${counter}`;
}

export function rule(
  overrides: Partial<DietaryRule> & Pick<DietaryRule, 'kind' | 'text'>,
): DietaryRule {
  const text = overrides.text;
  return {
    id: nextId(),
    canonicalId: null,
    normalisedText: text.toLowerCase(),
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* 1.1 — rule sets (at least 12)                                             */
/* -------------------------------------------------------------------------- */

export const RULE_SETS: Readonly<Record<string, readonly DietaryRule[]>> = {
  singleAllergen: [rule({ kind: 'allergen', canonicalId: 'milk', text: 'Milk' })],

  severalAllergens: [
    rule({ kind: 'allergen', canonicalId: 'milk', text: 'Milk' }),
    rule({ kind: 'allergen', canonicalId: 'peanut', text: 'Peanuts' }),
    rule({ kind: 'allergen', canonicalId: 'shellfish', text: 'Shellfish' }),
  ],

  restrictionAlone: [
    rule({ kind: 'restriction', canonicalId: 'pork-belly', text: 'No pork' }),
  ],

  restrictionPlusDislikes: [
    rule({ kind: 'restriction', canonicalId: 'pork-belly', text: 'No pork' }),
    rule({ kind: 'dislike', canonicalId: 'cilantro', text: 'Cilantro' }),
    rule({ kind: 'dislike', canonicalId: 'shiitake-mushroom', text: 'Mushrooms' }),
  ],

  unresolvableAllergen: [
    rule({ kind: 'allergen', canonicalId: null, text: 'Durian', normalisedText: 'durian' }),
  ],

  dislikeAlone: [rule({ kind: 'dislike', canonicalId: 'cilantro', text: 'Cilantro' })],

  wheatAllergen: [rule({ kind: 'allergen', canonicalId: 'wheat', text: 'Wheat' })],

  soyAllergen: [rule({ kind: 'allergen', canonicalId: 'soy', text: 'Soy' })],

  sesameAllergen: [rule({ kind: 'allergen', canonicalId: 'sesame', text: 'Sesame' })],

  fishAllergen: [rule({ kind: 'allergen', canonicalId: 'fish', text: 'Fish' })],

  eggAllergen: [rule({ kind: 'allergen', canonicalId: 'eggs', text: 'Eggs' })],

  allergenPlusRestriction: [
    rule({ kind: 'allergen', canonicalId: 'milk', text: 'Milk' }),
    rule({ kind: 'restriction', canonicalId: 'pork-belly', text: 'No pork' }),
  ],

  /** Over ten rules, mixing every kind — the prompt-length case task 6.9 measures against. */
  heavilyRestricted: [
    rule({ kind: 'allergen', canonicalId: 'milk', text: 'Milk' }),
    rule({ kind: 'allergen', canonicalId: 'peanut', text: 'Peanuts' }),
    rule({ kind: 'allergen', canonicalId: 'tree-nut', text: 'Tree nuts' }),
    rule({ kind: 'allergen', canonicalId: 'shellfish', text: 'Shellfish' }),
    rule({ kind: 'allergen', canonicalId: 'sesame', text: 'Sesame' }),
    rule({ kind: 'allergen', canonicalId: null, text: 'Durian', normalisedText: 'durian' }),
    rule({ kind: 'restriction', canonicalId: 'pork-belly', text: 'No pork' }),
    rule({ kind: 'restriction', canonicalId: 'bacon', text: 'No bacon' }),
    rule({ kind: 'dislike', canonicalId: 'cilantro', text: 'Cilantro' }),
    rule({ kind: 'dislike', canonicalId: 'shiitake-mushroom', text: 'Mushrooms' }),
    rule({ kind: 'dislike', canonicalId: 'white-pepper', text: 'White pepper' }),
  ],
};

/* -------------------------------------------------------------------------- */
/* 1.2–1.4 — suggestion fixtures (at least 20)                                */
/* -------------------------------------------------------------------------- */

function use(canonicalId: string): SuggestionUse {
  return { canonicalId, qty: 1, unit: 'g' };
}

function missing(name: string, canonicalId: string | null = null): SuggestionMissing {
  return { canonicalId, name, note: null };
}

function dish(
  name: string,
  uses: SuggestionUse[],
  missingItems: SuggestionMissing[] = [],
): Pick<Suggestion, 'dish' | 'uses' | 'missing'> {
  return { dish: name, uses, missing: missingItems };
}

/**
 * Named so each fixture's purpose is legible at the call site — task 1.2's
 * "a dish naming butter but not milk" is `dishes.butterNotMilk`, not
 * `dishes[7]`.
 */
export const DIETARY_SUGGESTIONS: Readonly<Record<string, Pick<Suggestion, 'dish' | 'uses' | 'missing'>>> = {
  // 1.2 — derivative relation, the direct-ingredient case never named.
  butterNotMilk: dish('Garlic butter rice', [use('butter'), use('jasmine-rice')]),
  gheeNotMilk: dish('Ghee-fried rice', [use('ghee'), use('jasmine-rice')]),
  cheddarNotMilk: dish('Cheddar rice bowl', [use('cheddar-cheese'), use('jasmine-rice')]),
  fishSauceNotFish: dish('Fish sauce noodles', [use('fish-sauce'), use('dried-pasta')]),
  salmonIsFish: dish('Seared salmon', [use('salmon')]),
  oysterSauceNotShellfish: dish('Oyster sauce greens', [use('oyster-sauce'), use('bok-choy')]),
  shrimpIsShellfish: dish('Garlic shrimp', [use('shrimp')]),
  mayonnaiseNotEgg: dish('Egg-free-looking chicken salad', [use('mayonnaise'), use('chicken-breast')]),
  peanutButterNotPeanut: dish('Peanut noodles', [use('peanut-butter'), use('dried-pasta')]),
  tahiniNotSesame: dish('Tahini drizzle greens', [use('tahini'), use('bok-choy')]),
  sesameOilNotSesame: dish('Sesame oil noodles', [use('sesame-oil'), use('dried-pasta')]),
  sesameSeedDirect: dish('Sesame chicken', [use('sesame'), use('chicken-breast')]),
  soySauceNotSoy: dish('Soy-glazed salmon', [use('soy-sauce-light'), use('salmon')]),
  misoNotSoy: dish('Miso soup', [use('miso'), use('tofu-firm')]),
  wheatFlourDirect: dish('Simple flatbread', [use('all-purpose-flour')]),
  pastaIsWheat: dish('Plain pasta', [use('dried-pasta')]),
  tamariIsNotWheat: dish('Tamari rice bowl', [use('tamari'), use('jasmine-rice')]), // deliberately wheat-free
  noDerivativeInvolved: dish('Plain steamed rice', [use('jasmine-rice')]),

  // 1.3 — oblique names, the honest test of the unknown rule.
  seafoodStockOblique: dish('Seafood chowder', [use('jasmine-rice')], [missing('seafood stock')]),
  mixedNutsOblique: dish('Trail mix bowl', [use('jasmine-rice')], [missing('mixed nuts')]),
  vegetableOilBlendOblique: dish('Stir-fried greens', [use('bok-choy')], [missing('vegetable oil blend')]),
  unnamedSpiceBlendOblique: dish('Spiced chicken', [use('chicken-breast')], [missing('house spice blend')]),

  // 1.4 — Asian derivatives specifically (decision 4's audience).
  hoisinIsSoyAndWheat: dish('Hoisin glazed pork', [use('hoisin-sauce'), use('pork-belly')]),
  gochujangIsSoyAndWheat: dish('Gochujang chicken', [use('gochujang'), use('chicken-breast')]),
  belacanIsShellfish: dish('Belacan fried rice', [use('belacan'), use('jasmine-rice')]),
  xoSauceIsShellfish: dish('XO sauce noodles', [use('xo-sauce'), use('dried-pasta')]),
};
