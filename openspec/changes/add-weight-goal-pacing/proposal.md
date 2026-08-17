## Why

`goalAdjustment(goal)` in `src/constants/activityLevels.ts` is three fixed
numbers: -500 for lose, 0 for maintain, +300 for gain. A user aiming to lose
weight gets the same 500-calorie deficit whether they want to lose 2 kg or
20, and whether they want it gone in a month or a year. The app has no idea
which, because it never asks — `goal` is a direction, not a target.

That means Mise can say "you're in a deficit" but never "at this rate,
you'll get there around such-and-such a date," which is the difference
between a rule and a plan. `app/onboarding/goal.tsx` and
`src/components/settings/ProfileSheet.tsx` both offer the three-way choice
today; neither asks for a number.

Competitor teardown: `competitor-analysis/cronometer/goals-targets/
weight-goal-and-rate-onboarding.md` and `CRONO-ADAPTATION-PLAN.md` item 2.
Flagged as a real, missing feature — not present anywhere in
`docs/product-decisions.md` or the existing onboarding/settings flow — that
composes on top of `add-energy-sources`'s expenditure work rather than
replacing it.

## What Changes

- **An optional target weight and a rate.** `targetWeightKg` and
  `weightGoalRateKgPerWeek`, both nullable on `Profile`. Unset by default —
  a user who never touches this keeps today's exact behavior.
- **When both are set, they replace the fixed goal adjustment.** The daily
  calorie adjustment derives from the chosen rate (a standard
  kcal-per-kilogram conversion) instead of the -500/0/+300 constant. When
  either is unset, `goalAdjustment(goal)` runs exactly as it does today —
  this is an additive path, not a replacement of the existing one.
- **A forecast date, computed forward, never stored.** `(targetWeightKg -
  currentWeightKg) / rate` gives weeks to goal; the app shows the resulting
  date as a live estimate that moves as `profile.weightKg` and the rate
  change, not a value written once and left stale.
- **The regular onboarding is untouched.** Same principle
  `add-energy-sources` already established: the existing lose/maintain/gain
  choice stays exactly as it is, with this reachable as an optional
  refinement from the goal step and from Settings — not an extra
  mandatory screen.
- **The forecast is worded as a moving estimate, not a promise.** A specific
  dated claim sits close to the spirit of decision 15 — never state more
  certainty than the app can defend. The copy makes clear the date recomputes
  as logging continues rather than reading as a guarantee.
- **A sane rate range**, not an open text field. Extreme values (a rate that
  implies losing a kilogram a day) already collide with
  `MIN_TARGET_CALORIES`'s existing 1200-calorie floor; the input itself
  should not let someone dial in a number the target calculation would
  immediately have to override without explanation.

## Capabilities

### New Capabilities

- `weight-goal-pacing`: An optional target weight and desired rate of
  change that, when set, derive the daily calorie adjustment and a forecast
  completion date — additive to the existing lose/maintain/gain choice,
  never required, and worded as an estimate that moves rather than a fixed
  promise.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Changing the regular onboarding.** Same hard constraint
  `add-energy-sources` already set for itself: no new required screen, no
  new required question.
- **A weight history or trend chart.** `profile.weight_kg` is a single
  current value, not a time series — there is no `weight_log` table. The
  forecast is pure forward arithmetic from the current figure; it does not
  need or create a history. See `add-trend-charts`'s non-goals for the
  related reasoning on why weight charting is out of scope there too.
- **Recommending a rate.** The app shows what a chosen rate implies. It
  does not suggest what rate someone should choose — that is exactly the
  "diagnosis, assessment, or advice" boundary `add-energy-sources` already
  drew for itself.
- **Changing what `goalAdjustment` returns for maintain or gain.** This
  proposal's rate-driven path applies to any goal direction the rate
  implies (a negative rate is a deficit, a positive rate is a surplus,
  zero is maintenance) — it does not touch the existing fixed constants,
  which remain the default for anyone who doesn't set a target weight.
- **Body-composition or measurement integration.** `add-energy-sources`'s
  DEXA/InBody/stated sources feed `totalDailyEnergyExpenditure`; this
  proposal sits downstream of whatever that produces and does not change
  how it's computed.

## Impact

**Schema.** `profile` gains two nullable columns: `target_weight_kg REAL`
and `weight_goal_rate_kg_per_week REAL`. Both null by default; existing
rows are unaffected. Appended as one forward-only migration after the
live schema ledger is checked, per the project's non-negotiable convention.

**Code.**
- `src/types.ts` — `Profile` gains `targetWeightKg: number | null` and
  `weightGoalRateKgPerWeek: number | null`.
- `src/logic/bmr.ts` — `energyTargets()` gains a rate-derived adjustment
  path alongside the existing `goalAdjustment(goal)` call, selected only
  when both new fields are set.
- `src/constants/activityLevels.ts` — a kcal-per-kilogram constant and the
  rate-to-calories conversion function, alongside the existing `GOALS`
  table it does not replace.
- `app/onboarding/goal.tsx`, `src/components/settings/ProfileSheet.tsx` —
  an optional "set a target and pace" affordance from the existing
  goal-direction step, not a new mandatory step.
- A new forecast display: a computed date shown wherever the goal is
  shown, recomputed from current values rather than persisted.

**Dependencies.** None added.

**Risk.** Two calorie-adjustment paths (fixed constant, rate-derived) means
two things to keep in sync with `MIN_TARGET_CALORIES`'s floor and with any
future change to how `energyTargets` combines expenditure and adjustment.
Mitigated by keeping the rate-derived path a pure alternative *input* to
the same final `Math.max(MIN_TARGET_CALORIES, ...)` clamp `energyTargets`
already applies, rather than a parallel calculation that could drift from
it.
