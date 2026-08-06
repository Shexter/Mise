## Why

A personal trainer looked at onboarding and said it does not ask enough to work
out what someone needs. They are right, and the reason is structural rather than
cosmetic.

`energyTargets` runs Mifflin-St Jeor over sex, age, height and weight, then
multiplies by a coarse activity enum. Mifflin-St Jeor's whole job is to *guess*
body composition from height and weight, because that is all it has. Two people
of the same age, sex, height and weight can differ by several hundred calories a
day depending on how much of that weight is muscle, and the formula cannot see
the difference.

Some people already have the answer. An InBody or DEXA scan measures body
composition directly. Others have a figure from a ring, a watch, or a health app
that has been observing them for months.

Right now the app ignores both and asks them to guess with everyone else.

## What Changes

- **One routing question during onboarding**, with three answers: estimate it
  for me, I have a body scan, I already know my number. The first is the
  existing flow, unchanged and still the default.
- **A body-composition path** using Katch-McArdle, which derives resting energy
  from fat-free mass instead of inferring it from height and weight.
- **A stated-figure path** for someone who already has a number from a tracker
  or a professional.
- **The app asks what the number actually is** — resting, total daily, or an
  already-adjusted target — because these differ by hundreds of calories and are
  routinely confused.
- **Implausible figures are questioned, never silently corrected or refused.**
- **All three estimates are shown** whenever more than one can be computed, so a
  choice is informed rather than blind.
- **A stated target survives a profile edit.** It currently would not — see
  below.
- **The scan date is recorded**, and a target derived from a stale measurement
  says so.

## Capabilities

### New Capabilities

- `energy-sources`: Where the calorie target comes from. Covers the three
  sources and how each is computed, what the app asks about a supplied figure,
  plausibility checks, precedence and recalculation, staleness of a measurement,
  what body-composition data is stored and what is refused, and the language the
  app may use about any of it.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Diagnosis, assessment, or advice.** The app takes numbers and computes a
  calorie target. It does not evaluate anyone's body, health, or progress. This
  is the constraint that shapes the whole change — see below.
- **Storing the rest of the scan.** An InBody sheet carries visceral fat level,
  segmental analysis, phase angle, metabolic age, and a score out of 100. None
  of it computes anything here, and storing it is how an app starts displaying
  it.
- **Connecting to Apple Health, Google Fit, or any wearable.** The user reads
  their number and types it. Integrations mean permissions, platform SDKs, and
  background sync against a local-first app with no server (decision 5). The
  number changes rarely enough to type.
- **Tracking body composition over time.** One current measurement, replaceable.
  A history is a progress-charting feature, which is a different product.
- **Replacing the existing onboarding.** It stays, it stays the default, and it
  does not get longer for the people it already serves.
- **Choosing a formula per user, or offering a menu of them.** One formula per
  source.
- **Validating anyone's scan.** If the sheet says 14%, the app believes 14%.

## Impact

**Schema.** One migration adding, all nullable: the target's source, body fat
percentage, the weight and date at measurement, a stated figure and what kind of
figure it is.

**Code.**
- `src/logic/bmr.ts` — Katch-McArdle alongside Mifflin-St Jeor, and a resolver
  that turns a source plus a profile into a target.
- `src/store/profileStore.ts` — the recalculation currently overwrites; it must
  not.
- `src/types.ts` — `Profile` gains the fields above.
- `app/onboarding/` — one routing screen and two branch screens.
- The profile sheet — editing the source after onboarding.

**Dependencies.** None added.

**Depends on** nothing unmerged. This touches the oldest code in the app and
almost nothing else, which makes it unusually safe to run alongside other work.

## A stated target would currently be destroyed by an unrelated edit

`profileStore.update` recomputes `targetCalories` through `energyTargets` on
every write:

```ts
const recalculated: Profile = {
  ...merged,
  targetCalories: energyTargets(/* … */).target,
};
```

Today that is correct — the target is always derived, so recomputing it is how
an edit takes effect. The moment a target can be *stated*, that same line
silently replaces the user's own figure with a Mifflin-St Jeor estimate the next
time they log a weight change.

It would be invisible. The number would simply drift, and the person most likely
to notice — someone who cared enough to get a DEXA scan — is exactly the person
this change is for.

So recalculation becomes conditional on the source, and that is a requirement
rather than an implementation note.

## Body composition is health data, and the app must get smaller as it gets more

An InBody printout is a page of clinical-looking numbers. A DEXA report is
genuinely medical. The temptation — and the request, phrased as wanting a more
accurate *diagnosis* — is to do more with them.

The app must do less. It takes body fat percentage, the weight it was measured
at, and the date, because those three compute a calorie target. It refuses
visceral fat, segmental lean analysis, phase angle, metabolic age, and every
score, because none of them computes anything here and storing a number is how
an app ends up rendering it, and rendering it is an assessment.

The distinction to hold: **a calorie target is arithmetic; an evaluation of
someone's body is not the app's to make.** A more precise input makes the
arithmetic better. It does not qualify the app to say anything about the person.

This is the same refusal as decision 108 on dietary language and decision 142 on
expiry, arriving somewhere the pull is stronger, and it is enforced the same way:
a copy audit and a test over forbidden words.
