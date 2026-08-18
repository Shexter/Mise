## 1. Verify FDC nutrient IDs against live data

- [x] 1.1 Fetch real FoodData Central responses for a handful of foods
      spanning categories (produce, protein, dairy, grain) and confirm the
      exact `nutrientId` for fibre (expected ~1079), vitamin C (~1162), iron
      (~1089), vitamin B12 (~1178), calcium (~1087), vitamin A (~1106), and
      potassium (~1092). Confirmed via live Foundation-data responses
      (spinach, beets, salmon, fortified cereal) using the FDC DEMO_KEY: all
      seven IDs match exactly.
- [x] 1.2 Resolve the folate ID specifically. FDC carries multiple related
      entries (total folate, folate DFE, folic acid) — confirm which one
      corresponds to a single "Folate" figure before committing to an ID.
      Record the reasoning as a comment beside the mapping, not just the ID.
      Chose 1177 "Folate, total" — the only folate-related field populated
      on plain Foundation foods (spinach, beets); DFE (1190) and folic acid
      (1186) are fortification-specific breakdowns absent on whole foods.
      Reasoning recorded as a comment in `nutritionFromFdc()`.
- [x] 1.3 Confirm each ID's expected unit (mg vs mcg) matches the field name
      chosen in task 2.1 exactly, the same unit-guard discipline
      `nutrientValue`'s existing kcal check already applies. Confirmed: g
      (fibre), mg (vitamin C, iron, calcium, potassium), µg/mcg (B12,
      folate, vitamin A) all match the chosen field-name suffixes.

## 2. Extend the catalogue types and extraction

- [x] 2.1 Add eight nullable fields to `CatalogueEntry` and `CataloguePatch`
      in `scripts/build-catalogue.ts`: `fibrePer100`, `vitaminCMgPer100`,
      `ironMgPer100`, `vitaminB12McgPer100`, `calciumMgPer100`,
      `folateMcgPer100`, `vitaminAMcgPer100`, `potassiumMgPer100`.
- [x] 2.2 Add the matching eight `CanonicalItem` fields in `src/types.ts`,
      each `number | null`. `fibrePer100` already exists as optional; make
      it consistent with the other seven (present, nullable, not optional).
- [x] 2.3 Extend `nutritionFromFdc()` with eight `nutrientValue()` calls
      using the IDs verified in task 1, following the exact pattern of the
      four existing calls (ID first, name-regex fallback).
- [x] 2.4 Extend the field list in `apply()`/`mergeCataloguePatch()` (or
      wherever the four existing macro fields are enumerated for merge and
      provenance) to include the eight new fields, so refresh semantics
      (fill gaps, keep hand-authored values, report conflicts) apply to them
      identically. Also extended `initialSources()`'s hand-authored default
      list to match.
- [x] 2.5 Test `nutritionFromFdc()` against fixture FDC responses: all eight
      present, a mix of present/absent, and an entry using the fallback
      folate ID vs. the primary one, asserting the correct value is picked.

## 3. Wire fibre into the resolution order

- [x] 3.1 In `src/logic/fibreDerivation.ts`, insert catalogue-sourced
      `fibrePer100` ahead of the text-only fallback, behind product/receipt
      nutrition — matching the position already reserved for it in the
      existing ordering comment/logic. Correction: this logic actually
      lives in `deriveResolvedFibre()` in `src/logic/nutrition.ts` (no
      `fibreDerivation.ts` file exists in this codebase) — already
      implements exactly this order (product → canonical → text fallback →
      unknown), so no code change was needed here.
- [x] 3.2 Test that a meal item resolving to a canonical ingredient with a
      catalogue fibre value receives it without falling through to text.
      This case was untested before this change — added.
- [x] 3.3 Test that a resolved product's own fibre value still outranks the
      canonical catalogue value when both are present. Already covered by
      an existing test.
- [x] 3.4 Test that an ingredient with no catalogue fibre value still falls
      through to the text-only fallback exactly as it does today. Already
      covered by an existing test.

## 4. Provenance and refresh safety

- [x] 4.1 Test that a hand-authored value for one of the eight fields
      survives a catalogue rebuild unchanged, and that a differing dataset
      value is reported rather than applied — the existing conflict-report
      behavior, exercised against the new fields.
- [x] 4.2 Test that a field with no prior value is filled on first build and
      its source recorded as the dataset.
- [x] 4.3 Test that a food entirely missing one of the eight nutrients in
      its FDC response leaves that field `null`, never `0`.

## 5. Rebuild and verify

- [x] 5.1 Run the catalogue build against the full ~4,700-entry set and
      review the diff — expect additions across most entries, no deletions,
      no changes to existing macro/shelf-life fields. Correction: the
      catalogue has 77 entries, not ~4,700 (that figure appears to be a
      stale estimate, possibly of FDC's total food count rather than
      Mise's catalogue size). Ran `npm run catalogue:build` against the
      real 77-entry catalogue with the live `USDA_API_KEY` from `.env`.
      Diff reviewed programmatically: 0 entries added/removed, 0 shelf-life
      changes, 0 macro-field (`kcalPer100`/`proteinPer100`/`carbsPer100`/
      `fatPer100`) changes — only the eight new nutrient fields were
      touched, filled on 30-45 of 77 entries each (46 of 77 matched an FDC
      food this run; the remainder were already unmatched before this
      change and are unaffected by it).
- [x] 5.2 Spot-check a handful of well-known foods (spinach for iron/folate,
      citrus for vitamin C, dairy for calcium, banana for potassium) against
      their known real-world values to catch a systematically wrong ID that
      unit tests alone wouldn't surface. Catalogue has no spinach/kale
      entry, so checked what's available instead: lime → 29.1mg vitamin C
      (real ~29mg), banana → 358mg potassium (real ~358mg), cheddar → 707mg
      calcium/21mcg folate (real ~721mg/21mcg), greek yogurt → 115mg
      calcium (real ~110-120mg). All within expected range.
- [x] 5.3 Run `npm run typecheck` and the full Vitest suite. Both clean:
      typecheck passes with no errors, 740/740 tests pass across 97 files.
- [x] 5.4 Confirm *Delete all data*/`DROP_ALL` behavior is unaffected —
      corrected: catalogue fields ship in both `assets/canonical-items.json`
      *and* `canonical_items` DB columns (added via a new forward-only
      migration, see design correction below) — `DROP_ALL` still drops
      `canonical_items` unconditionally with no new tables, so it remains
      unaffected either way.
