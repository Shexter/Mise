## 1. Schema and types

- [ ] 1.1 Append a migration adding nullable `profile.target_weight_kg` and
      `profile.weight_goal_rate_kg_per_week`. Existing rows keep both null.
- [ ] 1.2 Add `targetWeightKg: number | null` and
      `weightGoalRateKgPerWeek: number | null` to `Profile` in
      `src/types.ts`.
- [ ] 1.3 Verify the migration runs from the current head and
      `npm run typecheck` passes with the widened `Profile`.

## 2. Rate-derived calorie adjustment

- [ ] 2.1 Add a named, commented kcal-per-kilogram approximation constant to
      `src/constants/activityLevels.ts`, alongside the existing `GOALS`
      table (not replacing it).
- [ ] 2.2 Extend `energyTargets()` in `src/logic/bmr.ts` with a branch: when
      both `targetWeightKg` and `weightGoalRateKgPerWeek` are set, derive
      the adjustment from the rate; otherwise call `goalAdjustment(goal)`
      exactly as today. Both branches feed the same
      `Math.max(MIN_TARGET_CALORIES, ...)` clamp.
- [ ] 2.3 Test: neither set → existing fixed-adjustment behavior, byte-for-
      byte unchanged. Only one set → same. Both set → rate-derived
      adjustment. An extreme rate → floored at `MIN_TARGET_CALORIES`,
      matching the fixed-adjustment path's existing floor behavior.

## 3. Forecast computation

- [ ] 3.1 Add a pure function computing weeks-to-goal and a forecast date
      from current weight, target weight, and rate — no persistence, called
      at display time.
- [ ] 3.2 Test the direction-agnostic case: a target above current weight
      with a positive (gain) rate, and a target below current weight with a
      positive (loss) rate, both resolve to a positive week count and a
      future date.
- [ ] 3.3 Test that a changed `profile.weightKg` changes the next-computed
      forecast without any stored date needing an update.
- [ ] 3.4 Test the zero-rate and already-at-target edge cases don't divide
      by zero or produce a nonsensical date.

## 4. UI — settings and onboarding entrance

- [ ] 4.1 Add an optional "set a target and pace" affordance from
      `src/components/settings/ProfileSheet.tsx`, reachable without
      changing the existing lose/maintain/gain control's default behavior.
- [ ] 4.2 Mirror the same optional affordance from `app/onboarding/goal.tsx`
      without adding a new required step — the existing three-way choice
      stays the default path exactly as `add-energy-sources` kept its own
      onboarding untouched.
- [ ] 4.3 Bound the rate input control to a sane min/max (see design.md's
      Open Question) rather than accepting free text.
- [ ] 4.4 Display the forecast date with copy that reads as an estimate,
      wherever the goal/target is shown.
- [ ] 4.5 Add UI tests: setting a target+rate updates the shown calorie
      target and forecast; clearing either reverts to the fixed-adjustment
      display with no forecast shown.

## 5. Quality gates

- [ ] 5.1 Run `npm run typecheck`, the full Vitest suite, and strict
      OpenSpec validation.
- [ ] 5.2 Confirm *Delete all data* clears the two new profile columns along
      with the rest of the profile row — no separate handling needed since
      they live on the existing `profile` table.
- [ ] 5.3 Owner device check: set a target and rate, confirm the calorie
      target and forecast date match hand-calculated expectations, then
      clear both and confirm the app returns to today's exact behavior.
