# Where planner recipe nutrition can honestly come from

An audit of every local source of recipe nutrition in the repository at commit
`5814bf2`, written for tasks 2.3–2.5 of
`openspec/changes/lead-with-weekly-meal-planning` ("author and audit at least
three breakfast / lunch / dinner choices … with sourced nutrition").

**No recipe facts are invented in this document.** Every number below is read
from a file in this repository or from a screen of the running app, and every
gap is reported as a gap.

## Short version

The app already owns a licensed, per-field-sourced nutrition dataset and a
rollup that refuses to turn a missing nutrient into a zero. Neither is wired to
the starter recipes, and the ingredients those recipes depend on are among the
59% of the catalogue that has no nutrition yet.

**Recommendation: do not author per-recipe nutrition figures. Compute recipe
nutrition from the catalogue with the existing rollup, and spend the catalogue
task on filling the specific canonical ingredients the launch collection needs.**
That converts an authoring problem with no defensible source into a data problem
with a public, already-integrated one.

**All seven current starter templates would render as "Nutrition incomplete",**
for two separate reasons that need separate fixes:

1. Four canonicals have no nutrition at all — `jasmine-rice`, `broccoli`,
   `eggs`, `potato`.
2. **No canonical in the catalogue carries a weight per piece**, so any
   ingredient stated in `piece` cannot be converted to grams and contributes
   nothing — `garlic`, `eggs`, `yellow-onion`, `cucumber` in these recipes.

The second is the less obvious one and it is not a catalogue-coverage problem;
it is a missing field. See "The gap that actually blocks the launch collection".

## The four local sources, and what each can defend

### 1. `STARTER_MEAL_PREP_TEMPLATES` — 7 recipes, zero nutrition

`src/logic/mealPrepTemplates.ts`. Seven authored templates with titles,
portions, duration, required appliances, ingredients with quantity and unit, and
numbered `CookingGuideStep`s.

**`MealPrepTemplate` has no nutrition field at all** (`src/types.ts`). Not a
null one — the interface does not model calories or macros. So the current
starter set cannot supply a single nutrition figure, and the planner's
"estimated nutrition" on a picker row has nothing to read.

Three further defects found while reading them, each an instance of something
`design.md` predicted:

- **Instructions name ingredients that are not in the ingredient list.**
  `slow-cooker-chicken-stew` step 2 calls for "2 cups of water or **stock**";
  the ingredient list is chicken, potatoes, onions, garlic. Grocery demand
  computed from the ingredient list will not buy the stock.
- **Ingredient basis is inconsistent with the canonical identity.**
  `stovetop-egg-fried-rice` lists `canonicalId: 'jasmine-rice'` under the
  display name "Cooked rice" at 300 g. The canonical is dry rice. Anything that
  scales this — grocery demand, portion fitting, nutrition — will be wrong by
  roughly the cooking hydration factor, and there is no field recording which
  basis is meant.
- **`dietaryTags` are unverified strings with no consumer.** `grep` finds
  `dietaryTags` in exactly two places: the interface, and the seven literals.
  Nothing reads them. The real dietary system (`src/logic/dietary.ts`,
  `expandRules` / `applyDietary`) works from the user's own rules expanded over
  canonical derivatives and never consults these tags. Meanwhile
  `microwave-steamed-salmon-greens` is tagged `gluten_free` while containing
  `soy-sauce-light`. The catalogue holds no gluten attribute for that canonical,
  so nothing in this repository either supports or refutes the tag — and soy
  sauce is commonly wheat-brewed, which is exactly why an unverifiable label
  should not ship as a dietary claim.

**Verdict: usable as recipe *content* after correction; unusable as a nutrition
source. The tags must not ship as dietary claims until they are derived rather
than asserted.**

### 2. User-saved recipes — no yield, no nutrition, by schema

`recipes` and `recipe_ingredients` (`src/db/schema.ts:569–591`). Columns are
`title`, `source_link`, `steps_json`, `image_uri`, `status`, timestamps; and per
ingredient `name`, `quantity`, `unit`, `canonical_id`, `sort_order`.

**There is no servings/yield column and no nutrition column.** Confirmed on
device: recipe detail (`docs/ui-overhaul/planner-baseline/09-recipe-detail-top.png`)
shows kitchen coverage, ingredients, method and one action, with no portions and
no nutrition anywhere.

The same capture also shows the ingredient/instruction disagreement is not
theoretical in user data either: the demo recipe `Miso tofu rice bowl` lists
firm tofu, jasmine rice and miso, while its method says "sear in pan with a
touch of **oil**" and "dress the bowl with **steamed greens**". Its rice is
stated as `1 cup` — a volume for a dry staple.

**Verdict: yield is unknown at the schema level. The planner must treat every
saved recipe's yield as unknown and ask, rather than assume one serving.**

### 3. The dinner engine — real per-serving figures, but provider-estimated

`app/dinner.tsx` produced, offline from cache during this audit
(`docs/ui-overhaul/planner-baseline/13-dinner-settled.png`):

> Pork Belly and Egg Fried Rice · 20g Protein · 40g Carbs · 24g Fat ·
> **~460 kcal · Estimated** · 2/2 on hand

`Suggestion` carries `kcalPerServing`, `servings` and
`estimatedNutritionPerServing`. The label on screen says `Estimated`, and it is
honest: these are a provider's whole-dish figures, not measured or sourced ones.

**Verdict: a legitimate fallback that must keep its `Estimated` label. Not
"sourced nutrition" for a launch collection, and it needs a provider key, which
the planner's core loop must not.**

### 4. The canonical catalogue — the only *sourced* nutrition, and it is good

`assets/canonical-items.json`, built by `scripts/build-catalogue.ts`, seeded
through migrations. `CanonicalItem` carries `kcalPer100`, `proteinPer100`,
`carbsPer100`, `fatPer100`, `fibrePer100`, twenty micronutrients,
`densityGPerMl`, `typicalUseQty/Unit`, `typicalPkgQty/Unit`, and
`sources: Partial<Record<string, SourceId>>` — **per-field provenance**.

From `assets/catalogue-build-report.json`, the sources are:

| Source | Licence | Use here |
| --- | --- | --- |
| USDA FoodData Central | CC0 1.0 | Nutrition per 100 g |
| McCance & Widdowson's CoFID 2021 | Open Government Licence v3.0 | Nutrition per 100 g |
| USDA FoodKeeper (2025-07-02 snapshot) | US federal work, public domain | Shelf life |

Redistributable, attributable, already integrated, and already surfaced:
`nutritionSourceLabel()` in `src/logic/nutrition.ts` renders
"Nutrition from USDA FoodData Central." and "Nutrition from the UK CoFID
dataset."

Current coverage across **116 canonical ingredients**:

| Field | Populated |
| --- | --- |
| `kcalPer100` | 48 |
| `proteinPer100` | 50 |
| `carbsPer100` | 48 |
| `fatPer100` | 47 |
| `fibrePer100` | 39 |
| complete kcal + P/C/F | **47** |
| `densityGPerMl` | **13** |
| `typicalUseQty` | 116 |
| `typicalPkgQty` | 28 |

Build report: FoodData Central queried 77 and matched 49; CoFID reviewed 1 and
matched 1; FoodKeeper matched 23 of 661 rows; **506 skipped, 17 conflicts**.

**Verdict: this is the source to build on.**

## The machinery is already written

Two functions do exactly what `meal-plan-nutrition` specifies, and neither needs
inventing:

- **`catalogueNutrition(canonical, quantity, unit)`** —
  `src/logic/nutrition.ts:59`. Converts to grams via `convert()`, scales the
  per-100 g values, returns `{ values, source }` with the `SourceId` that
  produced them. **Returns `null` when the conversion fails**, which is what
  happens for a volume amount of an ingredient with no `densityGPerMl` — no
  invented density.
- **`nutritionFromSuggestion(suggestion, canonicals)`** —
  `src/logic/suggestionService.ts`. Rolls per-ingredient values into a
  per-serving total, tracks an `unresolved` set per nutrient, and returns
  **`null` rather than a partial sum** for any nutrient it could not resolve
  everywhere. A provider estimate is used only as a whole-dish substitute for an
  undefensible local total, never added on top.

Its own comment states the contract the planner needs verbatim: *"Unknown
conversion or nutrient values stay null; no missing figure is ever laundered
into zero."*

The planner's job is to point this at a recipe snapshot's resolved ingredients.
It is not to author numbers.

## The gap that actually blocks the launch collection

Every distinct canonical used by the seven starter templates, checked against
the shipped catalogue, with the unit each template states it in:

| Canonical | Stated as | kcal | P | C | F | fibre | density | Resolves? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `chicken-breast` | g | 106.0 | 22.5 | 0 | 1.9 | — | — | yes (fibre unknown) |
| `jasmine-rice` | g | — | — | — | — | — | — | **no — no nutrition** |
| `broccoli` | g | — | — | — | — | — | — | **no — no nutrition** |
| `eggs` | piece | — | — | — | — | — | — | **no — no nutrition and no weight per piece** |
| `potato` | g | — | — | — | — | — | — | **no — no nutrition** |
| `soy-sauce-light` | ml | 53 | 8.14 | 4.93 | 0.57 | 0.8 | 1.15 | yes |
| `garlic` | piece | 143 | 6.62 | 28.2 | 0.38 | 2.7 | — | **no — no weight per piece** |
| `olive-oil` | ml | 884 | 0 | 0 | 100 | 0 | 0.91 | yes |
| `tofu-firm` | g | 83 | 9.98 | 1.18 | 5.26 | 1 | — | yes |
| `yellow-onion` | piece | 38 | 0.83 | 8.61 | 0.05 | 1.9 | — | **no — no weight per piece** |
| `cucumber` | piece | 15.9 | 0.63 | 2.95 | 0.18 | — | — | **no — no weight per piece** |
| `salmon` | g | 179 | 19.93 | 0 | 10.43 | 0 | — | yes |

### Cause 1 — four canonicals have no nutrition

`jasmine-rice`, `broccoli`, `eggs` and `potato` are empty across kcal and all
macros. This is catalogue coverage: they are four of the 506 rows the build
report skipped.

### Cause 2 — nothing in the catalogue has a weight per piece

`convert()` refuses a count-to-mass conversion without a weight per unit, which
is correct. But `gramsPerPiece`, `gramsPerSlice` and `gramsPerServing` are **not
fields on `CanonicalItem`** at all — they are optional extras on `MeasureFacts`
(`src/logic/measures.ts:29–39`) that a caller may supply from elsewhere, such as
a scanned product. Checked directly: **0 of 116 catalogue rows carry a
`gramsPerPiece`.**

So every `piece` amount resolves to null from the catalogue alone. Sixteen of
116 canonicals have `typicalUseUnit: 'piece'`, and six of those already have
nutrition that is currently unreachable for this reason — `garlic`,
`yellow-onion`, `banana`, `tomato`, `cucumber`, `lime`. Filling nutrition for
more ingredients does not fix these; adding the field does.

### The result

Because `nutritionFromSuggestion` marks a nutrient unresolved when any
contributing ingredient fails, **all seven starter templates would render as
"Nutrition incomplete"**, and each fails for its own mix of the two causes:

| Template | Fails on |
| --- | --- |
| `rice-cooker-chicken-rice` | `jasmine-rice` |
| `sheet-pan-roasted-chicken-veg` | `broccoli` |
| `air-fryer-crispy-tofu-bowl` | `broccoli` |
| `stovetop-egg-fried-rice` | `jasmine-rice`, `eggs` (both causes) |
| `slow-cooker-chicken-stew` | `potato`, `yellow-onion` |
| `no-cook-tofu-cucumber-bowl` | `cucumber` (weight per piece only) |
| `microwave-steamed-salmon-greens` | `broccoli` |

That includes both rice dishes, which the Asian-coverage requirement leans on,
and the no-cook breakfast candidate — which is otherwise the closest to ready,
since `cucumber` already has nutrition and needs only a weight per piece.

Optional ingredients do not rescue any of these: excluding the optional garlic
from every template leaves each row above unchanged.

`jasmine-rice` additionally has no `densityGPerMl`, so the saved demo recipe's
`1 cup` cannot convert to grams either. Correct behaviour today, and it means a
volume-stated staple contributes nothing until a density or a gram amount
exists.

## Recommendation

1. **Compute, never author.** Recipe nutrition comes from
   `catalogueNutrition` over the snapshot's resolved ingredients, rolled up with
   the existing unresolved-tracking. The recipe record stores per-nutrient
   provenance, not hand-typed totals. This satisfies "sourced nutrition" in
   tasks 2.3–2.5 with a citable source instead of an assertion.
2. **Make the catalogue task the real content task.** Run
   `scripts/build-catalogue.ts` to fill `jasmine-rice`, `broccoli`, `eggs` and
   `potato` from FoodData Central first — four rows, and they clear cause 1 for
   six of the seven templates. The 506 skipped rows are the wider backlog; only
   the launch collection's ingredients are on the critical path.
3. **Decide how a `piece` amount becomes grams, before authoring anything in
   `piece`.** This is cause 2 and it is a schema question, not a coverage one.
   The options, in the order I would try them:
   - **Author the launch collection in mass and volume only.** Zero new fields,
     immediately unblocks `no-cook-tofu-cucumber-bowl`, and costs recipe
     readability ("120 g cucumber" reads worse than "1 cucumber"). It is also
     the only option that needs no new sourced data.
   - **Add a sourced `gramsPerPiece` to `CanonicalItem`** through a forward-only
     migration and the catalogue build. FoodData Central publishes portion
     weights, so this can carry a `SourceId` like every other field. It is the
     durable fix and it unblocks the six ingredients that already have nutrition.
   - Do **not** infer a weight per piece from `typicalUseQty`, and do not pick a
     representative gram weight by hand. That is exactly the invented conversion
     the design's decision §3 forbids, and `convert()` returning null today is
     the correct behaviour, not a bug to route around.
4. **Add `densityGPerMl` only where a source has it**, and otherwise restate
   volume amounts in mass when authoring the collection. Thirteen of 116
   ingredients have a density; every volume amount outside those thirteen is an
   unknown, not a rounding problem.
5. **Resolve the raw/cooked basis explicitly.** `jasmine-rice` at 75 g typical
   use is dry; `stovetop-egg-fried-rice` states 300 g and means cooked. Either
   add the cooked form as a distinct canonical identity or record the basis on
   the snapshot ingredient, so grocery demand, portion fitting and nutrition all
   read the same thing. Do not pick a hydration factor — same rule as above.
6. **Fix the recipes before reusing them.** Add stock to the stew's ingredient
   list, add oil and greens to the demo miso bowl or remove them from its
   method, and reconcile every instruction against its ingredient list. This is
   the "audit starter recipes before reuse" line in the design, and it has
   concrete instances now.
7. **Derive dietary eligibility; do not ship the tags.** `dietaryTags` are read
   by nothing and at least one is unverifiable from repository data. Either
   compute eligibility from resolved canonical ids through the existing
   `expandRules` / `applyDietary` path, or show nothing. A recipe with an
   unresolved ingredient stays unverified — per the design, hard exclusions
   apply to resolved ingredients including sauces and optional ingredients.
8. **Keep provider estimates labelled and secondary.** The dinner engine's
   `Estimated` badge is the right pattern. Planner nutrition should prefer the
   catalogue rollup, fall back to a labelled estimate only where one exists, and
   show "Nutrition incomplete" otherwise — never a green fit badge, per the
   brief's state table.

## What this audit did not do

- It did not check nutrition figures against the upstream datasets; it read
  what the repository ships and what provenance it records.
- It did not evaluate the 506 skipped catalogue rows individually.
- It did not verify whether any specific soy sauce product contains gluten. The
  finding is that the repository holds no attribute that could decide it, so the
  tag is a claim without evidence either way.
- It authored no recipe, no yield, no ingredient amount and no nutrient value.
