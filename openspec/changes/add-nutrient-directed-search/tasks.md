## 1. Extend the ranking primitive

- [x] 1.1 Extend `MacroGapTarget` in `src/logic/macroGap.ts` with one entry
      per nutrient field `add-micronutrient-tracking` adds to
      `CanonicalItem` (vitamin C, iron, B12, calcium, folate, vitamin A,
      potassium — fibre already exists in the union).
- [x] 1.2 Fix `per100()`'s `'fibre'` case to return `canonical.fibrePer100`
      instead of hard-returning `null`; add a case for each new target
      reading its matching field. Implementation-reveals correction (not in
      the task list): `macroShortfall()` also switches exhaustively over
      `MacroGapTarget`, so widening the union required extending its switch
      too — the 7 new targets return `null` there (no daily target/consumed
      data exists for micronutrients; explicit non-goal), documented in a
      comment. `macroShortfall`'s only callers pass the narrower
      `SuggestionTargetMacro` (`'protein'|'carbs'|'fat'`, no micronutrients,
      no fibre), so this is required for the type to compile, not a new
      capability.
- [x] 1.3 Test `per100()` for every new target against fixture canonicals
      with the field present, absent, and (for fibre specifically) verify
      it's no longer unconditionally `null`.
- [x] 1.4 Test `assessMacroGap` end-to-end for a new target (e.g. iron)
      with a mixed pantry — some items measurable, some not — asserting
      ranking, tiebreak, and `hasUnmeasuredStock` behave identically to the
      existing macro targets, since `assessMacroGap` itself is unchanged.

## 2. Directed search surface

- [x] 2.1 Add a nutrient-picker entry point (placement per design.md's open
      question — Foods/pantry surface is the working assumption). Resolved
      the open question: a search-icon button in the Pantry tab's "Stock"
      header (`app/(tabs)/pantry.tsx`), opening a new modal screen
      `app/nutrient-search.tsx` — matching the existing precedent of
      `locations`/`match-queue`/`merge-canonicals` as header-icon-triggered
      modal screens.
- [x] 2.2 Call `assessMacroGap` directly with the selected target and
      current pantry/canonical data — no `suggestionService.ts` call, no
      request-mode, no cache entry. Reads `listPantryItems()` and
      `getAllCanonicals()` directly, same pattern `suggestionService.ts`
      itself uses internally, without going through it.
- [x] 2.3 Render `MacroContributor` rows: item, measured contribution, days
      remaining — no score, no cook-this action.
- [x] 2.4 Surface `hasMeasuredCoverage`/`hasUnmeasuredStock` plainly when
      coverage is partial or absent, matching the existing macro-gap
      surface's honesty about unmeasurable stock.
- [x] 2.5 Test the surface offline (no network call attempted) and test
      that no dish/recipe/cook-this affordance appears anywhere in this
      flow. Same scope note as `add-weight-goal-pacing`'s task 4.5 — no
      component-render test infrastructure exists in this repo. Followed
      this repo's existing structural-boundary precedent instead
      (`test/catalogue-runtime.test.ts`, which already verifies
      `manual.tsx`'s behavior by scanning its source): added
      `test/nutrient-search-runtime.test.ts`, scanning
      `app/nutrient-search.tsx`'s source for the absence of any
      provider/suggestion-engine/fetch import and any dish/recipe/cook-this
      construct, and the presence of the direct `assessMacroGap` call and
      both coverage fields.

      **Bug found and fixed in a follow-up UI review:** the initial
      pantry/catalogue load had no `.catch()` — a rejected
      `listPantryItems()`/`getAllCanonicals()` left the screen stuck on
      "Loading your pantry…" indefinitely, with no error state and no way
      to recover short of closing the screen. Added error handling (a
      toast plus an `EmptyState` escape hatch) and a regression test.

## 3. Quality gates

- [x] 3.1 Run `npm run typecheck`, the full Vitest suite, and strict
      OpenSpec validation. All clean: typecheck passes, 793/793 tests pass
      across 102 files, `openspec validate --changes --strict` passes
      (28/28, including this change).
- [x] 3.2 Confirm this proposal adds no schema, no migration, and no new
      table — `DROP_ALL`/*Delete all data* need no changes. Confirmed:
      `src/db/schema.ts` is untouched by this change (its only diff is
      item 1's already-archived migration 26, from before this session).
- [ ] 3.3 Owner device check: search by a macro and by a newly available
      micronutrient, confirm ranking and the unmeasured-stock indicator
      both read correctly, with the app offline for at least one run.
      **Not completed by me** — same reason as `add-weight-goal-pacing`'s
      task 5.3: this is explicitly an owner/device step, and the Expo web
      preview cannot run at all in this environment
      (`expo-sqlite`'s web worker fails to bundle — pre-existing, unrelated
      to this change). Verified the logic directly instead: 9 tests in
      `test/macro-gap.test.ts` cover ranking/tiebreak/unmeasured-stock for
      a micronutrient target (iron) identically to the macro path, plus the
      fibre fix; `test/nutrient-search-runtime.test.ts` confirms the
      surface's structural offline/no-suggestion-engine properties.
