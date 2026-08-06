## Context

See `proposal.md` — Why, why DEXA and InBody cannot share a screen, why better
data earns a shorter form, and why the app must do less with scan data rather
than more.

What ships today: `src/logic/bmr.ts` computes Mifflin-St Jeor, multiplies by
`activityMultiplier`, adds `goalAdjustment`, floors at `MIN_TARGET_CALORIES`
(1200). Onboarding is nine linear screens. `profileStore.update` recomputes
`targetCalories` on every write. `ensureDailyTarget` snapshots the target per
day, so past days are already protected.

Verified by grep: `sex`, `age` and `heightCm` are read by `energyTargets` and
displayed in `ProfileSheet.tsx`. Nothing else in the app computes with them.

## Goals / Non-Goals

**Goals:**

- The regular onboarding is untouched, and stays the primary way in.
- Each kind of measurement is asked for in its own terms.
- Switching provider is non-destructive and reversible.

**Non-Goals:**

- Changing the regular flow, diagnosis, storing the rest of the scan,
  composition history, health-app integration, validating a scan, supporting
  every device. See the proposal.

## Decisions

### Four sources, as one closed set with total dispatch

`estimated | dexa | inbody | stated`.

*Why the providers are source values rather than a `measured` source with a
provider field:* the derivation differs per provider, so the branch exists
either way. Making it the discriminator means `Record<TargetSource, Resolver>`
fails to compile when a source is added without its logic — the same
exhaustiveness discipline `add-openai-provider` applies to transports, and for
the same reason: a missing branch should be a build failure rather than a
runtime default.

*Why `stated` stays:* it was asked for alongside the scans — a figure from a
ring or health app — and dropping it while adding the scan flows would narrow
requested scope. It shares the entrance and the settings surface, and needs no
measurement.

### DEXA and InBody ask different questions because they print different fields

**DEXA** separates fat, lean soft tissue, and bone mineral content. Its "lean
mass" typically excludes bone, so fat-free mass is lean plus BMC — several
kilograms of difference. The flow takes body fat percentage, or lean and BMC
where the user has them, and derives accordingly.

**InBody** prints **fat-free mass directly**, under that name. It also prints
skeletal muscle mass, which is smaller and different and which people confuse
with it constantly. The flow takes the printed fat-free mass and uses it as
given.

*Why not one "body fat percentage" screen for both:* it asks a DEXA user to redo
arithmetic their sheet already did, asks an InBody user to ignore the fat-free
mass printed in front of them, and leaves the app unable to tell which kind of
number it received. The ambiguity is removed at the point of collection rather
than dodged.

*This supersedes the earlier single-screen design*, which chose body fat
percentage precisely because one screen could not tell the providers apart. With
two flows that constraint is gone.

*A note on InBody's own BMR:* it prints one. It is a fourth number and using it
would be the `stated` path wearing a scan's clothes. The flow may offer it, and
if taken it is recorded as a stated resting figure rather than as a measurement,
so the distinction stays visible.

### Measurements are stored per provider, and switching is non-destructive

`body_measurements(provider, …)`, at most one row per provider. The profile
holds the active source.

*Why per provider rather than one replaceable measurement:* switching InBody →
DEXA → InBody is an ordinary thing for someone who scans at a gym and gets a
DEXA yearly, and losing a figure to a switch would be a small betrayal for the
audience most likely to notice. Retaining both also lets the app show what each
would produce, which is what makes the choice informed.

*Why this is not the composition history the proposal rules out:* it is bounded
at one row per provider — two rows — and it holds current measurements rather
than a series. Nothing accumulates and nothing is charted.

*Why only the active provider computes:* two measurements would otherwise need
reconciling, and there is no honest way to reconcile a DEXA against an InBody.
The user picks which they trust.

### A flow asks only for what its source needs

Katch-McArdle is `370 + 21.6 × fatFreeMassKg`. No sex, no age, no height —
confirmed by grep to be needed nowhere else.

So the scan flows ask for weight, the scan's own fields, the date, activity, and
goal. Five screens against the regular flow's seven. `sex`, `age` and
`heightCm` become nullable.

*Why this is a principle and not an optimisation:* the complaint that started
this change was that the form does not fit the person. Collecting three fields a
scan user will never use, on the chance they later switch to estimation, is how
a form gets long — and it would make the flow for people with *better* data
longer than the default, which is exactly backwards.

*What happens on a later switch:* estimation needs those three, so the app asks
then. One prompt at the moment it becomes necessary, rather than three screens
for everyone on the chance.

*The ripple, stated plainly:* three non-nullable `Profile` fields become
nullable, and `ProfileSheet` must render absence rather than assuming a value.
That is the largest mechanical risk in this change.

### Recalculation becomes conditional, and this is a requirement

`profileStore.update` recomputes on every write. That is correct today because
the target is always derived. With a stated source it silently replaces the
user's figure with a Mifflin-St Jeor estimate the next time they log a weight.

*Why it needs stating rather than being obvious:* the line is correct today and
will keep looking correct. The bug appears only for a user who stated a figure
and then edited something unrelated, and it appears as a number quietly
drifting — no error, nothing to notice. The person most likely to be affected is
the one who cared enough to get a DEXA scan.

*The rule:* estimated recomputes from the profile, a provider recomputes from
that provider's measurement, stated recomputes nothing.

### Implausible values are flagged, never corrected

*Why not clamp:* a clamped value looks like what the user entered and is not,
and they have no way to see it. Clamping at `MIN_TARGET_CALORIES` is defensible
for a figure the app derived and not for one the user typed.

*Why not reject:* athletes, very tall people, and people recovering from illness
have real figures outside any range worth encoding, and the app has no standing
to tell someone their measured number is wrong.

*Why flag at all:* a mistyped digit and a misidentified figure are both common
and both produce a silently wrong target. The loud case is a resulting target
below the minimum — still not blocked, because it is the user's body and the
user's decision.

### A stated figure is qualified before use

Resting, total daily, or already-adjusted.

*Why this is first-class:* it is the failure mode most likely to make the
feature harmful. Apple Health exposes "Resting Energy" and "Active Energy"
separately; rings show a total burn, an active burn, or both. They differ by
hundreds of calories, people conflate them constantly, and all of them are "the
number my health app says". Someone offering active energy — perhaps 600 — as a
daily total gets a target that is dangerous if followed.

"Already-adjusted" exists because someone working with a trainer has been given a
number to *eat*; applying the goal adjustment would double-count the deficit.

### Staleness is disclosed rather than fallen back from

Record measurement weight and date; disclose when current weight diverges
materially.

*Why not revert to Mifflin-St Jeor:* that would change someone's target without
their involvement, which is the recalculation bug wearing different clothes.
The measurement is still the best information available; it is only older.

*Why weight divergence rather than elapsed time:* someone whose weight has not
moved in a year has a measurement that is probably fine; someone who has lost
eight kilograms in three months does not. Time is a proxy; weight is what the
derivation depends on.

*Per provider:* an InBody taken monthly at a gym goes stale differently from a
DEXA taken yearly. The threshold is a named constant and may differ by provider.

## Risks / Trade-offs

**Three fields becoming nullable** → the largest mechanical risk. `ProfileSheet`
and anything reading them must handle absence. Mitigated by grep confirming the
read sites are few, and by tests over an estimated profile proving no regression.

**A misidentified stated figure produces a dangerous target** → the sharpest
product risk, and why the kind is asked and the magnitude checked. It cannot be
eliminated: a determined user can still enter active energy as a total.

**The entrance becomes a menu** → four ways in on the first screen is a worse
welcome than one. Mitigated by the regular flow being visually primary and the
others secondary, and by the fact that someone with a DEXA scan is looking for
exactly that button.

**The app starts to look clinical** → scan inputs invite scan outputs, and the
request that prompted this used the word diagnosis. Mitigated by the storage
boundary and a forbidden-word test, as decisions 108 and 142.

**InBody's own BMR muddies the sources** → mitigated by recording it as a stated
resting figure rather than as a measurement, so it is never mistaken for
something derived.

**Katch-McArdle is not automatically better** → it is better when composition is
measured accurately. DEXA is solid, InBody is decent, and the app cannot tell
which it received. Mitigated by showing what each source would produce rather
than declaring one correct.

## Migration Plan

One forward-only migration:

- `profile` gains the active source, the stated figure and its kind; `sex`,
  `age` and `height_cm` become nullable.
- `body_measurements` is created, keyed by provider.

Existing profiles get the estimated source and keep their values, so their
behaviour is byte-identical — same formula, same recalculation, same number.
SQLite cannot drop a NOT NULL constraint in place, so this is a table rebuild;
verify it against a populated database rather than a fresh one.

`DROP_ALL` gains the measurements table.

Rollback ignores the new columns and computes as today.

## Open Questions

- **What counts as material weight divergence**, and whether it differs per
  provider. A named constant, and a guess until there is usage.
- **Whether to accept DEXA lean + BMC as well as body fat percentage.** Both
  appear on the sheet, and taking both is more faithful but a longer form.
  Probably: percentage by default, the other two as an option.
- **Whether the activity enum should get finer**, which is the other half of the
  trainer's complaint. Training frequency and type would improve the multiplier
  for everyone, not only scan users. Worth doing, deliberately not here.
- **Whether a stated figure should go stale.** A tracker figure from a year ago
  is as old as a scan, and the weight-divergence rule does not apply to it.
