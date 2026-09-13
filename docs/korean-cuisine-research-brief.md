# Brief: Korean recipes for Mise's planning collection

Hand this to the cuisine expert as-is. Everything below the line is the prompt.

**Why it is shaped this way.** Mise computes nutrition from the USDA FoodData Central catalogue it already ships, using a key this repo already has. So the expert must **not** supply calories or macros — those would be unverifiable numbers entering a codebase whose rule is "no recipe enters the collection on the strength of a plausible-looking number." What an expert uniquely provides is the cooking: which dishes represent real Korean home cooking, honest amounts and method, and the Korean-language names. Nutrition, canonical ingredient records, aliases and artwork are mine to wire up afterwards.

---

## What I need from you

You are helping add Korean cuisine to a meal-planning app's small, reviewed recipe collection. It currently holds ten recipes across Chinese, Japanese, Italian, Mediterranean and International. I want **three to four Korean recipes**, covering at least one breakfast-capable dish and at least two that work as lunch or dinner.

Please return **three things**: the recipes, any ingredients the app is missing, and the Korean names. Details follow.

### Hard rules, in priority order

1. **Do not give me any nutrition figures.** No calories, protein, carbs, fat, or fibre. I compute those from cited USDA records. If you include them I will discard them.
2. **Every amount in grams**, for the stated yield. Not cups, not tablespoons, not "1 medium onion". Grams only — the app converts nothing else reliably.
3. **State the weighing basis** for each ingredient: "raw", "dry, weighed before soaking", "drained", "trimmed". 600 g of raw chicken and 600 g of cooked chicken are different foods.
4. **Every ingredient in the list must be used by a step, and every food a step names must be in the list.** An automated audit rejects a recipe that fails either direction. Only water and ice may be used without being listed.
5. **Steps numbered 1..n in order.**
6. **Authenticity over convenience.** If a dish genuinely needs an ingredient the app lacks, say so (see below) rather than substituting something inauthentic. But flag when a substitution is genuinely normal in Korean home cooking versus a Western compromise.

### 1. The ingredient palette the app already has

Prefer these. They are already in the catalogue with the right identity, so recipes built from them need no new data work.

`chicken-breast`, `chicken-thigh`, `ground-pork`, `pork-belly`, `beef-steak`, `ground-beef`, `shrimp`, `eggs`, `tofu-firm`, `white-rice`, `jasmine-rice`, `sweet-potato`, `potato`, `cornstarch`, `napa-cabbage`, `cabbage`, `green-onion`, `yellow-onion`, `garlic`, `ginger`, `cucumber`, `carrot`, `daikon`, `spinach`, `lettuce`, `bell-pepper`, `mushroom`, `shiitake-mushroom`, `gochujang`, `gochugaru`, `soy-sauce-light`, `soy-sauce-dark`, `tamari`, `miso`, `fish-sauce`, `oyster-sauce`, `sesame`, `sesame-oil`, `vegetable-oil`, `mirin`, `rice-vinegar`, `sugar`, `brown-sugar`, `honey`, `salt`, `black-pepper`, `white-pepper`, `sriracha`

Note that **gochujang and gochugaru are already there** — you can build spicy dishes freely.

### 2. Ingredients the app does not have

These are absent. If a recipe needs one, **request it** rather than working around it:

kimchi · doenjang · ssamjang · dangmyeon (sweet potato starch noodles) · gim / laver · mung bean sprouts · perilla leaves · tteok (rice cakes) · dried anchovy · Korean pear

For each one you request, give me:

```
name:            Kimchi
korean:          김치
whatItIs:        one plain sentence, enough to pick the right database record
class:           one of: staple | produce | protein | dairy | seasoning | condiment | frozen | beverage
storage:         one of: pantry | fridge | freezer | counter
typicalUse:      roughly how much a recipe uses at a time, in grams
whyNeeded:       why the dish fails without it
```

Nothing else. I will find the USDA record and build the catalogue entry.

**Please rank your requests.** If kimchi is the one thing that unlocks a genuinely representative set, say so — it costs me the most work and I want to spend it where it matters.

### 3. The recipes

For each recipe:

```
title:              English, plain, what it actually is
korean:             Hangul, plus a romanisation on a separate line
mealTypes:          any of: breakfast | lunch | dinner  (a dish may hold several)
baseYield:          how many portions the amounts below produce
durationMinutes:    realistic total, including unattended time
equipment:          any of: cooktop | oven | microwave | air_fryer | rice_cooker | slow_cooker | blender
                    (empty if genuinely no-cook)
ingredients:
  - id:            the palette id above, or the name of one you requested
    name:          how it should read to a cook
    grams:         for baseYield portions
    preparation:   the weighing basis and prep, e.g. "raw, sliced thinly across the grain"
    optional:      true | false
steps:
  - n:             1, 2, 3...
    instruction:   one or two sentences, naming the ingredients it uses
    equipment:     which appliance, or none
    kind:          one of: prep | cook | assemble | store | no_cook
    minutes:       or none if unattended/indefinite
note:              one sentence on why this recipe earns a place in a ten-recipe
                   collection. Not a health claim.
sources:           where the method comes from — cookbook, named cook, publication.
                   I would rather have two well-sourced recipes than four unsourced ones.
```

### 4. What to do when you are unsure

Say so, in line, in plain words. "Home cooks disagree on whether this is simmered or seared" is useful. A confident invention is not. If you cannot source a dish properly, give me three good recipes instead of four.

### A worked example, from the existing collection

This is the shape and the level of specificity I need. Yours should read like this:

```
title:            Ginger chicken with bok choy and shiitake
mealTypes:        lunch, dinner
baseYield:        4
durationMinutes:  30
equipment:        cooktop
ingredients:
  - id: chicken-breast    name: Chicken breast      grams: 600
    preparation: "raw, boneless and skinless — weigh before cooking"
  - id: shiitake-mushroom name: Shiitake mushroom   grams: 200
    preparation: "fresh, stems removed, sliced"
steps:
  - n: 1  kind: prep  equipment: none     minutes: 8
    instruction: "Slice the chicken breast thinly across the grain and toss it
                  with the light soy sauce and white pepper."
  - n: 2  kind: cook  equipment: cooktop  minutes: 8
    instruction: "Get the vegetable oil hot, then sear the chicken breast in two
                  batches so it browns rather than steams. Set it aside."
```

### 5. Korean-language names

The app stores ingredient aliases **in their original script, never romanised**, and currently has Chinese aliases but no Korean ones at all. So alongside the recipes, give me Hangul for every Korean-specific ingredient you use — including ones already in the palette:

gochujang, gochugaru, napa cabbage, green onion, sesame oil, soy sauce, perilla, and any you request.

Format: `고추장 | gochujang`. Include common alternative spellings if a shopper would plausibly see them on a package.

---

## What happens after you deliver (my side, not yours)

1. Resolve each requested ingredient to a USDA FoodData Central record, add its `fdcId` to `assets/catalogue-fdc-selections.json`, and run `npm run catalogue:build` so nutrition arrives cited rather than typed.
2. Backfill the macros that `gochujang`, `gochugaru`, `napa-cabbage` and `green-onion` are currently missing — they exist but carry no nutrition today, so any recipe using them would render as incomplete.
3. Add the Hangul aliases with `locale: "ko"`.
4. Encode the recipes into `PLANNER_CATALOGUE` and run the ingredient/step audit.
5. Korean then appears in the chooser automatically — the cuisine filter reads recipe labels, not artwork.
6. Generate a Korean tile through the existing Draw Things pipeline and bring it to you for acceptance.

Steps 1–2 are the reason you are not being asked for numbers: that path produces cited provenance, and a hand-typed figure cannot.
