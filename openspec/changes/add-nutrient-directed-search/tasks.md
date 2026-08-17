## 1. Extend the ranking primitive

- [ ] 1.1 Extend `MacroGapTarget` in `src/logic/macroGap.ts` with one entry
      per nutrient field `add-micronutrient-tracking` adds to
      `CanonicalItem` (vitamin C, iron, B12, calcium, folate, vitamin A,
      potassium — fibre already exists in the union).
- [ ] 1.2 Fix `per100()`'s `'fibre'` case to return `canonical.fibrePer100`
      instead of hard-returning `null`; add a case for each new target
      reading its matching field.
- [ ] 1.3 Test `per100()` for every new target against fixture canonicals
      with the field present, absent, and (for fibre specifically) verify
      it's no longer unconditionally `null`.
- [ ] 1.4 Test `assessMacroGap` end-to-end for a new target (e.g. iron)
      with a mixed pantry — some items measurable, some not — asserting
      ranking, tiebreak, and `hasUnmeasuredStock` behave identically to the
      existing macro targets, since `assessMacroGap` itself is unchanged.

## 2. Directed search surface

- [ ] 2.1 Add a nutrient-picker entry point (placement per design.md's open
      question — Foods/pantry surface is the working assumption).
- [ ] 2.2 Call `assessMacroGap` directly with the selected target and
      current pantry/canonical data — no `suggestionService.ts` call, no
      request-mode, no cache entry.
- [ ] 2.3 Render `MacroContributor` rows: item, measured contribution, days
      remaining — no score, no cook-this action.
- [ ] 2.4 Surface `hasMeasuredCoverage`/`hasUnmeasuredStock` plainly when
      coverage is partial or absent, matching the existing macro-gap
      surface's honesty about unmeasurable stock.
- [ ] 2.5 Test the surface offline (no network call attempted) and test
      that no dish/recipe/cook-this affordance appears anywhere in this
      flow.

## 3. Quality gates

- [ ] 3.1 Run `npm run typecheck`, the full Vitest suite, and strict
      OpenSpec validation.
- [ ] 3.2 Confirm this proposal adds no schema, no migration, and no new
      table — `DROP_ALL`/*Delete all data* need no changes.
- [ ] 3.3 Owner device check: search by a macro and by a newly available
      micronutrient, confirm ranking and the unmeasured-stock indicator
      both read correctly, with the app offline for at least one run.
