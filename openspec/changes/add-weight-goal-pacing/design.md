## Context

See `proposal.md` — Why. `energyTargets()` in `src/logic/bmr.ts`:

```ts
export function energyTargets(
  input: BmrInput,
  activityLevel: ActivityLevel,
  goal: Goal,
): EnergyTargets {
  const maintenance = Math.round(totalDailyEnergyExpenditure(input, activityLevel));
  const target = Math.max(
    MIN_TARGET_CALORIES,
    Math.round(maintenance + goalAdjustment(goal)),
  );
  return { maintenance, target };
}
```

`goalAdjustment(goal)` returns one of three fixed constants. This proposal
adds a second way to arrive at the number that gets added to `maintenance`
— derived from a rate rather than read from a table — without touching how
`maintenance` itself is computed (that's `add-energy-sources`'s territory,
untouched here).

## Goals / Non-Goals

**Goals:**

- A target weight and rate, when set, produce a calorie adjustment and a
  forecast date.
- Unset, by default, with zero behavior change from today.
- The forecast is honest about being an estimate that moves.

**Non-Goals:**

- Weight history, rate recommendations, changing the fixed-goal default,
  body-composition integration. See the proposal.

## Decisions

### The rate-derived adjustment is a second input to the same clamp, not a second function

`energyTargets()` gains a branch: if `targetWeightKg` and
`weightGoalRateKgPerWeek` are both set, compute the adjustment from the
rate; otherwise call `goalAdjustment(goal)` exactly as today. Both paths
feed the same `Math.max(MIN_TARGET_CALORIES, ...)` line.

*Why not a separate `energyTargetsFromRate()` function:* two entry points
computing "the target" independently is exactly the drift risk called out
in the proposal's Risk section — a future change to the floor, or to how
`maintenance` combines with an adjustment, would need to be applied twice
and could silently diverge. One function, one branch, one clamp.

### The kcal-per-kilogram constant is approximate and named as such

A commonly used approximation (roughly 7700 kcal per kg of body mass) is
used to convert a weekly rate into a daily calorie adjustment:
`dailyAdjustment = -(rateKgPerWeek * KCAL_PER_KG) / 7`. Negative rate (loss)
produces a negative (deficit) adjustment; positive rate (gain) produces a
surplus; the sign falls out of the arithmetic rather than needing a
separate lose/gain branch.

*Why not a more precise metabolic model:* the conversion is already an
approximation in every app that uses it, including Cronometer's — actual
energy density of lost or gained mass varies by body composition, and nobody
in this space claims otherwise. The constant is named and commented as an
approximation rather than presented as a precise conversion.

### The forecast date is computed at render time, never persisted

`weeksToGoal = (currentWeightKg - targetWeightKg) / rateKgPerWeek`
(direction-agnostic — a positive rate toward a higher target, or a negative
rate toward a lower one, both resolve to a positive week count); the date
shown is `today + weeksToGoal`, recalculated wherever it's displayed from
`profile.weightKg` (which does change — see `add-energy-sources` and normal
weight updates) and the stored rate/target.

*Why not store the computed date:* a stored date is a claim frozen at the
moment it was computed, and `profile.weightKg` moves independently of it —
logging a heavier or lighter week should visibly shift the forecast, not
leave a stale date sitting on screen contradicting the trend. Computing at
render time is also simply cheaper than keeping a derived value in sync.

*Why this is worded as an estimate, not a promise (decision 15's spirit):*
a specific dated claim reads with more confidence than the number deserves
— it's a linear extrapolation from an approximate constant. The copy
attached to it says so, the same discipline decision 15 already applies to
pantry quantities, extended here to a calorie-math output rather than a
stock estimate.

### The rate input is bounded, not free text

A minimum and maximum weekly rate are enforced by the input control itself
(a stepper or bounded slider, matching Cronometer's stepper pattern from
the teardown), not just validated after entry.

*Why bound at the input rather than only at the clamp:* `MIN_TARGET_CALORIES`
already prevents an absurd rate from producing an absurd *target*, but it
does so silently — the user picks 2 kg/week, sees a 1200-calorie floor with
no visible connection to what they asked for. Bounding the input keeps what
they can ask for inside what the app can honestly deliver.

## Risks / Trade-offs

**Two adjustment paths could drift** → mitigated by the single-function,
single-clamp design above rather than parallel calculations.

**The kcal-per-kg constant is a simplification** → named and commented as
one; the forecast copy says "estimate," not "date."

**A stale-looking forecast if weight isn't logged regularly** → the date is
only as fresh as the last recorded weight; this is inherent to a forward
projection from a moving figure, not something this proposal can fix
without weight history (explicitly out of scope — see Non-Goals).

## Migration Plan

Append one forward-only migration adding nullable `profile.target_weight_kg`
and `profile.weight_goal_rate_kg_per_week`. Existing rows keep both null,
which is correct — no prior user has stated either. `DROP_ALL` is
unchanged; no new tables.

Rollback is additive: an older build ignores both columns and
`energyTargets()` always takes the existing fixed-goal branch.

## Open Questions

- **Exact min/max rate bounds.** Left to implementation — pick values that
  keep the resulting target comfortably above `MIN_TARGET_CALORIES` for a
  typical `maintenance` figure, and revisit if real usage shows the bounds
  are wrong in either direction.
