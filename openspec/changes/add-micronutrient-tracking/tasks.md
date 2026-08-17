## 1. Verify FDC nutrient IDs against live data

- [ ] 1.1 Fetch real FoodData Central responses for a handful of foods
      spanning categories (produce, protein, dairy, grain) and confirm the
      exact `nutrientId` for fibre (expected ~1079), vitamin C (~1162), iron
      (~1089), vitamin B12 (~1178), calcium (~1087), vitamin A (~1106), and
      potassium (~1092).
- [ ] 1.2 Resolve the folate ID specifically. FDC carries multiple related
      entries (total folate, folate DFE, folic acid) — confirm which one
      corresponds to a single "Folate" figure before committing to an ID.
      Record the reasoning as a comment beside the mapping, not just the ID.
- [ ] 1.3 Confirm each ID's expected unit (mg vs mcg) matches the field name
      chosen in task 2.1 exactly, the same unit-guard discipline
      `nutrientValue`'s existing kcal check already applies.

## 2. Extend the catalogue types and extraction

- [ ] 2.1 Add eight nullable fields to `CatalogueEntry` and `CataloguePatch`
      in `scripts/build-catalogue.ts`: `fibrePer100`, `vitaminCMgPer100`,
      `ironMgPer100`, `vitaminB12McgPer100`, `calciumMgPer100`,
      `folateMcgPer100`, `vitaminAMcgPer100`, `potassiumMgPer100`.
- [ ] 2.2 Add the matching eight `CanonicalItem` fields in `src/types.ts`,
      each `number | null`. `fibrePer100` already exists as optional; make
      it consistent with the other seven (present, nullable, not optional).
- [ ] 2.3 Extend `nutritionFromFdc()` with eight `nutrientValue()` calls
      using the IDs verified in task 1, following the exact pattern of the
      four existing calls (ID first, name-regex fallback).
- [ ] 2.4 Extend the field list in `apply()`/`mergeCataloguePatch()` (or
      wherever the four existing macro fields are enumerated for merge and
      provenance) to include the eight new fields, so refresh semantics
      (fill gaps, keep hand-authored values, report conflicts) apply to them
      identically.
- [ ] 2.5 Test `nutritionFromFdc()` against fixture FDC responses: all eight
      present, a mix of present/absent, and an entry using the fallback
      folate ID vs. the primary one, asserting the correct value is picked.

## 3. Wire fibre into the resolution order

- [ ] 3.1 In `src/logic/fibreDerivation.ts`, insert catalogue-sourced
      `fibrePer100` ahead of the text-only fallback, behind product/receipt
      nutrition — matching the position already reserved for it in the
      existing ordering comment/logic.
- [ ] 3.2 Test that a meal item resolving to a canonical ingredient with a
      catalogue fibre value receives it without falling through to text.
- [ ] 3.3 Test that a resolved product's own fibre value still outranks the
      canonical catalogue value when both are present.
- [ ] 3.4 Test that an ingredient with no catalogue fibre value still falls
      through to the text-only fallback exactly as it does today.

## 4. Provenance and refresh safety

- [ ] 4.1 Test that a hand-authored value for one of the eight fields
      survives a catalogue rebuild unchanged, and that a differing dataset
      value is reported rather than applied — the existing conflict-report
      behavior, exercised against the new fields.
- [ ] 4.2 Test that a field with no prior value is filled on first build and
      its source recorded as the dataset.
- [ ] 4.3 Test that a food entirely missing one of the eight nutrients in
      its FDC response leaves that field `null`, never `0`.

## 5. Rebuild and verify

- [ ] 5.1 Run the catalogue build against the full ~4,700-entry set and
      review the diff — expect additions across most entries, no deletions,
      no changes to existing macro/shelf-life fields.
- [ ] 5.2 Spot-check a handful of well-known foods (spinach for iron/folate,
      citrus for vitamin C, dairy for calcium, banana for potassium) against
      their known real-world values to catch a systematically wrong ID that
      unit tests alone wouldn't surface.
- [ ] 5.3 Run `npm run typecheck` and the full Vitest suite.
- [ ] 5.4 Confirm *Delete all data*/`DROP_ALL` behavior is unaffected — no
      new tables, catalogue fields ship in `assets/canonical-items.json`,
      not the database.
