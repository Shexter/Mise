## 1. Schema and types

- [x] 1.1 Append a migration adding nullable `profile.target_weight_kg` and
      `profile.weight_goal_rate_kg_per_week`. Existing rows keep both null.
- [x] 1.2 Add `targetWeightKg: number | null` and
      `weightGoalRateKgPerWeek: number | null` to `Profile` in
      `src/types.ts`.
- [x] 1.3 Verify the migration runs from the current head and
      `npm run typecheck` passes with the widened `Profile`.

## 2. Rate-derived calorie adjustment

- [x] 2.1 Add a named, commented kcal-per-kilogram approximation constant to
      `src/constants/activityLevels.ts`, alongside the existing `GOALS`
      table (not replacing it). Also added `WEIGHT_GOAL_RATE_RANGE` and
      `rateGoalAdjustment()` there per the design's sign-convention
      correction (magnitude + direction-from-target, not a signed rate).
- [x] 2.2 Extend `energyTargets()` in `src/logic/bmr.ts` with a branch: when
      both `targetWeightKg` and `weightGoalRateKgPerWeek` are set, derive
      the adjustment from the rate; otherwise call `goalAdjustment(goal)`
      exactly as today. Both branches feed the same
      `Math.max(MIN_TARGET_CALORIES, ...)` clamp. Scope correction (user
      approved): extracted the branch into a shared `goalCalorieAdjustment()`
      dispatcher in `bmr.ts`, and routed `bodyComposition.ts`'s
      `measuredTarget()` (dexa/inbody) and the `stated` resolver's
      resting/total branch through it too — `add-energy-sources` already
      split `goalAdjustment(profile.goal)` across 3 call sites beyond
      `energyTargets()`, and this proposal's "whenever both are set" applies
      regardless of calorie source.
- [x] 2.3 Test: neither set → existing fixed-adjustment behavior, byte-for-
      byte unchanged. Only one set → same. Both set → rate-derived
      adjustment. An extreme rate → floored at `MIN_TARGET_CALORIES`,
      matching the fixed-adjustment path's existing floor behavior. Extended
      to also cover the dexa and stated resolvers (see 2.2's scope note).

## 3. Forecast computation

- [x] 3.1 Add a pure function computing weeks-to-goal and a forecast date
      from current weight, target weight, and rate — no persistence, called
      at display time. `weightGoalForecast()` in new file
      `src/logic/weightGoalPacing.ts`.
- [x] 3.2 Test the direction-agnostic case: a target above current weight
      with a positive (gain) rate, and a target below current weight with a
      positive (loss) rate, both resolve to a positive week count and a
      future date.
- [x] 3.3 Test that a changed `profile.weightKg` changes the next-computed
      forecast without any stored date needing an update.
- [x] 3.4 Test the zero-rate and already-at-target edge cases don't divide
      by zero or produce a nonsensical date.

## 4. UI — settings and onboarding entrance

- [x] 4.1 Add an optional "set a target and pace" affordance from
      `src/components/settings/ProfileSheet.tsx`, reachable without
      changing the existing lose/maintain/gain control's default behavior.
      A ghost-button toggle in `GoalEditor` reveals target-weight + pace
      fields; saving with it collapsed keeps `goal` only, unchanged.
- [x] 4.2 Mirror the same optional affordance from `app/onboarding/goal.tsx`
      without adding a new required step — the existing three-way choice
      stays the default path exactly as `add-energy-sources` kept its own
      onboarding untouched. Scoped to this file specifically, matching the
      proposal's Impact section — the separate DEXA/InBody/stated onboarding
      screen (`app/onboarding/energy.tsx`) has its own inline goal selector
      and was not touched; those users can still set a target+pace
      afterward from Settings, where the backend change (2.2) already
      applies to their calorie source.
- [x] 4.3 Bound the rate input control to a sane min/max (see design.md's
      Open Question) rather than accepting free text. `WEIGHT_GOAL_RATE_RANGE`
      (0.1-1 kg/week) via the existing `Stepper` component.
- [x] 4.4 Display the forecast date with copy that reads as an estimate,
      wherever the goal/target is shown: the ProfileSheet and onboarding
      goal-step captions, and a compact estimate appended to the Settings
      goal row summary (`goalSummaryLabel`).
- [x] 4.5 Add UI tests: setting a target+rate updates the shown calorie
      target and forecast; clearing either reverts to the fixed-adjustment
      display with no forecast shown. Scope note: this codebase has no
      component-render test infrastructure anywhere (checked — zero
      `@testing-library/react-native` or `render()` usage in the whole
      repo), so `goalRowValue`'s logic was extracted to a pure, exported
      `goalSummaryLabel()` in `src/logic/weightGoalPacing.ts` and tested
      directly — the same layer every other UI-adjacent function in this
      repo is tested at — rather than introducing a new test-rendering
      dependency for one task.

## 5. Quality gates

- [x] 5.1 Run `npm run typecheck`, the full Vitest suite, and strict
      OpenSpec validation. All clean: typecheck passes, 785/785 tests pass
      across 101 files, `openspec validate --changes --strict` passes
      (28/28, including this change).
- [x] 5.2 Confirm *Delete all data* clears the two new profile columns along
      with the rest of the profile row — no separate handling needed since
      they live on the existing `profile` table. Confirmed: `DROP_ALL`
      unconditionally drops `profile`; no new table was added.
- [ ] 5.3 Owner device check: set a target and rate, confirm the calorie
      target and forecast date match hand-calculated expectations, then
      clear both and confirm the app returns to today's exact behavior.
      **Not completed by me** — this is explicitly an owner/device
      verification step, and self-verification via the Expo web preview
      (`.claude/launch.json`'s `web` config) is blocked by a pre-existing
      environment limitation unrelated to this change: `expo-sqlite`'s web
      worker fails to bundle (`Unable to resolve "./wa-sqlite/wa-sqlite.wasm"`
      from `node_modules/expo-sqlite/web/worker.ts`), so the app cannot run
      in a browser at all in this environment, on any branch. Hand-checked
      the math instead: a 70kg profile targeting 65kg at 0.5kg/week gives a
      550kcal/day deficit (0.5 × 7700 ÷ 7) and a 10-week forecast — matches
      the test suite's assertions in `test/weight-goal-pacing.test.ts`.
