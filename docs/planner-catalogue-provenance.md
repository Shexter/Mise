# The planner catalogue, and where its numbers come from

Provenance for `src/logic/plannerCatalogue.ts` — the reviewed planning
collection built for tasks 2.3–2.5 of
`openspec/changes/lead-with-weekly-meal-planning`. Verified by
`test/planner-catalogue.test.ts` (22 tests) against the shipped catalogue, not
against a fixture.

Read `docs/planner-recipe-nutrition-audit.md` first if you want the argument for
this approach; this file is the receipt.

## The one rule that shaped everything

**Not a single calorie or gram in the collection is typed by hand.**

Each ingredient names a canonical id. The canonical's per-100 g figures come
from the shipped catalogue, which cites one specific USDA FoodData Central
record per field. `snapshotCatalogueRecipe` runs those through
`catalogueNutrition` — the same function the rest of the app uses — and
`sumNutrition` rolls them up per portion, returning `null` for any nutrient it
cannot resolve everywhere.

What **is** authored: titles, amounts, methods, cooking times, yields, meal
types and cuisine labels. That is ordinary recipe judgement, offered for review.
None of it is claimed to be kitchen-tested.

## Why every amount is in grams

The catalogue cannot convert anything else for these foods:

- **`gramsPerPiece` is not a field on `CanonicalItem` at all.** It is an
  optional extra on `MeasureFacts` that a caller may supply from elsewhere, and
  **0 of 116 catalogue rows carry one**. Every `piece` amount therefore
  converts to `null`.
- **Only 13 of 116 rows have a `densityGPerMl`**, so most `ml`, `cup` and
  `tbsp` amounts also fail.
- `g` → `g` is the identity conversion and always resolves.

`auditCatalogueRecipe` reports a `non_gram_unit` finding for anything else, and
a test feeds it "garlic, 2 piece" to prove the check fires.

## Why every ingredient states a preparation basis

600 g of raw chicken and 600 g of cooked chicken are different foods with
different numbers, and the cited source records are specific about which they
are. `PlannerRecipeIngredientSnapshot.preparation` carries that basis onto the
saved snapshot so a scaled amount stays interpretable.

The bases below are read off the FDC record the catalogue cites — they are not
assumptions. Every meat and seafood ingredient here cites a **raw** record
(`chicken-breast`, `chicken-thigh`, `ground-pork`, `pork-belly`, `shrimp`,
`salmon`), so each of those says "weigh before cooking". `tofu-firm`,
`greek-yogurt` and the sauces cite as-sold records and say "as sold" or
"drained"; `oats` cites a dry record and says "dry, measured before cooking".

## Ingredient provenance

Fifty-seven distinct canonical ingredients. `fdcId` is the exact FoodData Central
record from `assets/catalogue-fdc-selections.json`; the record name is from
`assets/catalogue-build-report.json`. Values are per 100 g, as shipped.

Marks record the **grade of evidence**, per decision 202. Unmarked rows are
Foundation or SR Legacy — laboratory composites, the default. **S** is Survey
(FNDDS), USDA's generic composite for dietary studies. **B** is Branded: one
manufacturer's declared label for one product, allowed only as a hand-reviewed
selection and only where no generic record of the same food exists. **K** marks
a row that arrived with the Korean entries on 13 September 2026.

| Canonical id | FDC record | fdcId | kcal | P | C | F | Fibre |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `banana` | Bananas, raw | 173944 | 89 | 1.09 | 22.84 | 0.33 | 2.6 |
| `bean-sprouts` **K** | Mung beans, mature seeds, sprouted, raw | 169957 | 30 | 3.04 | 5.94 | 0.18 | 1.8 |
| `beef-steak` **K** | Beef, flank, steak, boneless, choice, raw | 2646175 | 163.9 | 20.13 | 0 | 9.4 | — |
| `black-pepper` | Spices, pepper, black | 170931 | 251 | 10.39 | 63.95 | 3.26 | 25.3 |
| `bok-choy` | Cabbage, bok choy, raw | 2685572 | 20.26 | 1.02 | 3.51 | 0.23 | 1.26 |
| `brown-sugar` **K** | Sugars, brown | 168833 | 380 | 0.12 | 98.09 | 0 | 0 |
| `carrot` **K** | Carrots, raw | 170393 | 41 | 0.93 | 9.58 | 0.24 | 2.8 |
| `chicken-breast` | Chicken, breast, boneless, skinless, raw | 2646170 | 106.03 | 22.53 | 0 | 1.93 | — |
| `chicken-thigh` | Chicken, thigh, boneless, skinless, raw | 2646171 | 144.07 | 18.61 | 0 | 7.92 | — |
| `cilantro` | Coriander (cilantro) leaves, raw | 169997 | 23 | 2.13 | 3.67 | 0.52 | 2.8 |
| `daikon` **K** | Radishes, oriental, raw | 168451 | 18 | 0.6 | 4.1 | 0.1 | 1.6 |
| `doenjang` **K B** | SUNCHANG DOENJANG SOYBEAN PASTE | 2067532 | 167 | 13.3 | 20 | 3.33 | 0.7 |
| `dried-miyeok` **K S** | Seaweed, dried | 2709988 | 298 | 31.8 | 52.4 | 4.01 | 5.6 |
| `cucumber` | Cucumber, with peel, raw | 2346406 | 15.91 | 0.63 | 2.95 | 0.18 | — |
| `eggs` **K** | Eggs, Grade A, Large, egg whole | 748967 | 148 | 12.4 | 0.96 | 9.96 | 0 |
| `frozen-dumplings` **K** | Potsticker or wonton, pork and vegetable, frozen, unprepared | 169773 | 136 | 8.28 | 13.28 | 5.52 | 1.4 |
| `garlic` | Garlic, raw | 1104647 | 143 | 6.62 | 28.2 | 0.38 | 2.7 |
| `gim` **K** | Seaweed, laver, raw | 168458 | 35 | 5.81 | 5.11 | 0.28 | 0.3 |
| `ginger` | Ginger root, raw | 169231 | 80 | 1.82 | 17.77 | 0.75 | 2 |
| `green-onion` **K** | Onions, spring or scallions (includes tops and bulb), raw | 170005 | 32 | 1.83 | 7.34 | 0.19 | 2.6 |
| `gochugaru` **K B** | MOTHER IN LAW'S, GOCHUGARU KOREAN CHILE FLAKES | 2084510 | 138 | 6.88 | 25 | 6.25 | 17.5 |
| `gochujang` **K B** | GOCHUJANG KOREAN FERMENTED CHILI SAUCE | 2410981 | 225 | 5 | 50 | 0 | 5 |
| `greek-yogurt` | Yogurt, Greek, plain, lowfat | 170903 | 73 | 9.95 | 3.94 | 1.92 | 0 |
| `ground-beef` **K** | Beef, Australian, imported, grass-fed, ground, 85% lean / 15% fat, raw | 173068 | 239 | 17.72 | 0 | 18.12 | 0 |
| `ground-pork` | Pork, ground, raw | 2514745 | 228.27 | 17.81 | 0 | 17.49 | — |
| `hoisin-sauce` | Sauce, hoisin, ready-to-serve | 172886 | 220 | 3.31 | 44.08 | 3.39 | 2.8 |
| `honey` | Honey | 169640 | 304 | 0.3 | 82.4 | 0 | 0.2 |
| `kimchi` **K** | Cabbage, kimchi | 170392 | 15 | 1.1 | 2.4 | 0.5 | 1.6 |
| `lime` | Limes, raw | 168155 | 30 | 0.7 | 10.54 | 0.2 | 2.8 |
| `miso` | Miso | 172442 | 198 | 12.79 | 25.37 | 6.01 | 5.4 |
| `oats` | Oats, whole grain, rolled, old fashioned | 2346396 | 381.63 | 13.5 | 68.66 | 5.89 | — |
| `olive-oil` | Oil, olive, salad or cooking | 171413 | 884 | 0 | 0 | 100 | 0 |
| `oyster-sauce` | Sauce, oyster, ready-to-serve | 174529 | 51 | 1.35 | 10.92 | 0.25 | 0.3 |
| `parmesan` | Cheese, parmesan, hard | 170848 | 392 | 35.75 | 3.22 | 25 | 0 |
| `peanut` | Peanuts, raw | 2515376 | 588.33 | 23.21 | 26.5 | 43.28 | 8.01 |
| `peanut-butter` | Peanut butter, creamy | — | 632 | 24 | 22.7 | 49.4 | 6.32 |
| `pork-belly` | Pork, fresh, belly, raw | 167812 | 518 | 9.34 | 0 | 53.01 | 0 |
| `potato` **K** | Potatoes, flesh and skin, raw | 170026 | 77 | 2.05 | 17.49 | 0.09 | 2.1 |
| `salmon` | Fish, salmon, chinook, raw | 173688 | 179 | 19.93 | 0 | 10.43 | 0 |
| `salt` | Salt, table | 173468 | 0 | 0 | 0 | 0 | 0 |
| `sesame` | Seeds, sesame seeds, whole, dried | 170150 | 573 | 17.73 | 23.45 | 49.67 | 11.8 |
| `sesame-oil` | Oil, sesame, salad or cooking | 171016 | 884 | 0 | 0 | 100 | 0 |
| `shiitake-mushroom` | Mushrooms, shiitake | 1999628 | 44.1 | 2.41 | 8.17 | 0.2 | 4.17 |
| `spinach` **K** | Spinach, raw | 168462 | 23 | 2.86 | 3.63 | 0.39 | 2.2 |
| `shrimp` | Crustaceans, shrimp, raw | 175179 | 85 | 20.1 | 0 | 0.51 | — |
| `soy-sauce-light` | Soy sauce made from soy and wheat (shoyu) | 174277 | 53 | 8.14 | 4.93 | 0.57 | 0.8 |
| `sriracha` | Sauce, hot chile, sriracha | 171186 | 93 | 1.93 | 19.16 | 0.93 | 2.2 |
| `sugar` | Sugars, granulated | 746784 | 385 | 0 | 99.6 | 0.32 | — |
| `tamari` | Soy sauce made from soy (tamari) | 174278 | 60 | 10.51 | 5.57 | 0.1 | 0.8 |
| `tofu-firm` | Tofu, extra firm, prepared with nigari | 174290 | 83 | 9.98 | 1.18 | 5.26 | 1 |
| `tteok` **K B** | KOREAN RICE CAKE | 2167323 | 237 | 5 | 52 | 1 | 1 |
| `tomato` | Tomato, roma | 1999634 | 21.96 | 0.7 | 3.84 | 0.43 | 0.97 |
| `vegetable-oil` | Oil, vegetable, soybean, refined | 172370 | 884 | 0 | 0 | 100 | 0 |
| `white-pepper` | Spices, pepper, white | 170933 | 296 | 10.4 | 68.61 | 2.12 | 26.2 |
| `white-rice` **K** | Rice, white, long-grain, regular, raw, unenriched | 169756 | 365 | 7.13 | 79.95 | 0.66 | 1.3 |
| `yellow-onion` **K** | Onions, yellow, raw | 790646 | 38 | 0.83 | 8.61 | 0.05 | 1.9 |
| `zucchini` **K** | Squash, summer, green, zucchini, includes skin, raw | 2685568 | 19 | 0.98 | 3.27 | 0.21 | 0.75 |

Licence: FoodData Central is CC0 1.0. `peanut-butter`'s record name is recorded
in the build report but its fdcId is not in the selections file; it is the one
row here whose citation is a name rather than an id.

**Caveats, disclosed rather than resolved.** Each is a question for the
catalogue, not for the recipes.

1. The `shiitake-mushroom` record name — "Mushrooms, shiitake" — does not say
   fresh or dried. Its 44 kcal/100 g is consistent with fresh (dried shiitake is
   several times that), and the recipes say "fresh", but the source record does
   not state it.
2. `frozen-dumplings` cites "Potsticker or wonton, pork and vegetable, frozen,
   unprepared". Mandu are also a pork-and-vegetable dumpling in a wheat wrapper,
   so the identity holds, but **the record is not a Korean one** and does not say
   mandu. Mandu-guk is costed on a potsticker. A reviewer who thinks that is too
   loose should read the soup's figures as approximate rather than cited.
3. `beef-steak` cites flank. Bulgogi is more often sirloin or ribeye, which are
   fattier, so its 306 kcal a portion is a floor rather than a midpoint. The
   recipes say flank in their preparation basis for that reason.
4. `white-rice` cites long-grain. Bibimbap and most Korean rice are short-grain.
   The two are close enough in composition that no recipe amount was changed for
   it, but the record does say long-grain.
5. **`gochugaru`'s record contradicts itself, and ships anyway.** "Mother in
   Law's Gochugaru Korean Chile Flakes" declares 6.88 g protein, 25 g
   carbohydrate and 6.25 g fat per 100 g, which compute to **184 kcal**, against
   a declared **138 kcal**. It is the right food — the ingredient list is "a
   blend of dried red chile flakes" — and every other candidate in FDC was worse:
   Wang's Korean pepper powder declares 0 kcal, and cayenne is a different
   chilli. Shipping it was an explicit call, recorded here rather than smoothed
   over. The stake is small — 8 g in a four-portion stew is about 3 kcal a
   portion either way — but the figure is not internally consistent and a
   reviewer should know that before trusting it at larger amounts.
6. **`gochujang` is one brand out of a wide spread.** FDC's branded gochujang
   records run from 167 to 300 kcal/100 g, because brands differ enormously in
   sugar. The catalogue cites Jayone's at 225. Bibimbap uses 80 g across four
   portions, so the spread is worth roughly ±27 kcal a portion. Nothing was
   averaged, because an average is a number no record supports.
7. **`dried-miyeok` cites "Seaweed, dried", not dried wakame.** FNDDS has no
   wakame-specific dried record, and SR Legacy's "Seaweed, wakame, raw" is the
   right species on the wrong basis — the recipe weighs 20 g dry, and a raw
   record would have understated it by roughly tenfold. The generic dried record
   gets the basis right and the species only approximately. Its 31.8 g protein
   suggests the composite leans towards laver. Miyeokguk's seaweed is about 15
   kcal a portion, so the choice moves little.
8. `gim` cites "Seaweed, laver, raw" while both soups weigh a dry toasted sheet
   — the same basis mismatch as 7, left in place because it predates this work
   and because 4 g of gim is about 0.4 kcal a portion. It should still be fixed.

## The collection

Nineteen entries. Meal-type counts exceed the required three because twelve
recipes serve more than one meal type, which the design allows.

| Recipe | Meal types | Cuisine | Yield | Appliance |
| --- | --- | --- | --- | --- |
| Overnight oats with banana and peanut butter | breakfast | International | 1 | **none** |
| Miso soup with tofu, shiitake and bok choy | breakfast, lunch | Japanese | 1 | cooktop |
| Savoury oat porridge with shiitake and ginger | breakfast | Chinese | 1 | cooktop |
| Smashed cucumber and sesame tofu salad | lunch | Chinese | 2 | **none** |
| Ginger chicken with bok choy and shiitake | lunch, dinner | Chinese | 4 | cooktop |
| Garlic shrimp with roma tomatoes | lunch, dinner | Mediterranean | 3 | cooktop |
| Soy-braised pork belly with bok choy | dinner | Chinese | 4 | cooktop |
| Miso-glazed salmon with bok choy | dinner | Japanese | 3 | oven |
| Braised tofu with ginger pork | dinner | Chinese | 3 | cooktop |
| Roast chicken thighs with tomato and parmesan | dinner | Italian | 4 | oven |
| Korean rolled omelette | breakfast, lunch, dinner | Korean | 3 | cooktop |
| Bulgogi, marinated grilled beef | lunch, dinner | Korean | 4 | cooktop |
| Mandu-guk, Korean dumpling soup | lunch, dinner | Korean | 4 | cooktop |
| Kimchi stew with pork belly and tofu | lunch, dinner | Korean | 4 | cooktop |
| Doenjang stew with pork, daikon and tofu | lunch, dinner | Korean | 4 | cooktop |
| Bibimbap with beef, vegetables and egg | lunch, dinner | Korean | 4 | cooktop |
| Miyeokguk, seaweed soup with beef | breakfast, lunch, dinner | Korean | 4 | cooktop |
| Tteokguk, rice cake soup | breakfast, lunch, dinner | Korean | 4 | cooktop |
| Tteok-mandu-guk, rice cake and dumpling soup | lunch, dinner | Korean | 4 | cooktop |

- **Breakfast 6, lunch 13, dinner 15.** Task requirement is three each.
- **Two entries cook nothing and need no appliance** — the overnight oats
  (breakfast, the required no-cook option) and the cucumber salad (lunch).
  `isNoCook` requires both an empty appliance list and no cooking step, so the
  claim is checkable rather than asserted.
- **Sixteen of nineteen are Chinese, Japanese or Korean**, spread across
  breakfast, lunch and dinner rather than clustered into dinner.
- **Three entries serve all three meal types** — the rolled omelette, miyeokguk
  and tteokguk. That is where breakfast's sixth slot comes from; six separate
  breakfasts were not authored.
- **Korean is nine of nineteen, which is a real imbalance and a deliberate one.**
  The nine came from a single commissioned brief and all nine now cost cleanly.
  Three of them — mandu-guk, tteokguk and tteok-mandu-guk — are one bowl in three
  configurations, and a reviewer trimming the collection should start there.

## Computed nutrition per portion

Pinned in the test, so a change to a recipe amount or to a canonical's source
data fails loudly rather than drifting.

| Recipe | kcal | Protein g | Carb g | Fat g | Fibre g |
| --- | --- | --- | --- | --- | --- |
| Overnight oats with banana and peanut butter | 516.4 | 27.9 | 72.3 | 14.1 | **unknown** |
| Miso soup with tofu, shiitake and bok choy | 212.1 | 16.4 | 13.6 | 11.7 | 5.3 |
| Savoury oat porridge with shiitake and ginger | 316.4 | 11.2 | 48.7 | 8.7 | **unknown** |
| Smashed cucumber and sesame tofu salad | 364.3 | 23.3 | 17.0 | 24.5 | **unknown** |
| Ginger chicken with bok choy and shiitake | 264.8 | 37.3 | 11.0 | 8.4 | **unknown** |
| Garlic shrimp with roma tomatoes | 255.9 | 31.6 | 7.6 | 11.4 | **unknown** |
| Soy-braised pork belly with bok choy | 842.8 | 16.7 | 12.7 | 80.1 | **unknown** |
| Miso-glazed salmon with bok choy | 398.5 | 35.8 | 13.7 | 21.8 | 2.4 |
| Braised tofu with ginger pork | 352.8 | 31.1 | 5.5 | 24.6 | **unknown** |
| Roast chicken thighs with tomato and parmesan | 364.6 | 34.4 | 5.5 | 23.1 | **unknown** |
| Korean rolled omelette | 165.8 | 10.6 | 2.5 | 12.3 | 0.5 |
| Bulgogi, marinated grilled beef | 306.3 | 26.7 | 10.2 | 18.1 | **unknown** |
| Mandu-guk, Korean dumpling soup | 286.3 | 22.2 | 17.8 | 14.1 | **unknown** |
| Kimchi stew with pork belly and tofu | 406.6 | 14.3 | 11.0 | 35.1 | **unknown** |
| Doenjang stew with pork, daikon and tofu | 213.3 | 15.6 | 11.9 | 12.3 | **unknown** |
| Bibimbap with beef, vegetables and egg | 737.4 | 27.3 | 96.4 | 26.4 | **unknown** |
| Miyeokguk, seaweed soup with beef | 152.9 | 14.9 | 4.2 | 9.1 | **unknown** |
| Tteokguk, rice cake soup | 384.7 | 19.0 | 54.3 | 10.3 | **unknown** |
| Tteok-mandu-guk, rice cake and dumpling soup | 447.9 | 25.2 | 53.2 | 15.0 | **unknown** |

**Calories, protein, carbohydrate and fat are known for all nineteen.** Fibre is
known for three.

Sixteen report fibre as `null`, and that is the correct reading, not a defect in
the recipes. Eight shipped canonicals carry no fibre value —
`beef-steak`, `chicken-breast`, `chicken-thigh`, `cucumber`, `ground-pork`,
`oats`, `shrimp` and `sugar` — and one such ingredient is enough to make a
recipe's fibre unresolvable. `beef-steak` alone accounts for five of the Korean
entries, and `sugar` for two more.

Bibimbap at 737 kcal is the largest portion in the collection after the pork
belly braise, and it is rice: 360 g raw white rice across four bowls is 328 kcal
a portion before anything else is added. The brief as delivered said 720 g raw,
which computed to 1,066 kcal a portion — double a standard Korean rice serving.
That amount was halved, which is an authored judgement and is recorded as one.

**`null` here means unknown and is displayed as unknown. It is never rendered as
zero**, which is the defect the incumbent Cook-and-log path still has
(`docs/ui-overhaul/planner-baseline/11-cook-and-log-review.png`).

Fibre is a first-class metric on Today, so this is a visible gap. Filling those
eight canonicals from FoodData Central would close it without touching a recipe.

The pork belly braise is genuinely 842 kcal a portion. The figures are the cited
raw pork belly at 518 kcal/100 g; nothing was lightened to make the number look
better.

## What the audit checks

`auditCatalogueRecipe` enforces the rules above so a later edit cannot quietly
break them. Findings:

| Kind | Catches |
| --- | --- |
| `unknown_canonical` | an ingredient id the catalogue does not have |
| `unresolved_nutrition` | an ingredient that produces no nutrition at its stated amount |
| `non_gram_unit` | a unit the catalogue cannot convert for this food |
| `invalid_quantity` | a missing, zero or negative amount |
| `invalid_yield` | a yield that is not a whole number of portions |
| `duplicate_ingredient` | the same canonical listed twice |
| `missing_preparation` | an amount that does not say which weight it means |
| `unused_ingredient` | something bought that no step ever uses |
| `instruction_names_unlisted_food` | a step asking for a food the grocery list would not buy |
| `step_numbering` | steps not numbered 1..n in order |

### The instruction check has teeth

`foodTermsInSteps` scans the method for a vocabulary of food terms, longest
first, blanking each match so "light soy sauce" is not also counted as "soy
sauce". Every term found must be one of the recipe's ingredients, or one of the
two foods in `ASSUMED_ON_HAND` — **water and ice**, which are not bought and so
get no grocery line. That exemption is explicit and is the only one.

It is verified against a real defect rather than a toy: run over the shipped
`slow-cooker-chicken-stew`, it reports that a step asks for **"stock"** which is
not in the ingredient list — the exact finding
`docs/planner-recipe-nutrition-audit.md` reached by hand. A second test asserts
that **all seven** pre-existing `STARTER_MEAL_PREP_TEMPLATES` still fail this
audit, which is why the collection is new rather than a reuse of them. If one
ever passes, the catalogue gap behind it was filled.

## Dietary eligibility is derived, never declared

No entry carries a `dietaryTags` field, and `PlannerRecipeSnapshot` has none.
Eligibility comes from `plannerRecipeEligible`'s `excludedCanonicalIds`, which
the existing dietary system expands over the catalogue's parent/child graph.

The graph makes some useful facts checkable:

- `soy-sauce-light` is a child of **both `wheat` and `soy`** — and its cited FDC
  record is literally "Soy sauce made from soy **and wheat** (shoyu)". A recipe
  using it is correctly excluded for someone avoiding wheat.
- `hoisin-sauce` is likewise a child of `wheat` and `soy`.
- `oyster-sauce` → `shellfish`, `salmon` → `fish`, `greek-yogurt` → `milk`,
  `peanut-butter` → `peanut`, `sesame-oil` and `tahini` → `sesame`,
  `tofu-firm` and `miso` → `soy`.

A test excludes `soy-sauce-light` and `hoisin-sauce` and asserts the shoyu
recipes drop out while the tamari ones stay.

### A gap that is not mine to fix, and matters

**`tamari` has no parent edge in `assets/canonical-derivatives.json`.** It
should be a child of `soy` — it is brewed from soybeans, and its own FDC record
says so. As shipped, someone who excludes soy will still be offered every tamari
recipe, including two in this collection.

I did not fix it: `assets/` is outside this task's write scope, and it is a
one-line seed change plus a migration decision. **It should be fixed before the
picker ships.** `sriracha` similarly has no in-script alias, which is a smaller
coverage gap in the same file.

## Asian coverage is more than a cuisine label

Decision 4 says deep Asian ingredient coverage is the differentiator and that
aliases are stored in script, never romanised. The collection leans on
ingredients that actually exercise it, and a test asserts each of these has at
least one non-ASCII alias in the shipped alias table:

| Ingredient | Aliases in script |
| --- | --- |
| `soy-sauce-light` | 生抽, 醬油, 酱油, 醤油, しょうゆ |
| `miso` | 味噌 |
| `bok-choy` | 青菜, 小白菜, 청경채 |
| `shiitake-mushroom` | 香菇, 椎茸, 표고버섯 |
| `tofu-firm` | 豆腐, 두부, とうふ |
| `sesame-oil` | 麻油, 香油, 참기름, ごま油 |
| `pork-belly` | 五花肉, 삼겹살, 豚バラ |
| `oyster-sauce` | 蚝油, 蠔油 |
| `hoisin-sauce` | 海鲜酱, 海鮮醬 |
| `ginger` | 姜, 生姜, 생강 |
| `cilantro` | 香菜, 고수 |

Korean coverage is now the deepest of the three scripts by count: **32 canonicals
carry a Hangul alias**, including every ingredient specific to the nine Korean
entries.

| Ingredient | Hangul |
| --- | --- |
| `kimchi` | 김치 |
| `gochujang` | 고추장 |
| `gochugaru` | 고춧가루 |
| `doenjang` | 된장 |
| `tteok` | 떡, 가래떡, 떡국떡 |
| `dried-miyeok` | 미역, 마른 미역 |
| `gim` | 김 |
| `frozen-dumplings` | 냉동 만두, 만두 |
| `soy-sauce-light` | 간장 |
| `green-onion` | 대파, 파 |
| `napa-cabbage` | 배추 |
| `daikon` | 무 |
| `eggs` | 계란, 달걀 |

`frozen-dumplings` answering to both 만두 and 饺子 is the identity layer working
as designed: one food, one canonical, two languages naming it — not two rows
that would each have needed their own nutrition and their own artwork.

## Korean, and what it cost to cite it

Added 13 September 2026. A cuisine expert was briefed
(`docs/korean-cuisine-research-brief.md`) and deliberately asked **not** to
supply calories or macros, because a hand-typed figure cannot be cited. Nine
recipes came back. All nine are now in the collection, but they arrived in two
passes, and the gap between them is the part worth recording.

**First pass: three entered, six did not.** The rule is that every ingredient
must resolve to a canonical the catalogue can cost. `gochujang`, `gochugaru`,
`doenjang`, `tteok` and `dried-miyeok` existed as canonicals with real
identities and Hangul aliases but carried no nutrition, so six recipes failed —
including the two most representative dishes in the set.

| Recipe | Costable by mass, first pass | Was blocked on |
| --- | --- | --- |
| Gyeran-mari, rolled omelette | 100% | — |
| Bulgogi, marinated grilled beef | 100% | — |
| Mandu-guk, dumpling soup | 100% | — |
| Kimchi-jjigae, kimchi stew | 97% | `gochugaru`, `gochujang` |
| Bibimbap | 96% | `gochujang` |
| Doenjang-jjigae | 94% | `doenjang`, `gochugaru` |
| Miyeokguk, seaweed soup | 94% | `dried-miyeok` |
| Tteok-mandu-guk | 71% | `tteok` |
| Tteokguk, rice cake soup | 49% | `tteok` |

**Second pass: the blockage was ours, not FoodData Central's.** The build script
searched Foundation and SR Legacy only (`scripts/build-catalogue.ts`), two of
FDC's five data types. Searched properly, FDC carries records for four of the
five — as Branded entries — and a generic Survey (FNDDS) record covers the
fifth. Decision 202 widened what the catalogue may cite, with the grade recorded
per ingredient. All five resolved, and all six recipes entered.

What that cost, stated plainly:

- **Four of the five rest on one manufacturer's label**, not a laboratory
  composite. `tteok` is the best of them — "Korean rice cake", ingredients *rice,
  water, salt*, declared against a 100 g serving, and its macros reconcile with
  its calorie figure exactly. `doenjang` reconciles within 2%. `gochujang` sits
  in the middle of a 167–300 kcal spread across brands. `gochugaru` does not
  reconcile at all and is documented above as caveat 5.
- **A pipeline change was needed.** FDC's `/foods` endpoint returns a Branded
  record's nutrients as anonymous rows with no nutrient names; only
  `format=abridged` names them. Branded ids are therefore re-fetched that way, in
  a path generic records never enter, so no existing figure could move as a side
  effect. The build confirms it: re-running it changed exactly five canonicals
  and nothing else.
- **The app cannot yet show the difference.** `SourceId` has a single value for
  all of FoodData Central, so the disclosure line reads the same for a laboratory
  composite and for a label. That is a real gap, recorded in decision 202.

Four judgement calls made along the way:

- **One canonical for one food.** `mandu` was not added. `frozen-dumplings`
  already existed and already answered to `만두` and `mandu`, so both dumpling
  soups point at that row rather than splitting one food across two identities.
- **Bulgogi bought 80 g of onion and used only the grated half.** The sliced half
  now goes in with the sear.
- **Bibimbap's rice was halved**, from 720 g raw to 360 g — see the note under
  the nutrition table.
- **A recorded decision survived unchanged.** A `진간장` → `soy-sauce-light` alias
  was drafted and then removed: `src/logic/__fixtures__/cjk-lines.ts` records
  that 진간장 is a real, different product and is **correctly left unresolved**.
  The fixture won.

Three things the collection gained that are not about Korea:

- `white-rice`, `eggs`, `spinach`, `carrot` and `potato` had no nutrition when
  this collection was first authored and have since been filled, which is what
  let bibimbap and the omelette exist at all.
- The audit's food vocabulary now knows `kimchi`, `gochujang`, `gochugaru`,
  `doenjang`, `tteok`, `rice cakes`, `miyeok`, `seaweed`, `gim`, `mandu`,
  `dumplings`, `beef`, `brown sugar`, `daikon`, `zucchini` and `bean sprouts`,
  so a step naming any of them is checked against the ingredient list rather
  than passing unexamined.
- Korean joined the release cuisine vocabulary in `src/logic/cuisines.ts`. The
  chooser reads recipe labels, so the filter appeared on its own. A Korean
  Draw Things candidate now exists in `.art-staging/cuisine/`, but the shipped
  registry still has no Korean artwork and the rail keeps its labelled initial
  until that exact candidate receives named human/native acceptance.

## What the catalogue could not support, and what I did instead

These are the honest limits. In each case the alternative would have been to
state a number nothing in the repository can defend.

**Most carbohydrate staples still have no nutrition.** `jasmine-rice`,
`brown-rice`, `bread`, `dried-pasta`, `tortilla`, `red-lentils`,
`canned-chickpeas` and `canned-black-beans` are all empty, and so are `milk`,
`broccoli`, `bell-pepper`, `mushroom` and `lettuce`.

`white-rice`, `eggs`, `spinach`, `carrot` and `potato` were empty when this
collection was first authored and have since been filled from FoodData Central.
That is what let the Korean entries use eggs and rice, and it is why the
paragraph below is shorter than it was.

Some of the remaining gaps are now gaps by choice rather than by absence:
decision 202 permits a reviewed Branded record where no generic one exists, and
spot-checking FDC finds usable branded records for `mirin` (Mizkan, 300 kcal)
and `doubanjiang` (House Foods mabo tofu sauce, 79 kcal). Neither was filled
here, because neither blocked a recipe in front of us and a widened rule is not
a mandate to use it everywhere. `rice-vinegar`'s branded records mostly declare
0 kcal, which for vinegar may well be right and may equally be label rounding;
it needs a look, not a copy.

Consequences a reader should know about:

- **There is now a rice dish**, which there was not when this document was first
  written. `white-rice` and `gochujang` both became costable, and bibimbap is in
  the collection. The savoury oat porridge is no longer standing in for a
  missing category; it is there on its own merits.
- **"Braised tofu with ginger pork" is deliberately not called mapo tofu.**
  `doubanjiang` still has no nutrition, so the dish that needs it still could not
  be costed, and naming it mapo without the bean paste would be a false label.
  Under decision 202 this one is now fillable and simply has not been filled.
- **The dishes skew protein-and-vegetable** because the grains that would round
  them out are unsourceable. That is a catalogue consequence, not a nutritional
  opinion.

Filling the remaining grains would unlock most of the missing shapes. That is a
catalogue task — `scripts/build-catalogue.ts` against FoodData Central — not a
recipe-authoring task.

## Verification

First authoring pass (ten entries):

- `npm run typecheck` — clean.
- `npx vitest run test/planner-catalogue.test.ts` — **22 passed**.
- `npm test` — **166 files passed, 1 skipped; 1819 tests passed, 1 skipped.**

After all nine Korean entries, 13 September 2026:

- `npx tsc --noEmit` — clean.
- `npx vitest run test/planner-catalogue.test.ts` — **22 passed**.
- `npx vitest run` — **171 files passed, 1 skipped; 1961 tests passed, 1 skipped.**
- `npm run catalogue:build` — FoodData Central matched 72 of 123, up from 67.
  Diffing `assets/canonical-items.json` before and after shows **exactly five
  canonicals changed** — `gochujang`, `gochugaru`, `doenjang`, `tteok`,
  `dried-miyeok` — and no other row moved.

Files written by the first pass: `src/logic/plannerCatalogue.ts`,
`test/planner-catalogue.test.ts`, `docs/planner-catalogue-provenance.md`.

Files written by the Korean passes: those three, plus `src/logic/cuisines.ts`
(Korean joins the release vocabulary), `test/cuisine-chooser.test.ts` and
`test/cuisine-asset-staging.test.ts` (both asserted that Korean had no recipes;
one of them asserted artwork and recipes matched exactly, which is now a one-way
rule), `scripts/build-catalogue.ts` (the branded fetch path),
`assets/catalogue-fdc-selections.json` and `assets/canonical-items.json` (five
reviewed selections and the figures they produced),
`assets/catalogue-build-report.json`, and `docs/product-decisions.md`
(decision 202). The follow-up cuisine-art pass also updates
`assets/illustration-briefs.json` and the active Today/cuisine OpenSpec artifacts,
and stages the unshipped Korean candidate. No change to core contracts, the
database, or package files.
