import { catalogueNutrition } from '@/logic/nutrition';
import { snapshotMealPrepTemplate } from '@/logic/plannerRecipe';
import type {
  ApplianceId,
  CanonicalItem,
  CookingGuideStep,
  MealPrepTemplate,
  MeasureUnit,
  PlannedMealType,
  PlannerRecipeSnapshot,
} from '@/types';

/**
 * The reviewed planning collection (tasks 2.3–2.5).
 *
 * Three rules shaped every entry, and the audit below enforces all three so a
 * later edit cannot quietly break them:
 *
 * 1. **Nutrition is computed, never authored.** Not one calorie or gram in this
 *    file is typed by hand. Every ingredient names a canonical id whose per-100 g
 *    figures come from the shipped catalogue, which cites a specific USDA
 *    FoodData Central record per field. `snapshotCatalogueRecipe` runs those
 *    through the same `catalogueNutrition` path the rest of the app uses, so an
 *    unresolvable ingredient produces `null` rather than a plausible number.
 * 2. **Every amount is in grams, and states how to weigh it.** The catalogue has
 *    no weight-per-piece for any ingredient and a density for only 13 of 116, so
 *    `piece`, `cup` and `tbsp` amounts convert to null. Grams always convert.
 *    `preparation` then says which weight the cited source record means — "raw",
 *    "dry", "drained" — because 600 g of raw chicken and 600 g of cooked chicken
 *    are different foods with different numbers.
 * 3. **No pantry gate.** Selection here is by meal type, cuisine, equipment and
 *    dietary exclusion only. A recipe whose every ingredient must be bought is a
 *    normal planning choice, so nothing in this module accepts pantry stock —
 *    see `plannerRecipeEligible`, which has no stock parameter either.
 *
 * Amounts, methods, times, yields and titles ARE authored. They are ordinary
 * recipe judgement, offered for review, and are not claimed to be tested.
 * `docs/planner-catalogue-provenance.md` records the per-ingredient citations
 * and the gaps that shaped the collection.
 */

/** Foods an instruction may name without a grocery line, because they are not bought. */
export const ASSUMED_ON_HAND: readonly string[] = ['water', 'ice'];

export interface PlannerCatalogueIngredient {
  canonicalId: string;
  /** Shown to the cook. Must agree with the term the steps use. */
  name: string;
  /** Always grams, for the recipe's `baseYield`. */
  grams: number;
  /**
   * Which weight this is, matching the basis of the catalogue's cited source
   * record. Copied onto the snapshot so a scaled amount stays interpretable.
   */
  preparation: string;
  optional?: boolean;
}

export interface PlannerCatalogueRecipe {
  id: string;
  /** Bumped when ingredients, amounts or steps change, so saved weeks can detect it. */
  version: string;
  title: string;
  mealTypes: readonly PlannedMealType[];
  cuisines: readonly string[];
  baseYield: number;
  durationMinutes: number;
  requiredAppliances: readonly ApplianceId[];
  ingredients: readonly PlannerCatalogueIngredient[];
  steps: readonly CookingGuideStep[];
  /** Why this entry is in the collection. Never a health or dietary claim. */
  note: string;
}

/* -------------------------------------------------------------------------- */
/* The collection                                                             */
/* -------------------------------------------------------------------------- */

const OVERNIGHT_OATS: PlannerCatalogueRecipe = {
  id: 'planner-overnight-oats-banana-peanut',
  version: '1',
  title: 'Overnight oats with banana and peanut butter',
  mealTypes: ['breakfast'],
  cuisines: ['International'],
  baseYield: 1,
  durationMinutes: 5,
  requiredAppliances: [],
  ingredients: [
    { canonicalId: 'oats', name: 'Rolled oats', grams: 45, preparation: 'dry, measured before soaking' },
    { canonicalId: 'greek-yogurt', name: 'Greek yogurt', grams: 170, preparation: 'plain low-fat, as sold' },
    { canonicalId: 'banana', name: 'Banana', grams: 100, preparation: 'peeled, raw' },
    { canonicalId: 'peanut-butter', name: 'Peanut butter', grams: 16, preparation: 'creamy, as sold' },
    { canonicalId: 'honey', name: 'Honey', grams: 10, preparation: 'as sold' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Stir the rolled oats, Greek yogurt and honey together in a jar or bowl.', applianceId: null, actionType: 'no_cook', durationMinutes: 3 },
    { stepNumber: 2, instruction: 'Cover and leave in the fridge overnight, or at least four hours.', applianceId: null, actionType: 'store', durationMinutes: null },
    { stepNumber: 3, instruction: 'Slice the banana over the top and spoon the peanut butter beside it just before eating.', applianceId: null, actionType: 'assemble', durationMinutes: 2 },
  ],
  note: 'The no-cook breakfast. Nothing is heated and no appliance is needed, so it works with no kitchen set up at all.',
};

const MISO_MORNING_SOUP: PlannerCatalogueRecipe = {
  id: 'planner-miso-tofu-morning-soup',
  version: '1',
  title: 'Miso soup with tofu, shiitake and bok choy',
  mealTypes: ['breakfast', 'lunch'],
  cuisines: ['Japanese'],
  baseYield: 1,
  durationMinutes: 15,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'tofu-firm', name: 'Firm tofu', grams: 120, preparation: 'extra firm, drained, cut into cubes' },
    { canonicalId: 'shiitake-mushroom', name: 'Shiitake mushroom', grams: 50, preparation: 'fresh, stems removed, sliced' },
    { canonicalId: 'bok-choy', name: 'Bok choy', grams: 80, preparation: 'raw, trimmed and separated into leaves' },
    { canonicalId: 'miso', name: 'Miso', grams: 18, preparation: 'as sold' },
    { canonicalId: 'ginger', name: 'Ginger', grams: 4, preparation: 'raw, peeled and cut into fine strips' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 4, preparation: 'as sold' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Bring 400 ml of water to a gentle simmer and add the ginger and shiitake mushroom.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 5 },
    { stepNumber: 2, instruction: 'Add the bok choy and firm tofu and simmer until the leaves soften.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 4 },
    { stepNumber: 3, instruction: 'Take the pan off the heat, then whisk the miso with a ladle of the hot liquid and stir it back in. Boiling miso after this point dulls it.', applianceId: 'cooktop', actionType: 'assemble', durationMinutes: 2 },
    { stepNumber: 4, instruction: 'Finish with the sesame oil.', applianceId: null, actionType: 'assemble', durationMinutes: 1 },
  ],
  note: 'A savoury Asian breakfast that is also a light lunch. Every nutrient resolves, including fibre.',
};

const SAVOURY_OAT_PORRIDGE: PlannerCatalogueRecipe = {
  id: 'planner-savoury-oat-porridge-shiitake',
  version: '1',
  title: 'Savoury oat porridge with shiitake and ginger',
  mealTypes: ['breakfast'],
  cuisines: ['Chinese'],
  baseYield: 1,
  durationMinutes: 20,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'oats', name: 'Rolled oats', grams: 60, preparation: 'dry, measured before cooking' },
    { canonicalId: 'shiitake-mushroom', name: 'Shiitake mushroom', grams: 70, preparation: 'fresh, stems removed, sliced' },
    { canonicalId: 'tamari', name: 'Tamari', grams: 12, preparation: 'as sold' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 5, preparation: 'as sold' },
    { canonicalId: 'ginger', name: 'Ginger', grams: 5, preparation: 'raw, peeled and grated' },
    { canonicalId: 'cilantro', name: 'Cilantro', grams: 5, preparation: 'raw leaves' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Warm the sesame oil, then cook the shiitake mushroom and ginger until the mushrooms give up their liquid.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 5 },
    { stepNumber: 2, instruction: 'Add the rolled oats and 350 ml of water and simmer, stirring, until it thickens to a porridge.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 10 },
    { stepNumber: 3, instruction: 'Season with the tamari off the heat and scatter the cilantro over the top.', applianceId: null, actionType: 'assemble', durationMinutes: 2 },
  ],
  note: 'Savoury oats stand in for a rice congee. The catalogue has no nutrition for any rice, so a real congee could not be costed honestly; this can.',
};

const SMASHED_CUCUMBER_SALAD: PlannerCatalogueRecipe = {
  id: 'planner-smashed-cucumber-tofu-salad',
  version: '1',
  title: 'Smashed cucumber and sesame tofu salad',
  mealTypes: ['lunch'],
  cuisines: ['Chinese'],
  baseYield: 2,
  durationMinutes: 15,
  requiredAppliances: [],
  ingredients: [
    { canonicalId: 'cucumber', name: 'Cucumber', grams: 400, preparation: 'raw, with peel, smashed and torn' },
    { canonicalId: 'tofu-firm', name: 'Firm tofu', grams: 300, preparation: 'extra firm, drained, cut into cubes' },
    { canonicalId: 'peanut', name: 'Peanuts', grams: 40, preparation: 'raw, roughly chopped' },
    { canonicalId: 'tamari', name: 'Tamari', grams: 20, preparation: 'as sold' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 10, preparation: 'as sold' },
    { canonicalId: 'sesame', name: 'Sesame seeds', grams: 10, preparation: 'whole dried seeds, toasted in a dry pan' },
    { canonicalId: 'sriracha', name: 'Sriracha', grams: 10, preparation: 'as sold' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 8, preparation: 'raw, minced' },
    { canonicalId: 'cilantro', name: 'Cilantro', grams: 10, preparation: 'raw leaves' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Smash the cucumber with the flat of a knife until it splits, then tear it into rough pieces and drain for ten minutes.', applianceId: null, actionType: 'prep', durationMinutes: 10 },
    { stepNumber: 2, instruction: 'Whisk the tamari, sesame oil, sriracha and garlic into a dressing.', applianceId: null, actionType: 'no_cook', durationMinutes: 3 },
    { stepNumber: 3, instruction: 'Fold the firm tofu and cucumber through the dressing and top with the peanuts, sesame seeds and cilantro.', applianceId: null, actionType: 'assemble', durationMinutes: 2 },
  ],
  note: 'A second no-cook option, at lunch rather than breakfast. Tamari rather than soy sauce, so it carries no wheat.',
};

const GINGER_CHICKEN_STIR_FRY: PlannerCatalogueRecipe = {
  id: 'planner-ginger-chicken-bok-choy',
  version: '1',
  title: 'Ginger chicken with bok choy and shiitake',
  mealTypes: ['lunch', 'dinner'],
  cuisines: ['Chinese'],
  baseYield: 4,
  durationMinutes: 30,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'chicken-breast', name: 'Chicken breast', grams: 600, preparation: 'raw, boneless and skinless — weigh before cooking' },
    { canonicalId: 'bok-choy', name: 'Bok choy', grams: 400, preparation: 'raw, trimmed and halved lengthways' },
    { canonicalId: 'shiitake-mushroom', name: 'Shiitake mushroom', grams: 200, preparation: 'fresh, stems removed, sliced' },
    { canonicalId: 'soy-sauce-light', name: 'Light soy sauce', grams: 40, preparation: 'as sold — this shoyu is brewed from soy and wheat' },
    { canonicalId: 'oyster-sauce', name: 'Oyster sauce', grams: 30, preparation: 'as sold' },
    { canonicalId: 'ginger', name: 'Ginger', grams: 20, preparation: 'raw, peeled and julienned' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 15, preparation: 'raw, sliced' },
    { canonicalId: 'vegetable-oil', name: 'Vegetable oil', grams: 20, preparation: 'as sold' },
    { canonicalId: 'white-pepper', name: 'White pepper', grams: 1, preparation: 'ground' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Slice the chicken breast thinly across the grain and toss it with the light soy sauce and white pepper.', applianceId: null, actionType: 'prep', durationMinutes: 8 },
    { stepNumber: 2, instruction: 'Get the vegetable oil hot, then sear the chicken breast in two batches so it browns rather than steams. Set it aside.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 8 },
    { stepNumber: 3, instruction: 'Fry the ginger and garlic for thirty seconds, then add the shiitake mushroom and bok choy and cook until the stems are just tender.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 6 },
    { stepNumber: 4, instruction: 'Return the chicken breast, stir the oyster sauce through, and divide into four portions.', applianceId: 'cooktop', actionType: 'store', durationMinutes: 3 },
  ],
  note: 'The batch fixture the design describes: 600 g of one ingredient across four one-portion lunches, so grocery demand is 600 g and not 2,400 g.',
};

const GARLIC_SHRIMP_TOMATO: PlannerCatalogueRecipe = {
  id: 'planner-garlic-shrimp-tomato',
  version: '1',
  title: 'Garlic shrimp with roma tomatoes',
  mealTypes: ['lunch', 'dinner'],
  cuisines: ['Mediterranean'],
  baseYield: 3,
  durationMinutes: 20,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'shrimp', name: 'Shrimp', grams: 450, preparation: 'raw, peeled and deveined — weigh before cooking' },
    { canonicalId: 'tomato', name: 'Tomato', grams: 400, preparation: 'roma, raw, quartered' },
    { canonicalId: 'olive-oil', name: 'Olive oil', grams: 30, preparation: 'as sold' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 15, preparation: 'raw, thinly sliced' },
    { canonicalId: 'lime', name: 'Lime', grams: 20, preparation: 'raw, edible portion, squeezed over at the end' },
    { canonicalId: 'cilantro', name: 'Cilantro', grams: 10, preparation: 'raw leaves' },
    { canonicalId: 'salt', name: 'Salt', grams: 3, preparation: 'table salt' },
    { canonicalId: 'black-pepper', name: 'Black pepper', grams: 1, preparation: 'ground' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Warm the olive oil and garlic together over a low heat until the garlic is fragrant but not coloured.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 4 },
    { stepNumber: 2, instruction: 'Raise the heat, add the tomato and cook until it collapses into a loose sauce.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 8 },
    { stepNumber: 3, instruction: 'Add the shrimp and cook only until opaque, then season with the salt and black pepper.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 4 },
    { stepNumber: 4, instruction: 'Squeeze the lime over and scatter the cilantro on top.', applianceId: null, actionType: 'assemble', durationMinutes: 2 },
  ],
  note: 'Non-Asian coverage, and a recipe whose every ingredient is normally bought for the occasion rather than kept in stock.',
};

const PORK_BELLY_BRAISE: PlannerCatalogueRecipe = {
  id: 'planner-pork-belly-bok-choy-braise',
  version: '1',
  title: 'Soy-braised pork belly with bok choy',
  mealTypes: ['dinner'],
  cuisines: ['Chinese'],
  baseYield: 4,
  durationMinutes: 90,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'pork-belly', name: 'Pork belly', grams: 600, preparation: 'fresh, raw, cut into cubes — weigh before cooking' },
    { canonicalId: 'bok-choy', name: 'Bok choy', grams: 400, preparation: 'raw, trimmed and halved lengthways' },
    { canonicalId: 'soy-sauce-light', name: 'Light soy sauce', grams: 50, preparation: 'as sold — this shoyu is brewed from soy and wheat' },
    { canonicalId: 'hoisin-sauce', name: 'Hoisin sauce', grams: 30, preparation: 'as sold' },
    { canonicalId: 'ginger', name: 'Ginger', grams: 20, preparation: 'raw, peeled and sliced into coins' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 15, preparation: 'raw, lightly crushed' },
    { canonicalId: 'sugar', name: 'Sugar', grams: 12, preparation: 'granulated' },
    { canonicalId: 'white-pepper', name: 'White pepper', grams: 2, preparation: 'ground' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Brown the pork belly cubes in a dry heavy pan until the fat renders and the edges colour. Pour off most of the rendered fat.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 12 },
    { stepNumber: 2, instruction: 'Add the ginger, garlic, sugar, light soy sauce and hoisin sauce with enough water to almost cover.', applianceId: 'cooktop', actionType: 'assemble', durationMinutes: 5 },
    { stepNumber: 3, instruction: 'Cover and simmer gently until the pork belly is tender and the liquid has reduced to a glaze.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 65 },
    { stepNumber: 4, instruction: 'Add the bok choy for the last five minutes, season with the white pepper, and divide into four portions.', applianceId: 'cooktop', actionType: 'store', durationMinutes: 8 },
  ],
  note: 'Rich by nature — the figures are the cited raw pork belly, not a lighter cut. The app already ships pork belly artwork.',
};

const MISO_GLAZED_SALMON: PlannerCatalogueRecipe = {
  id: 'planner-miso-glazed-salmon',
  version: '1',
  title: 'Miso-glazed salmon with bok choy',
  mealTypes: ['dinner'],
  cuisines: ['Japanese'],
  baseYield: 3,
  durationMinutes: 25,
  requiredAppliances: ['oven'],
  ingredients: [
    { canonicalId: 'salmon', name: 'Salmon', grams: 480, preparation: 'raw fillet — weigh before cooking' },
    { canonicalId: 'bok-choy', name: 'Bok choy', grams: 300, preparation: 'raw, trimmed and halved lengthways' },
    { canonicalId: 'miso', name: 'Miso', grams: 45, preparation: 'as sold' },
    { canonicalId: 'honey', name: 'Honey', grams: 20, preparation: 'as sold' },
    { canonicalId: 'tamari', name: 'Tamari', grams: 15, preparation: 'as sold' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 8, preparation: 'as sold' },
    { canonicalId: 'sesame', name: 'Sesame seeds', grams: 8, preparation: 'whole dried seeds' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Heat the oven to 200°C and line a tray.', applianceId: 'oven', actionType: 'prep', durationMinutes: 5 },
    { stepNumber: 2, instruction: 'Mix the miso, honey, tamari and sesame oil into a glaze and coat the salmon with two thirds of it.', applianceId: null, actionType: 'prep', durationMinutes: 5 },
    { stepNumber: 3, instruction: 'Toss the bok choy in the remaining glaze, put it on the tray beside the salmon, and roast until the salmon is just set.', applianceId: 'oven', actionType: 'cook', durationMinutes: 12 },
    { stepNumber: 4, instruction: 'Scatter the sesame seeds over and divide into three portions.', applianceId: null, actionType: 'store', durationMinutes: 3 },
  ],
  note: 'Every nutrient including fibre resolves for this one, which makes it the clearest example of a fully sourced planner recipe.',
};

const BRAISED_TOFU_GINGER_PORK: PlannerCatalogueRecipe = {
  id: 'planner-braised-tofu-ginger-pork',
  version: '1',
  title: 'Braised tofu with ginger pork',
  mealTypes: ['dinner'],
  cuisines: ['Chinese'],
  baseYield: 3,
  durationMinutes: 30,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'tofu-firm', name: 'Firm tofu', grams: 450, preparation: 'extra firm, drained, cut into cubes' },
    { canonicalId: 'ground-pork', name: 'Ground pork', grams: 250, preparation: 'raw — weigh before cooking' },
    { canonicalId: 'soy-sauce-light', name: 'Light soy sauce', grams: 30, preparation: 'as sold — this shoyu is brewed from soy and wheat' },
    { canonicalId: 'oyster-sauce', name: 'Oyster sauce', grams: 20, preparation: 'as sold' },
    { canonicalId: 'ginger', name: 'Ginger', grams: 15, preparation: 'raw, peeled and finely minced' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 12, preparation: 'raw, minced' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 6, preparation: 'as sold' },
    { canonicalId: 'white-pepper', name: 'White pepper', grams: 2, preparation: 'ground' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Fry the ground pork hard until it browns and the fat runs, breaking it up as it goes.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 8 },
    { stepNumber: 2, instruction: 'Add the ginger and garlic and fry for a minute, then stir in the light soy sauce, oyster sauce and 150 ml of water.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 4 },
    { stepNumber: 3, instruction: 'Slide the firm tofu in and simmer gently, spooning the sauce over, until it has taken on the colour of the braise.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 12 },
    { stepNumber: 4, instruction: 'Season with the white pepper, finish with the sesame oil, and divide into three portions.', applianceId: null, actionType: 'store', durationMinutes: 3 },
  ],
  note: 'Deliberately not called mapo tofu: the catalogue has no nutrition for doubanjiang, so the dish that needs it could not be costed and is not claimed.',
};

const CHICKEN_THIGH_BAKE: PlannerCatalogueRecipe = {
  id: 'planner-chicken-thigh-tomato-parmesan',
  version: '1',
  title: 'Roast chicken thighs with tomato and parmesan',
  mealTypes: ['dinner'],
  cuisines: ['Italian'],
  baseYield: 4,
  durationMinutes: 40,
  requiredAppliances: ['oven'],
  ingredients: [
    { canonicalId: 'chicken-thigh', name: 'Chicken thigh', grams: 640, preparation: 'raw, boneless and skinless — weigh before cooking' },
    { canonicalId: 'tomato', name: 'Tomato', grams: 400, preparation: 'roma, raw, halved' },
    { canonicalId: 'olive-oil', name: 'Olive oil', grams: 30, preparation: 'as sold' },
    { canonicalId: 'parmesan', name: 'Parmesan', grams: 40, preparation: 'hard, finely grated' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 15, preparation: 'raw, thinly sliced' },
    { canonicalId: 'salt', name: 'Salt', grams: 4, preparation: 'table salt' },
    { canonicalId: 'black-pepper', name: 'Black pepper', grams: 2, preparation: 'ground' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Heat the oven to 210°C.', applianceId: 'oven', actionType: 'prep', durationMinutes: 5 },
    { stepNumber: 2, instruction: 'Toss the chicken thigh, tomato and garlic with the olive oil, salt and black pepper in a roasting dish.', applianceId: null, actionType: 'prep', durationMinutes: 6 },
    { stepNumber: 3, instruction: 'Roast until the chicken thigh is cooked through and the tomato has slumped into the oil.', applianceId: 'oven', actionType: 'cook', durationMinutes: 25 },
    { stepNumber: 4, instruction: 'Scatter the parmesan over and return it to the oven until it melts. Divide into four portions.', applianceId: 'oven', actionType: 'store', durationMinutes: 4 },
  ],
  note: 'A second batch-friendly dinner outside the Asian set, so cuisine filtering has something to filter.',
};

/*
 * The nine Korean entries, added 13 September 2026 from a cuisine expert's
 * brief (`docs/korean-cuisine-research-brief.md`).
 *
 * Six of them could not be costed at first: `gochujang`, `gochugaru`,
 * `doenjang`, `tteok` and `dried-miyeok` existed as canonicals with real
 * identities and Hangul aliases but carried no nutrition. The cause turned out
 * to be ours — the catalogue build searched two of FoodData Central's five data
 * types. Decision 202 widened that, and all five resolved: four to a reviewed
 * Branded record and one to Survey (FNDDS).
 *
 * A Branded figure is one manufacturer's declared label, not a laboratory
 * composite, and `gochugaru`'s does not reconcile with its own calorie count.
 * Every one of those trade-offs is named in
 * `docs/planner-catalogue-provenance.md`; none of them is invisible from here.
 */

const GYERAN_MARI: PlannerCatalogueRecipe = {
  id: 'planner-gyeran-mari-rolled-omelette',
  version: '1',
  title: 'Korean rolled omelette',
  mealTypes: ['breakfast', 'lunch', 'dinner'],
  cuisines: ['Korean'],
  baseYield: 3,
  durationMinutes: 20,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'eggs', name: 'Eggs', grams: 250, preparation: 'raw, beaten — weigh without the shells' },
    { canonicalId: 'carrot', name: 'Carrot', grams: 30, preparation: 'raw, peeled and finely minced' },
    { canonicalId: 'green-onion', name: 'Green onion', grams: 20, preparation: 'raw, trimmed and finely chopped' },
    { canonicalId: 'vegetable-oil', name: 'Vegetable oil', grams: 8, preparation: 'as sold' },
    { canonicalId: 'salt', name: 'Salt', grams: 3, preparation: 'table salt' },
    { canonicalId: 'black-pepper', name: 'Black pepper', grams: 1, preparation: 'ground' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 4, preparation: 'as sold', optional: true },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Beat the eggs with the salt and black pepper until even, then stir in the carrot, the green onion and the sesame oil if using.', applianceId: null, actionType: 'prep', durationMinutes: 5 },
    { stepNumber: 2, instruction: 'Brush a small non-stick pan with some of the vegetable oil over a low heat, pour in a third of the egg and spread it into a thin, even layer.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 3 },
    { stepNumber: 3, instruction: 'When the underside has set but the top is still wet, roll the egg from one side of the pan to the other into a tight log.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 2 },
    { stepNumber: 4, instruction: 'Push the roll aside, oil the bare pan with more vegetable oil, pour in half of what is left so it runs under the roll, let it almost set, then roll again over the new layer.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 4 },
    { stepNumber: 5, instruction: 'Repeat with the last of the egg, then turn the roll onto each of its sides over a low heat until the centre sets without colouring.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 3 },
    { stepNumber: 6, instruction: 'Rest the roll on a board for a minute, cut it across into bite-sized slices and divide into three portions.', applianceId: null, actionType: 'store', durationMinutes: 3 },
  ],
  note: 'Everyday banchan and lunchbox food, and the collection\'s first Korean breakfast. Eggs and two vegetables, twenty minutes, one pan — the shortest route into the cuisine for someone who has never cooked it.',
};

const BULGOGI: PlannerCatalogueRecipe = {
  id: 'planner-bulgogi-marinated-beef',
  version: '1',
  title: 'Bulgogi, marinated grilled beef',
  mealTypes: ['lunch', 'dinner'],
  cuisines: ['Korean'],
  baseYield: 4,
  durationMinutes: 60,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'beef-steak', name: 'Beef steak', grams: 500, preparation: 'raw, sliced very thinly across the grain — the cited record is flank; weigh before marinating' },
    { canonicalId: 'yellow-onion', name: 'Yellow onion', grams: 80, preparation: 'raw, peeled — half grated into the marinade, half sliced' },
    { canonicalId: 'soy-sauce-light', name: 'Light soy sauce', grams: 40, preparation: 'as sold — this shoyu is brewed from soy and wheat' },
    { canonicalId: 'carrot', name: 'Carrot', grams: 30, preparation: 'raw, peeled and cut into thin matchsticks' },
    { canonicalId: 'brown-sugar', name: 'Brown sugar', grams: 20, preparation: 'packed' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 20, preparation: 'raw, peeled and finely minced' },
    { canonicalId: 'green-onion', name: 'Green onion', grams: 20, preparation: 'raw, trimmed and finely chopped' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 15, preparation: 'as sold' },
    { canonicalId: 'vegetable-oil', name: 'Vegetable oil', grams: 10, preparation: 'as sold' },
    { canonicalId: 'ginger', name: 'Ginger', grams: 6, preparation: 'raw, peeled and finely minced' },
    { canonicalId: 'black-pepper', name: 'Black pepper', grams: 2, preparation: 'ground' },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Stir the light soy sauce, brown sugar, garlic, ginger, grated yellow onion, green onion, sesame oil and black pepper together until the brown sugar has dissolved.', applianceId: null, actionType: 'prep', durationMinutes: 8 },
    { stepNumber: 2, instruction: 'Turn the beef steak through the marinade by hand until every slice is coated, then cover it and leave it in the fridge for at least half an hour.', applianceId: null, actionType: 'store', durationMinutes: null },
    { stepNumber: 3, instruction: 'Sear the beef with the sliced yellow onion and the carrot in the vegetable oil over a high heat, in batches and spread out, so they catch and caramelise rather than steam.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 10 },
    { stepNumber: 4, instruction: 'When the beef is just cooked through and glazed, divide it into four portions and pour the pan juices over.', applianceId: 'cooktop', actionType: 'store', durationMinutes: 2 },
  ],
  note: 'The Korean dish most people already know, and one the catalogue can cost end to end: soy, brown sugar, garlic, ginger and sesame all carry cited figures, so nothing in the marinade is guessed.',
};

const MANDU_GUK: PlannerCatalogueRecipe = {
  id: 'planner-mandu-guk-dumpling-soup',
  version: '1',
  title: 'Mandu-guk, Korean dumpling soup',
  mealTypes: ['lunch', 'dinner'],
  cuisines: ['Korean'],
  baseYield: 4,
  durationMinutes: 35,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'frozen-dumplings', name: 'Mandu dumplings', grams: 480, preparation: 'frozen, about twelve to sixteen — weigh from the packet' },
    { canonicalId: 'eggs', name: 'Eggs', grams: 50, preparation: 'raw, beaten — weigh without the shells' },
    { canonicalId: 'green-onion', name: 'Green onion', grams: 30, preparation: 'raw, trimmed and sliced' },
    { canonicalId: 'soy-sauce-light', name: 'Light soy sauce', grams: 16, preparation: 'as sold — this shoyu is brewed from soy and wheat' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 12, preparation: 'raw, peeled and minced' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 6, preparation: 'as sold' },
    { canonicalId: 'beef-steak', name: 'Beef steak', grams: 200, preparation: 'raw flank, cut into small pieces — weigh before cooking', optional: true },
    { canonicalId: 'salt', name: 'Salt', grams: 4, preparation: 'table salt', optional: true },
    { canonicalId: 'black-pepper', name: 'Black pepper', grams: 1, preparation: 'ground', optional: true },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Simmer 1.5 litres of water with the garlic, and with the beef steak if you are using it, until the beef is tender and the water has taken its flavour, then season with the light soy sauce and the salt.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 25 },
    { stepNumber: 2, instruction: 'Drop the mandu dumplings in and boil until they float and their wrappers turn translucent.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 8 },
    { stepNumber: 3, instruction: 'Pour the beaten eggs into the simmering soup in a thin stream, stirring gently so they set into ribbons, then add the green onion.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 2 },
    { stepNumber: 4, instruction: 'Finish with the sesame oil and the black pepper and ladle into four bowls.', applianceId: null, actionType: 'assemble', durationMinutes: 2 },
  ],
  note: 'The New Year bowl in its everyday form, and the fastest of the three soups that share that role. Frozen mandu do the work, so it is a thirty-five minute dinner rather than a project.',
};

const KIMCHI_JJIGAE: PlannerCatalogueRecipe = {
  id: 'planner-kimchi-jjigae-pork-tofu',
  version: '1',
  title: 'Kimchi stew with pork belly and tofu',
  mealTypes: ['lunch', 'dinner'],
  cuisines: ['Korean'],
  baseYield: 4,
  durationMinutes: 40,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'kimchi', name: 'Kimchi', grams: 400, preparation: 'aged and sour, drained and cut into bite-sized pieces — weigh after draining' },
    { canonicalId: 'tofu-firm', name: 'Firm tofu', grams: 300, preparation: 'drained, cut into 2 cm cubes' },
    { canonicalId: 'pork-belly', name: 'Pork belly', grams: 200, preparation: 'raw, boneless and sliced — weigh before cooking' },
    { canonicalId: 'yellow-onion', name: 'Yellow onion', grams: 80, preparation: 'raw, peeled and thinly sliced' },
    { canonicalId: 'green-onion', name: 'Green onion', grams: 30, preparation: 'raw, trimmed and cut into 2 cm lengths' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 20, preparation: 'raw, peeled and finely minced' },
    { canonicalId: 'gochujang', name: 'Gochujang', grams: 20, preparation: 'as sold', optional: true },
    { canonicalId: 'vegetable-oil', name: 'Vegetable oil', grams: 10, preparation: 'as sold' },
    { canonicalId: 'gochugaru', name: 'Gochugaru', grams: 8, preparation: 'dry flakes, as sold' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 6, preparation: 'as sold', optional: true },
    { canonicalId: 'salt', name: 'Salt', grams: 4, preparation: 'table salt', optional: true },
    { canonicalId: 'sugar', name: 'Sugar', grams: 4, preparation: 'granulated', optional: true },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Fry the pork belly in the vegetable oil over a medium heat with the yellow onion, garlic, kimchi, gochugaru and the sugar if using, until the pork browns and the kimchi softens and catches at the edges.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 8 },
    { stepNumber: 2, instruction: 'Add enough water to just cover, stir in the gochujang if using, bring it to the boil and simmer briskly until the kimchi is completely tender.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 15 },
    { stepNumber: 3, instruction: 'Lower the firm tofu in and simmer until it is heated through, then stir in the green onion and season with the salt if it needs it.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 7 },
    { stepNumber: 4, instruction: 'Finish with the sesame oil off the heat and let the stew stand a few minutes so the tofu takes up the liquid.', applianceId: null, actionType: 'assemble', durationMinutes: 5 },
  ],
  note: 'The everyday Korean stew, and the one that most needed the catalogue to know what kimchi and gochugaru are. Aged, sour kimchi is the point of it; fresh kimchi makes a different and blander dish.',
};

const DOENJANG_JJIGAE: PlannerCatalogueRecipe = {
  id: 'planner-doenjang-jjigae-pork-tofu',
  version: '1',
  title: 'Doenjang stew with pork, daikon and tofu',
  mealTypes: ['lunch', 'dinner'],
  cuisines: ['Korean'],
  baseYield: 4,
  durationMinutes: 35,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'tofu-firm', name: 'Firm tofu', grams: 250, preparation: 'drained, cut into 2 cm cubes' },
    { canonicalId: 'ground-pork', name: 'Ground pork', grams: 150, preparation: 'raw, loose — weigh before cooking' },
    { canonicalId: 'potato', name: 'Potato', grams: 120, preparation: 'raw, peeled and cut into 2 cm cubes' },
    { canonicalId: 'daikon', name: 'Daikon', grams: 80, preparation: 'raw, peeled and sliced into thin bite-sized pieces' },
    { canonicalId: 'yellow-onion', name: 'Yellow onion', grams: 60, preparation: 'raw, peeled and thinly sliced' },
    { canonicalId: 'doenjang', name: 'Doenjang', grams: 40, preparation: 'as sold' },
    { canonicalId: 'green-onion', name: 'Green onion', grams: 25, preparation: 'raw, trimmed and cut into 2 cm lengths' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 15, preparation: 'raw, peeled and finely minced' },
    { canonicalId: 'vegetable-oil', name: 'Vegetable oil', grams: 8, preparation: 'as sold' },
    { canonicalId: 'gochugaru', name: 'Gochugaru', grams: 5, preparation: 'dry flakes, as sold', optional: true },
    { canonicalId: 'salt', name: 'Salt', grams: 3, preparation: 'table salt', optional: true },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Fry the ground pork in the vegetable oil over a medium heat until it loses its pink, then add the doenjang and the gochugaru if using and cook them for a minute so the paste opens up.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 5 },
    { stepNumber: 2, instruction: 'Pour in enough water to cover, stir until the doenjang has dissolved, add the daikon and potato and bring it to the boil.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 10 },
    { stepNumber: 3, instruction: 'Add the yellow onion, garlic and firm tofu, drop it to a steady simmer and cook until the vegetables are tender.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 10 },
    { stepNumber: 4, instruction: 'Stir in the green onion, season with the salt if it needs it, and let the stew stand a couple of minutes off the heat.', applianceId: null, actionType: 'assemble', durationMinutes: 5 },
  ],
  note: 'The stew Korean households actually make most often. It is here because doenjang now has its own record rather than borrowing miso\'s, which would have been a different bean paste wearing its name.',
};

const BIBIMBAP: PlannerCatalogueRecipe = {
  id: 'planner-bibimbap-beef-vegetables',
  version: '1',
  title: 'Bibimbap with beef, vegetables and egg',
  mealTypes: ['lunch', 'dinner'],
  cuisines: ['Korean'],
  baseYield: 4,
  durationMinutes: 60,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'white-rice', name: 'White rice', grams: 360, preparation: 'raw, rinsed until the water runs nearly clear — weigh before cooking' },
    { canonicalId: 'ground-beef', name: 'Ground beef', grams: 200, preparation: 'raw, loose — weigh before cooking' },
    { canonicalId: 'eggs', name: 'Eggs', grams: 200, preparation: 'raw, for frying — weigh without the shells' },
    { canonicalId: 'spinach', name: 'Spinach', grams: 200, preparation: 'raw leaves, rinsed — weigh after trimming the tough stems' },
    { canonicalId: 'bean-sprouts', name: 'Bean sprouts', grams: 160, preparation: 'raw, rinsed and drained', optional: true },
    { canonicalId: 'carrot', name: 'Carrot', grams: 120, preparation: 'raw, peeled and cut into thin matchsticks' },
    { canonicalId: 'zucchini', name: 'Zucchini', grams: 120, preparation: 'raw, cut into thin matchsticks', optional: true },
    { canonicalId: 'cucumber', name: 'Cucumber', grams: 120, preparation: 'raw, cut into thin matchsticks', optional: true },
    { canonicalId: 'gochujang', name: 'Gochujang', grams: 80, preparation: 'as sold' },
    { canonicalId: 'green-onion', name: 'Green onion', grams: 30, preparation: 'raw, trimmed and finely chopped' },
    { canonicalId: 'soy-sauce-light', name: 'Light soy sauce', grams: 30, preparation: 'as sold — this shoyu is brewed from soy and wheat' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 24, preparation: 'as sold' },
    { canonicalId: 'vegetable-oil', name: 'Vegetable oil', grams: 16, preparation: 'as sold' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 15, preparation: 'raw, peeled and finely minced' },
    { canonicalId: 'sesame', name: 'Sesame seeds', grams: 10, preparation: 'toasted, whole', optional: true },
    { canonicalId: 'sugar', name: 'Sugar', grams: 10, preparation: 'granulated', optional: true },
    { canonicalId: 'salt', name: 'Salt', grams: 4, preparation: 'table salt', optional: true },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Cook the white rice in a rice cooker or a covered pan and keep it warm.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 30 },
    { stepNumber: 2, instruction: 'Season the ground beef with the light soy sauce, garlic, half the green onion and a little of the sugar and sesame oil, then stir-fry it in some of the vegetable oil until it is just cooked.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 8 },
    { stepNumber: 3, instruction: 'Blanch the spinach briefly, cool it, squeeze it dry and dress it with a little sesame oil, garlic and the sesame seeds.', applianceId: 'cooktop', actionType: 'prep', durationMinutes: 6 },
    { stepNumber: 4, instruction: 'Stir-fry the carrot, zucchini and cucumber one at a time in a little vegetable oil with a pinch of the salt, each only until it softens and keeps its colour, and set them aside apart from one another.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 12 },
    { stepNumber: 5, instruction: 'Blanch the bean sprouts if using, drain them, and dress them with garlic, sesame oil and a little light soy sauce.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 5 },
    { stepNumber: 6, instruction: 'Mix the gochujang with the rest of the sugar, a little sesame oil and a spoonful of water into a loose sauce.', applianceId: null, actionType: 'prep', durationMinutes: 3 },
    { stepNumber: 7, instruction: 'Fry the eggs sunny side up so the yolks stay soft.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 6 },
    { stepNumber: 8, instruction: 'Divide the hot rice between four bowls, lay the beef and each vegetable over it in its own section, top each bowl with an egg, scatter the rest of the green onion over and serve the gochujang sauce alongside to mix in.', applianceId: null, actionType: 'assemble', durationMinutes: 10 },
  ],
  note: 'The collection\'s first rice dish, and the one that waited longest: white rice and gochujang both had to be costable before it could be offered at all.',
};

const MIYEOKGUK: PlannerCatalogueRecipe = {
  id: 'planner-miyeokguk-seaweed-beef-soup',
  version: '1',
  title: 'Miyeokguk, seaweed soup with beef',
  mealTypes: ['breakfast', 'lunch', 'dinner'],
  cuisines: ['Korean'],
  baseYield: 4,
  durationMinutes: 45,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'beef-steak', name: 'Beef steak', grams: 250, preparation: 'raw flank, sliced thinly — weigh before cooking' },
    { canonicalId: 'dried-miyeok', name: 'Dried miyeok', grams: 20, preparation: 'dry — weigh before soaking' },
    { canonicalId: 'soy-sauce-light', name: 'Light soy sauce', grams: 20, preparation: 'as sold — this shoyu is brewed from soy and wheat' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 16, preparation: 'raw, peeled and finely minced' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 12, preparation: 'as sold' },
    { canonicalId: 'salt', name: 'Salt', grams: 4, preparation: 'table salt', optional: true },
    { canonicalId: 'black-pepper', name: 'Black pepper', grams: 1, preparation: 'ground', optional: true },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Soak the dried miyeok in plenty of cold water until it has softened and swelled, then rinse it, drain it well and cut it into bite-sized lengths.', applianceId: null, actionType: 'prep', durationMinutes: 10 },
    { stepNumber: 2, instruction: 'Season the beef lightly with the salt and black pepper.', applianceId: null, actionType: 'prep', durationMinutes: 3 },
    { stepNumber: 3, instruction: 'Warm the sesame oil in a large pot and fry the beef, the seaweed and the garlic together until the beef has mostly coloured and the seaweed turns glossy.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 5 },
    { stepNumber: 4, instruction: 'Add enough water to make a generous soup, stir in the light soy sauce, bring it to the boil and simmer gently until the soup turns faintly milky and the beef and seaweed are tender.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 25 },
    { stepNumber: 5, instruction: 'Taste, add more salt or light soy sauce if it needs it, and serve hot.', applianceId: 'cooktop', actionType: 'assemble', durationMinutes: 2 },
  ],
  note: 'Eaten on birthdays and after childbirth, and as an ordinary light meal the rest of the year. At 153 kcal a portion it is the lightest thing in the collection, which is a consequence of the recipe rather than a claim about it.',
};

const TTEOKGUK: PlannerCatalogueRecipe = {
  id: 'planner-tteokguk-rice-cake-soup',
  version: '1',
  title: 'Tteokguk, rice cake soup',
  mealTypes: ['breakfast', 'lunch', 'dinner'],
  cuisines: ['Korean'],
  baseYield: 4,
  durationMinutes: 45,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'tteok', name: 'Sliced tteok', grams: 400, preparation: 'sliced rice cake, soaked in cold water if frozen and drained — weigh after soaking' },
    { canonicalId: 'beef-steak', name: 'Beef steak', grams: 200, preparation: 'raw flank, cut into small pieces — weigh before cooking' },
    { canonicalId: 'eggs', name: 'Eggs', grams: 100, preparation: 'raw, yolks and whites separated — weigh without the shells' },
    { canonicalId: 'green-onion', name: 'Green onion', grams: 40, preparation: 'raw, trimmed and sliced thinly on the bias' },
    { canonicalId: 'soy-sauce-light', name: 'Light soy sauce', grams: 20, preparation: 'as sold — this shoyu is brewed from soy and wheat' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 12, preparation: 'raw, peeled and minced' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 8, preparation: 'as sold' },
    { canonicalId: 'gim', name: 'Gim', grams: 4, preparation: 'dry sheet, toasted and crushed — weigh before crushing', optional: true },
    { canonicalId: 'salt', name: 'Salt', grams: 4, preparation: 'table salt', optional: true },
    { canonicalId: 'black-pepper', name: 'Black pepper', grams: 1, preparation: 'ground', optional: true },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Simmer 1.5 litres of water with the beef and the garlic until the beef is tender and the water has taken its flavour, then season with the light soy sauce and the salt.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 25 },
    { stepNumber: 2, instruction: 'While that cooks, separate the eggs, set the yolks in a lightly oiled pan as a thin sheet and cut them into strips, and keep the whites beaten.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 8 },
    { stepNumber: 3, instruction: 'Soak the tteok in cold water if it came out of the freezer, then drain it.', applianceId: null, actionType: 'prep', durationMinutes: 10 },
    { stepNumber: 4, instruction: 'Add the rice cakes to the pot and boil them until they float and are soft the whole way through.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 8 },
    { stepNumber: 5, instruction: 'Pour the beaten egg whites into the simmering soup in a thin stream, stirring gently so they set into ribbons, then add the green onion.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 3 },
    { stepNumber: 6, instruction: 'Finish with the sesame oil and black pepper, ladle into four bowls and scatter the egg yolk strips and the crushed gim over.', applianceId: null, actionType: 'assemble', durationMinutes: 3 },
  ],
  note: 'The New Year bowl. Eating it is how a Korean year is counted, which is reason enough for a planning collection to carry it.',
};

const TTEOK_MANDU_GUK: PlannerCatalogueRecipe = {
  id: 'planner-tteok-mandu-guk-new-year-soup',
  version: '1',
  title: 'Tteok-mandu-guk, rice cake and dumpling soup',
  mealTypes: ['lunch', 'dinner'],
  cuisines: ['Korean'],
  baseYield: 4,
  durationMinutes: 45,
  requiredAppliances: ['cooktop'],
  ingredients: [
    { canonicalId: 'frozen-dumplings', name: 'Mandu dumplings', grams: 360, preparation: 'frozen, about ten to twelve — weigh from the packet' },
    { canonicalId: 'tteok', name: 'Sliced tteok', grams: 300, preparation: 'sliced rice cake, soaked in cold water if frozen and drained — weigh after soaking' },
    { canonicalId: 'beef-steak', name: 'Beef steak', grams: 200, preparation: 'raw flank, cut into small pieces — weigh before cooking' },
    { canonicalId: 'eggs', name: 'Eggs', grams: 100, preparation: 'raw, yolks and whites separated — weigh without the shells' },
    { canonicalId: 'green-onion', name: 'Green onion', grams: 40, preparation: 'raw, trimmed and sliced thinly on the bias' },
    { canonicalId: 'soy-sauce-light', name: 'Light soy sauce', grams: 20, preparation: 'as sold — this shoyu is brewed from soy and wheat' },
    { canonicalId: 'garlic', name: 'Garlic', grams: 12, preparation: 'raw, peeled and minced' },
    { canonicalId: 'sesame-oil', name: 'Sesame oil', grams: 8, preparation: 'as sold' },
    { canonicalId: 'gim', name: 'Gim', grams: 4, preparation: 'dry sheet, toasted and crushed — weigh before crushing', optional: true },
    { canonicalId: 'salt', name: 'Salt', grams: 4, preparation: 'table salt', optional: true },
    { canonicalId: 'black-pepper', name: 'Black pepper', grams: 1, preparation: 'ground', optional: true },
  ],
  steps: [
    { stepNumber: 1, instruction: 'Simmer 1.5 litres of water with the beef and the garlic until the beef is tender and the water has turned faintly milky, then season with the light soy sauce and the salt.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 25 },
    { stepNumber: 2, instruction: 'Soak the tteok in cold water if it came out of the freezer, then drain it.', applianceId: null, actionType: 'prep', durationMinutes: 10 },
    { stepNumber: 3, instruction: 'Add the rice cakes and the mandu dumplings to the pot and boil until the rice cakes are soft and the dumplings float.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 8 },
    { stepNumber: 4, instruction: 'Separate the eggs, set the yolks in a lightly oiled pan as a thin sheet and cut them into strips, and keep the whites beaten.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 6 },
    { stepNumber: 5, instruction: 'Pour the beaten egg whites into the simmering soup in a thin stream, stirring gently so they set into ribbons, then add the green onion.', applianceId: 'cooktop', actionType: 'cook', durationMinutes: 3 },
    { stepNumber: 6, instruction: 'Toast the gim until it crisps and crush it, finish the soup with the sesame oil and black pepper, then ladle it into four bowls and scatter the egg yolk strips and gim over.', applianceId: null, actionType: 'assemble', durationMinutes: 3 },
  ],
  note: 'Tteokguk and mandu-guk in one bowl, which is how the New Year soup is most often actually served. It costs more per portion than either on its own, and the figures say so.',
};

export const PLANNER_CATALOGUE: readonly PlannerCatalogueRecipe[] = [
  OVERNIGHT_OATS,
  MISO_MORNING_SOUP,
  SAVOURY_OAT_PORRIDGE,
  SMASHED_CUCUMBER_SALAD,
  GINGER_CHICKEN_STIR_FRY,
  GARLIC_SHRIMP_TOMATO,
  PORK_BELLY_BRAISE,
  MISO_GLAZED_SALMON,
  BRAISED_TOFU_GINGER_PORK,
  CHICKEN_THIGH_BAKE,
  GYERAN_MARI,
  BULGOGI,
  MANDU_GUK,
  KIMCHI_JJIGAE,
  DOENJANG_JJIGAE,
  BIBIMBAP,
  MIYEOKGUK,
  TTEOKGUK,
  TTEOK_MANDU_GUK,
];

/* -------------------------------------------------------------------------- */
/* Selection                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Meal-type selection. There is deliberately no pantry parameter: what someone
 * owns never removes a recipe from this list, because the point of planning is
 * to produce the shopping.
 */
export function catalogueForMealType(
  mealType: PlannedMealType,
  recipes: readonly PlannerCatalogueRecipe[] = PLANNER_CATALOGUE,
): readonly PlannerCatalogueRecipe[] {
  return recipes.filter((recipe) => recipe.mealTypes.includes(mealType));
}

/** Cuisine labels present in the collection, for the picker's filter row. */
export function catalogueCuisines(
  recipes: readonly PlannerCatalogueRecipe[] = PLANNER_CATALOGUE,
): readonly string[] {
  return [...new Set(recipes.flatMap((recipe) => recipe.cuisines))].sort();
}

/** No appliance and nothing cooked. Both conditions, so a "no-cook" claim is checkable. */
export function isNoCook(recipe: PlannerCatalogueRecipe): boolean {
  return recipe.requiredAppliances.length === 0
    && recipe.steps.every((step) => step.actionType !== 'cook' && step.applianceId === null);
}

/* -------------------------------------------------------------------------- */
/* Snapshotting                                                               */
/* -------------------------------------------------------------------------- */

function asTemplate(recipe: PlannerCatalogueRecipe): MealPrepTemplate {
  return {
    id: recipe.id,
    title: recipe.title,
    portions: recipe.baseYield,
    durationMinutes: recipe.durationMinutes,
    requiredAppliances: recipe.requiredAppliances,
    ingredients: recipe.ingredients.map((ingredient) => ({
      canonicalId: ingredient.canonicalId,
      name: ingredient.name,
      quantity: ingredient.grams,
      unit: 'g' as const,
      optional: ingredient.optional ?? false,
    })),
    steps: recipe.steps,
  };
}

/**
 * Builds the immutable snapshot the planner stores, reusing the shared adapter
 * so nutrition, yield validation and ingredient shape stay in one place. Two
 * things are then layered on that the generic template shape cannot carry: the
 * preparation basis, and this recipe's own version so a later edit to the
 * collection is detectable rather than silent.
 *
 * Throws if the adapter ever stops returning ingredients in the order it was
 * given them, because preparation would otherwise be attached to the wrong food.
 */
export function snapshotCatalogueRecipe(params: {
  recipe: PlannerCatalogueRecipe;
  canonicals: ReadonlyMap<string, CanonicalItem>;
  snapshotId: string;
  ingredientId: () => string;
  createdAt?: string;
}): PlannerRecipeSnapshot {
  const { recipe } = params;
  const snapshot = snapshotMealPrepTemplate({
    template: asTemplate(recipe),
    canonicals: params.canonicals,
    snapshotId: params.snapshotId,
    ingredientId: params.ingredientId,
    mealTypes: recipe.mealTypes,
    cuisines: recipe.cuisines,
    createdAt: params.createdAt,
  });
  const ingredients = snapshot.ingredients.map((ingredient, index) => {
    const authored = recipe.ingredients[index];
    if (!authored || authored.canonicalId !== ingredient.canonicalId) {
      throw new Error(`Catalogue ingredient order changed for ${recipe.id}; preparation cannot be attached safely`);
    }
    return { ...ingredient, preparation: authored.preparation };
  });
  return { ...snapshot, sourceVersion: recipe.version, ingredients };
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Terms an instruction might use, and the canonical ids that satisfy them. A
 * term with an empty list names a food the catalogue has no identity for at all,
 * which is still a finding when an instruction asks for it.
 *
 * Longest terms match first and consume their span, so "pork belly" is not also
 * read as "pork", and "sesame oil" is not also read as "sesame".
 */
const FOOD_TERMS: readonly { term: string; satisfiedBy: readonly string[] }[] = [
  { term: 'light soy sauce', satisfiedBy: ['soy-sauce-light'] },
  { term: 'dark soy sauce', satisfiedBy: ['soy-sauce-dark'] },
  { term: 'soy sauce', satisfiedBy: ['soy-sauce-light', 'soy-sauce-dark'] },
  { term: 'oyster sauce', satisfiedBy: ['oyster-sauce'] },
  { term: 'hoisin sauce', satisfiedBy: ['hoisin-sauce'] },
  { term: 'hoisin', satisfiedBy: ['hoisin-sauce'] },
  { term: 'fish sauce', satisfiedBy: ['fish-sauce'] },
  { term: 'peanut butter', satisfiedBy: ['peanut-butter'] },
  { term: 'sesame oil', satisfiedBy: ['sesame-oil'] },
  { term: 'sesame seeds', satisfiedBy: ['sesame'] },
  { term: 'olive oil', satisfiedBy: ['olive-oil'] },
  { term: 'vegetable oil', satisfiedBy: ['vegetable-oil'] },
  { term: 'cooking oil', satisfiedBy: ['vegetable-oil', 'olive-oil'] },
  { term: 'ground beef', satisfiedBy: ['ground-beef'] },
  { term: 'beef steak', satisfiedBy: ['beef-steak'] },
  { term: 'chicken breast', satisfiedBy: ['chicken-breast'] },
  { term: 'chicken thigh', satisfiedBy: ['chicken-thigh'] },
  { term: 'ground pork', satisfiedBy: ['ground-pork'] },
  { term: 'pork belly', satisfiedBy: ['pork-belly'] },
  { term: 'firm tofu', satisfiedBy: ['tofu-firm'] },
  { term: 'greek yogurt', satisfiedBy: ['greek-yogurt'] },
  { term: 'rolled oats', satisfiedBy: ['oats'] },
  { term: 'bok choy', satisfiedBy: ['bok-choy'] },
  { term: 'napa cabbage', satisfiedBy: ['napa-cabbage'] },
  { term: 'bean sprouts', satisfiedBy: ['bean-sprouts'] },
  { term: 'shiitake mushroom', satisfiedBy: ['shiitake-mushroom'] },
  { term: 'shiitake', satisfiedBy: ['shiitake-mushroom'] },
  { term: 'green onion', satisfiedBy: ['green-onion'] },
  { term: 'spring onion', satisfiedBy: ['green-onion'] },
  { term: 'scallion', satisfiedBy: ['green-onion'] },
  { term: 'white pepper', satisfiedBy: ['white-pepper'] },
  { term: 'black pepper', satisfiedBy: ['black-pepper'] },
  { term: 'sweet potato', satisfiedBy: ['sweet-potato'] },
  { term: 'zucchini', satisfiedBy: ['zucchini'] },
  { term: 'daikon', satisfiedBy: ['daikon'] },
  { term: 'bell pepper', satisfiedBy: ['bell-pepper'] },
  { term: 'brown rice', satisfiedBy: ['brown-rice'] },
  { term: 'jasmine rice', satisfiedBy: ['jasmine-rice'] },
  { term: 'white rice', satisfiedBy: ['white-rice'] },
  { term: 'cooked rice', satisfiedBy: ['jasmine-rice', 'white-rice', 'brown-rice'] },
  { term: 'chicken stock', satisfiedBy: ['chicken-stock'] },
  { term: 'stock', satisfiedBy: ['chicken-stock'] },
  { term: 'broth', satisfiedBy: ['chicken-stock'] },
  { term: 'rice cakes', satisfiedBy: ['tteok'] },
  { term: 'rice cake', satisfiedBy: ['tteok'] },
  { term: 'tteok', satisfiedBy: ['tteok'] },
  { term: 'rice', satisfiedBy: ['jasmine-rice', 'white-rice', 'brown-rice'] },
  { term: 'dumplings', satisfiedBy: ['frozen-dumplings'] },
  { term: 'mandu', satisfiedBy: ['frozen-dumplings'] },
  { term: 'noodles', satisfiedBy: ['dried-pasta'] },
  { term: 'pasta', satisfiedBy: ['dried-pasta'] },
  { term: 'bread', satisfiedBy: ['bread'] },
  { term: 'tortilla', satisfiedBy: ['tortilla'] },
  { term: 'flour', satisfiedBy: ['all-purpose-flour'] },
  { term: 'cornstarch', satisfiedBy: ['cornstarch'] },
  { term: 'greens', satisfiedBy: [] },
  { term: 'eggs', satisfiedBy: ['eggs'] },
  { term: 'egg', satisfiedBy: ['eggs'] },
  { term: 'milk', satisfiedBy: ['milk'] },
  { term: 'butter', satisfiedBy: ['butter'] },
  { term: 'cheese', satisfiedBy: ['cheddar-cheese', 'parmesan', 'mozzarella', 'cream-cheese'] },
  { term: 'parmesan', satisfiedBy: ['parmesan'] },
  { term: 'yogurt', satisfiedBy: ['greek-yogurt', 'plain-yogurt'] },
  { term: 'cream', satisfiedBy: ['heavy-cream'] },
  { term: 'broccoli', satisfiedBy: ['broccoli'] },
  { term: 'spinach', satisfiedBy: ['spinach'] },
  { term: 'potatoes', satisfiedBy: ['potato'] },
  { term: 'potato', satisfiedBy: ['potato'] },
  { term: 'carrot', satisfiedBy: ['carrot'] },
  { term: 'onions', satisfiedBy: ['yellow-onion'] },
  { term: 'onion', satisfiedBy: ['yellow-onion'] },
  { term: 'garlic', satisfiedBy: ['garlic'] },
  { term: 'ginger', satisfiedBy: ['ginger'] },
  { term: 'tomatoes', satisfiedBy: ['tomato'] },
  { term: 'tomato', satisfiedBy: ['tomato'] },
  { term: 'cucumber', satisfiedBy: ['cucumber'] },
  { term: 'banana', satisfiedBy: ['banana'] },
  { term: 'cilantro', satisfiedBy: ['cilantro'] },
  { term: 'lime', satisfiedBy: ['lime'] },
  { term: 'lemon', satisfiedBy: ['lemon'] },
  { term: 'peanuts', satisfiedBy: ['peanut'] },
  { term: 'salmon', satisfiedBy: ['salmon'] },
  { term: 'shrimp', satisfiedBy: ['shrimp'] },
  { term: 'tofu', satisfiedBy: ['tofu-firm'] },
  { term: 'chicken', satisfiedBy: ['chicken-breast', 'chicken-thigh'] },
  { term: 'pork', satisfiedBy: ['ground-pork', 'pork-belly'] },
  { term: 'beef', satisfiedBy: ['beef-steak', 'ground-beef'] },
  { term: 'miso', satisfiedBy: ['miso'] },
  { term: 'doenjang', satisfiedBy: ['doenjang'] },
  { term: 'gochujang', satisfiedBy: ['gochujang'] },
  { term: 'gochugaru', satisfiedBy: ['gochugaru'] },
  { term: 'kimchi', satisfiedBy: ['kimchi'] },
  // Both Korean seaweeds, so a step that says "seaweed" is satisfied by
  // whichever one the recipe actually bought.
  { term: 'seaweed', satisfiedBy: ['dried-miyeok', 'gim'] },
  { term: 'miyeok', satisfiedBy: ['dried-miyeok'] },
  { term: 'gim', satisfiedBy: ['gim'] },
  { term: 'tamari', satisfiedBy: ['tamari'] },
  { term: 'sriracha', satisfiedBy: ['sriracha'] },
  { term: 'honey', satisfiedBy: ['honey'] },
  { term: 'brown sugar', satisfiedBy: ['brown-sugar'] },
  { term: 'sugar', satisfiedBy: ['sugar'] },
  { term: 'salt', satisfiedBy: ['salt'] },
  { term: 'sesame', satisfiedBy: ['sesame'] },
  { term: 'oats', satisfiedBy: ['oats'] },
  { term: 'water', satisfiedBy: [] },
  { term: 'ice', satisfiedBy: [] },
];

const SORTED_TERMS = [...FOOD_TERMS].sort((left, right) => right.term.length - left.term.length);

export type CatalogueFindingKind =
  | 'unknown_canonical'
  | 'unresolved_nutrition'
  | 'non_gram_unit'
  | 'invalid_quantity'
  | 'invalid_yield'
  | 'duplicate_ingredient'
  | 'missing_preparation'
  | 'unused_ingredient'
  | 'instruction_names_unlisted_food'
  | 'step_numbering';

export interface CatalogueFinding {
  kind: CatalogueFindingKind;
  detail: string;
}

export interface CatalogueAudit {
  recipeId: string;
  findings: readonly CatalogueFinding[];
  /** Ingredient canonical ids whose nutrition the catalogue cannot supply. */
  unresolvedIngredients: readonly string[];
  /** Nutrients that stay unknown for this recipe, and are disclosed rather than filled. */
  unknownNutrients: readonly string[];
}

/**
 * Which food terms a block of instruction text asks for.
 *
 * Longest first, and each match is blanked out before the next term is tried,
 * so "light soy sauce" is not also counted as "soy sauce", and "slice" and
 * "rice" are not read as "ice" — the letter guards handle that too.
 */
export function foodTermsInSteps(steps: readonly CookingGuideStep[]): readonly string[] {
  let text = steps.map((step) => step.instruction).join(' ').toLowerCase();
  const found: string[] = [];
  for (const { term } of SORTED_TERMS) {
    const pattern = new RegExp(`(?<![a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`, 'g');
    const before = text;
    text = text.replace(pattern, ' '.repeat(term.length));
    if (text !== before) found.push(term);
  }
  return found;
}

/**
 * Checks one entry against the rules in this file's header. Everything it
 * reports is something a reader of the recipe could verify by hand; nothing is
 * a judgement about whether the dish is good.
 */
export function auditCatalogueRecipe(params: {
  recipe: PlannerCatalogueRecipe;
  canonicals: ReadonlyMap<string, CanonicalItem>;
}): CatalogueAudit {
  return auditIngredientsAndSteps({
    ...params,
    ingredients: params.recipe.ingredients.map((ingredient) => ({
      canonicalId: ingredient.canonicalId,
      quantity: ingredient.grams,
      unit: 'g' as const,
      preparation: ingredient.preparation,
      optional: ingredient.optional ?? false,
    })),
    checkPreparation: true,
  });
}

interface AuditableIngredient {
  canonicalId: string;
  quantity: number | null;
  unit: MeasureUnit | null;
  preparation: string;
  optional: boolean;
}

function auditIngredientsAndSteps(params: {
  recipe: Pick<PlannerCatalogueRecipe, 'id' | 'baseYield' | 'steps'>;
  ingredients: readonly AuditableIngredient[];
  canonicals: ReadonlyMap<string, CanonicalItem>;
  checkPreparation: boolean;
}): CatalogueAudit {
  const { recipe, ingredients, canonicals } = params;
  const findings: CatalogueFinding[] = [];
  const unresolved: string[] = [];

  if (!Number.isFinite(recipe.baseYield) || recipe.baseYield <= 0 || !Number.isInteger(recipe.baseYield)) {
    findings.push({ kind: 'invalid_yield', detail: `baseYield ${recipe.baseYield} is not a whole number of portions` });
  }

  const seen = new Set<string>();
  for (const ingredient of ingredients) {
    if (seen.has(ingredient.canonicalId)) {
      findings.push({ kind: 'duplicate_ingredient', detail: `${ingredient.canonicalId} is listed more than once` });
    }
    seen.add(ingredient.canonicalId);

    if (ingredient.quantity === null || !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
      findings.push({ kind: 'invalid_quantity', detail: `${ingredient.canonicalId} has no usable amount` });
    }
    if (ingredient.unit !== 'g') {
      findings.push({
        kind: 'non_gram_unit',
        detail: `${ingredient.canonicalId} is stated in ${ingredient.unit ?? 'no unit'}; the catalogue carries no weight per piece and a density for only a few ingredients, so this cannot convert to grams`,
      });
    }
    if (params.checkPreparation && ingredient.preparation.trim() === '') {
      findings.push({ kind: 'missing_preparation', detail: `${ingredient.canonicalId} does not say which weight it means` });
    }

    const canonical = canonicals.get(ingredient.canonicalId);
    if (!canonical) {
      findings.push({ kind: 'unknown_canonical', detail: `${ingredient.canonicalId} is not in the catalogue` });
      unresolved.push(ingredient.canonicalId);
      continue;
    }
    const resolved = ingredient.quantity !== null && ingredient.unit !== null
      && catalogueNutrition(canonical, ingredient.quantity, ingredient.unit) !== null;
    if (!resolved) {
      findings.push({ kind: 'unresolved_nutrition', detail: `${ingredient.canonicalId} produces no nutrition at this amount, so this recipe cannot be costed` });
      unresolved.push(ingredient.canonicalId);
    }
  }

  const expected = recipe.steps.map((_, index) => index + 1).join(',');
  if (recipe.steps.map((step) => step.stepNumber).join(',') !== expected) {
    findings.push({ kind: 'step_numbering', detail: 'steps are not numbered 1..n in order' });
  }

  const mentioned = foodTermsInSteps(recipe.steps);
  const listed = new Set(ingredients.map((ingredient) => ingredient.canonicalId));
  const satisfiedIds = new Set<string>();
  for (const term of mentioned) {
    if (ASSUMED_ON_HAND.includes(term)) continue;
    const entry = SORTED_TERMS.find((candidate) => candidate.term === term)!;
    // A generic term such as "chicken" satisfies every listed id it could mean,
    // so a recipe using both breast and thigh does not report one as unused.
    const matches = entry.satisfiedBy.filter((id) => listed.has(id));
    if (matches.length === 0) {
      findings.push({
        kind: 'instruction_names_unlisted_food',
        detail: `a step asks for "${term}", which is not in the ingredient list — the grocery list would not buy it`,
      });
    } else {
      for (const id of matches) satisfiedIds.add(id);
    }
  }

  for (const ingredient of ingredients) {
    if (ingredient.optional) continue;
    if (!satisfiedIds.has(ingredient.canonicalId)) {
      findings.push({
        kind: 'unused_ingredient',
        detail: `${ingredient.canonicalId} is bought but no step says what to do with it`,
      });
    }
  }

  const unknownNutrients: string[] = [];
  const nutrients = [
    ['calories', 'kcalPer100'],
    ['proteinG', 'proteinPer100'],
    ['carbsG', 'carbsPer100'],
    ['fatG', 'fatPer100'],
    ['fibreG', 'fibrePer100'],
  ] as const;
  for (const [label, field] of nutrients) {
    const missing = ingredients.some((ingredient) => {
      const canonical = canonicals.get(ingredient.canonicalId);
      return !canonical || canonical[field] === null;
    });
    if (missing) unknownNutrients.push(label);
  }

  return { recipeId: recipe.id, findings, unresolvedIngredients: unresolved, unknownNutrients };
}

/**
 * Audits the same rules against a plain `MealPrepTemplate`, which is how the
 * seven pre-existing `STARTER_MEAL_PREP_TEMPLATES` can be checked with the
 * identical instruction-versus-ingredient test. Templates carry no preparation
 * basis, so that rule is skipped rather than reported against every one of them.
 */
export function auditMealPrepTemplate(params: {
  template: MealPrepTemplate;
  canonicals: ReadonlyMap<string, CanonicalItem>;
}): CatalogueAudit {
  const { template } = params;
  return auditIngredientsAndSteps({
    canonicals: params.canonicals,
    checkPreparation: false,
    recipe: { id: template.id, baseYield: template.portions, steps: template.steps },
    ingredients: template.ingredients.map((ingredient) => ({
      canonicalId: ingredient.canonicalId,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      preparation: '',
      optional: ingredient.optional ?? false,
    })),
  });
}
