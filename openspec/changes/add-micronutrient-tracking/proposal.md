## Why

`CanonicalItem` has `kcalPer100`, `proteinPer100`, `carbsPer100`, `fatPer100`,
and `fibrePer100`. Nothing else. A user cannot ask Mise whether they got
enough vitamin C, iron, or B12 this week, because the app has never recorded
a single one of those figures against a single ingredient.

`scripts/build-catalogue.ts` already calls FoodData Central per ingredient
and receives back its full `foodNutrients` array — dozens of nutrients per
food, lab-measured, CC0 public domain. `nutritionFromFdc()` reads four of
them through a generic `nutrientValue(food, nutrientId, nameRegex)` helper
and discards the rest on every single food it has ever processed. The gap
is not a missing data source; it is four lines of extraction code standing
between the app and data it already has.

`fibrePer100` is a second, sharper version of the same problem. The field
exists on `CanonicalItem`, but nothing populates it from the catalogue —
`add-fibre-tracking` derives fibre per meal from a vision estimate
(`src/logic/fibreDerivation.ts`), and the catalogue script has never
touched it. So the one micronutrient Mise already tracks is running on the
noisier of its two available sources by omission, not by design.

Competitor teardown: `competitor-analysis/cronometer/nutrient-report/
full-micronutrient-report.md` and `CRONO-ADAPTATION-PLAN.md` item 1.
Cronometer's ~80-nutrient report is the single largest gap found in that
analysis, and Cronometer's own database is anchored to the same public
FoodData Central source this app already ingests — the breadth is theirs to
have curated well, not theirs to have licensed exclusively.

## What Changes

- **`nutritionFromFdc()` gains eight fields.** Fibre, vitamin C, iron,
  vitamin B12, calcium, folate, vitamin A, and potassium — Cronometer's own
  "highlighted targets" set, chosen as the first slice of the remaining ~75
  FDC nutrients rather than importing all of them at once.
- **Fibre moves onto the catalogue.** Once `fibrePer100` is populated from
  FDC for a resolved ingredient, it takes precedence the same way product
  and canonical nutrition already outrank the vision estimate for calories
  and macros — `fibreDerivation.ts`'s post-resolution ordering
  (product → canonical → text fallback → unknown) gains catalogue nutrition
  ahead of the text fallback, unchanged everywhere else.
- **`CanonicalItem` gains eight nullable fields**, one per nutrient, each
  with its own entry in `sources: Partial<Record<field, SourceId>>` — the
  provenance mechanism `add-open-data-catalogue` already built and this
  change reuses without modification.
- **`Macros` and `meal_items` are untouched.** These are catalogue-level
  ingredient facts, the same layer calories and macros already live at —
  not new per-meal columns, not a new estimation prompt field.
- **Missing stays missing.** A food FDC has no value for keeps that field
  `null`, exactly as `kcalPer100` and friends already do when FDC has
  nothing to say. No zero, ever, for a nutrient nobody measured.
- **The remaining ~70 FDC nutrients are out of scope here.** This is a
  vertical slice through the existing pipeline, not the whole report.

## Capabilities

### New Capabilities

- `micronutrient-tracking`: Recording fibre, vitamin C, iron, B12, calcium,
  folate, vitamin A, and potassium per canonical ingredient from FoodData
  Central, with the same per-field provenance and nullable-not-zero
  discipline the catalogue's existing macro fields already follow, and
  fibre's catalogue value taking precedence over its existing vision
  estimate.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.
`open-data-catalogue` remains unarchived as a change, not a spec; this
proposal extends its build script directly rather than through a spec
delta.

## Non-goals

- **The remaining ~70 FDC nutrients.** Amino acids, omega subtypes, the
  rest of the B vitamins, trace minerals. Same shape of work, later slice,
  once this one is measured and the pattern holds.
- **A UI for displaying these nutrients.** This proposal gets the numbers
  into `CanonicalItem`. Showing them — bars, a report screen, a Today-screen
  entry point — is downstream work this change does not attempt.
- **Per-meal micronutrient estimation from a photograph.** FDC and Open
  Food Facts data resolve onto identified *ingredients*; a photographed
  composite dish's micronutrient content remains whatever
  `fibreDerivation.ts`'s existing text-only fallback (or, after this
  change, silence) already produces. No new vision-estimation path.
- **Branded/packaged-good micronutrients from Open Food Facts.** OFF often
  carries extended nutrient fields for products; wiring those in is the
  same shape of change against a different script (`barcode` resolution,
  not the catalogue build) and is left for its own proposal.
- **Re-running the catalogue build for existing entries automatically.**
  A refresh is a developer action with a reviewed diff, same as every
  other catalogue change — this proposal does not add automation around
  that.

## Impact

**Schema.** `CanonicalItem` gains eight nullable numeric fields:
`fibrePer100`, `vitaminCMgPer100`, `ironMgPer100`, `vitaminB12McgPer100`,
`calciumMgPer100`, `folateMcgPer100`, `vitaminAMcgPer100`,
`potassiumMgPer100`. `fibrePer100` already exists on the type as optional;
this change makes it a first-class catalogue-sourced field like the
existing macros rather than leaving it fibre-derivation-only.

**Code.**
- `scripts/build-catalogue.ts` — `nutritionFromFdc()` gains eight
  `nutrientValue()` calls; `CataloguePatch`/`CatalogueEntry` gain the
  matching fields; `apply()`'s field list gains them for merge/provenance.
- `src/types.ts` — `CanonicalItem` gains the eight fields.
- `src/logic/fibreDerivation.ts` — catalogue nutrition is inserted ahead of
  the text-only fallback in the resolution order, behind product/receipt
  nutrition which already outranks everything.
- `assets/canonical-items.json` — regenerated by the build script; the diff
  is the review, per the catalogue's existing convention.

**Dependencies.** None added — same FoodData Central API the catalogue
already calls at build time, no new key, no runtime call.

**Risk.** FDC's nutrient IDs and names are not perfectly standardized
across food types — `nutrientValue()` already falls back from ID match to
a name-regex match for exactly this reason, and the same fallback covers
the eight new nutrients. Folate specifically has multiple FDC entries
(total folate vs. folate DFE); picking the wrong one silently reports a
plausible-looking wrong number, so task 1 verifies the exact ID against a
handful of real FDC responses before the mapping ships, rather than
trusting a remembered ID.
