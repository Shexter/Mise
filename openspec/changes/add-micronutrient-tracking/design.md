## Context

See `proposal.md` — Why. `scripts/build-catalogue.ts`'s `nutritionFromFdc()`
extracts four fields from an `FdcFood`'s `foodNutrients` array via a shared
`nutrientValue(food, nutrientId, nameRegex)` helper:

```ts
export function nutritionFromFdc(food: FdcFood): CataloguePatch {
  return {
    kcalPer100: nutrientValue(food, 1008, /^energy(?:\s*\(|$)/i),
    proteinPer100: nutrientValue(food, 1003, /^protein$/i),
    carbsPer100: nutrientValue(food, 1005, /carbohydrate, by difference/i),
    fatPer100: nutrientValue(food, 1004, /total lipid \(fat\)/i),
  };
}
```

`nutrientValue` matches by FDC's numeric `nutrientId` first, falling back to
a name regex (with a unit guard for kcal specifically, since the raw name
match for "Energy" could otherwise hit a kJ entry). The same `FdcFood`
response already carries every other nutrient FDC tracks for that food —
this proposal reads more of a response the pipeline already has, rather
than requesting anything new.

`fibrePer100` exists on `CanonicalItem` today but is populated only by
`src/logic/fibreDerivation.ts`'s post-resolution ordering: product
nutrition, canonical catalogue nutrition, a text-only fallback, then
`null`. "Canonical catalogue nutrition" already means "whatever's in
`CanonicalItem.fibrePer100`" — the ordering is correct, the catalogue side
of it has simply never been filled in.

## Goals / Non-Goals

**Goals:**

- Eight more nutrients recorded per canonical ingredient, sourced the same
  way calories and macros already are.
- Fibre upgraded from vision-estimate-only to catalogue-backed, without
  changing its resolution order relative to product nutrition.
- Missing data stays missing — no nutrient defaults to zero because FDC had
  nothing to say.

**Non-Goals:**

- The remaining ~70 FDC nutrients, a display surface, per-meal vision
  estimation of micronutrients, Open Food Facts branded-good nutrients. See
  the proposal.

## Decisions

### Extend `nutritionFromFdc()`, don't build a second extraction path

Eight more `nutrientValue()` calls in the same function, same pattern as
the existing four.

*Why:* the four existing calls already prove the pattern works — ID match,
name-regex fallback, unit guard where needed. A parallel function for
"the new nutrients" would fork behavior that should stay identical, and
would double the surface a future contributor has to understand to add a
ninth.

### One nullable field per nutrient, not a generic nutrient map

`fibrePer100`, `vitaminCMgPer100`, `ironMgPer100`, `vitaminB12McgPer100`,
`calciumMgPer100`, `folateMcgPer100`, `vitaminAMcgPer100`,
`potassiumMgPer100` — each its own typed field on `CanonicalItem`, each
`number | null`.

*Why not a `nutrients: Record<string, number | null>` bag:* a bag makes
every read a string-keyed lookup with no compiler help, and makes it
possible to write a nutrient key that doesn't exist anywhere or misspell
one that does. Named fields mean `CanonicalItem`'s shape enumerates exactly
what Mise tracks, which is also self-documenting for the next nutrient
added.

*Why the unit in the field name:* Cronometer's own report mixes units
across nutrients (mg for most minerals, mcg for B12/folate/vitamin A, g for
fibre) — encoding the unit in the field name means a value can never be
silently read in the wrong unit at a call site, the same reasoning that
already produced `kcalPer100` rather than a bare `caloriesPer100`.

### Fibre's catalogue value slots in ahead of the text fallback, not ahead of product nutrition

`fibreDerivation.ts`'s order becomes: product/receipt nutrition → canonical
catalogue nutrition (now actually populated) → text-only fallback → `null`.

*Why this position specifically:* a barcode-scanned product's own label is
still more specific than a generic ingredient average — chicken breast's
FDC entry is for chicken breast in general, a particular product's label is
for that product. The catalogue slot was already reserved at this position
in the existing order; this change fills it rather than reordering
anything.

### Folate's nutrient ID gets verified against a live response, not assumed

FDC carries multiple folate-related entries (total folate, folate DFE,
folic acid) under different IDs. Task 1 fetches a handful of real FDC
responses and confirms which ID matches Cronometer's single "Folate" row
before the mapping ships, rather than shipping a remembered ID that turns
out to be folic acid alone.

*Why this matters more here than for the other seven:* the other seven
have one obvious FDC entry each. A wrong folate ID doesn't fail loudly —
it produces a plausible, wrong number that looks exactly like a right one,
which is precisely the failure mode `add-open-data-catalogue`'s
category-guard and uncertain-match reporting already exist to prevent
elsewhere in this same script.

## Risks / Trade-offs

**A wrong nutrient ID produces a confident wrong number** → mitigated by
verifying each ID against live FDC data during task 1, before the mapping
is trusted for all ~4,700 catalogue entries at once.

**Eight new fields widen `CanonicalItem` again** → the same widening
`add-open-data-catalogue` already did for the first four macros and
`add-fibre-tracking` already did for one more. Each field is nullable, so
no existing row needs backfilling and no existing reader needs to change
unless it opts into reading a new field.

**Regenerating the catalogue touches ~4,700 rows in one diff** → the
existing build script already commits its output for review rather than
generating at packaging time specifically so a large diff gets looked at.
This change doesn't need a new mechanism, just to run the existing one.

## Migration Plan

No database migration — these are build-time catalogue fields shipped in
`assets/canonical-items.json`, not `meal_items` or `profile` columns. The
schema-level precedent (`RESOLVED_FIBRE_NUTRITION`) already covers where a
resolved item's nutrition is persisted at read time; this change only
widens what the catalogue can supply into that existing path.

Rollback is additive: an older build simply doesn't read the eight new
fields, exactly as it already ignores `fibrePer100` today.

## Open Questions

- **Whether to seed the display surface in the same change.** Deliberately
  left out — see Non-Goals. Shipping the data first, separately from any
  UI, means the display proposal can be scoped against real, already-
  populated catalogue values instead of guessing at coverage.
