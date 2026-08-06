## Context

See `proposal.md` — Why, the recalculation bug this would otherwise introduce,
and why the app must do less with body-composition data rather than more.

What ships today: `src/logic/bmr.ts` computes Mifflin-St Jeor, multiplies by
`activityMultiplier`, adds `goalAdjustment`, and floors at
`MIN_TARGET_CALORIES` (1200). `Profile` carries sex, age, height, weight,
activity level, goal, `targetCalories`, a macro split, units, and
`onboardedAt` — no composition data of any kind. Onboarding is nine linear
screens with no branch. `profileStore.update` recomputes `targetCalories` on
every write. `ensureDailyTarget` already snapshots the target per day, so past
days keep the target that was active then.

## Goals / Non-Goals

**Goals:**

- Someone with a DEXA scan or a tracker figure gets a target built from it.
- Everyone else's onboarding is one screen longer, and that screen is
  pre-answered.
- More precise inputs make the arithmetic better and the app's claims no bigger.

**Non-Goals:**

- Diagnosis, storing the rest of the scan, health-app integrations, composition
  history, replacing onboarding, a formula menu, validating a scan. See the
  proposal.

## Decisions

### Body fat percentage is the stored field, not lean mass

Fat-free mass is derived: `weight × (1 − bodyFatPct)`.

*Why not store lean mass directly, which both machines print:* they do not mean
the same thing by it. DEXA reports lean soft tissue and, separately, bone
mineral content; "fat-free mass" includes bone and "lean mass" often does not,
and the gap is a few kilograms. InBody uses its own vocabulary again. Asking for
a number whose definition varies by machine means silently mixing two quantities
in one column.

Body fat percentage is the field both report prominently, under the same name,
meaning the same thing. Deriving from it and the user's weight is more portable
than reconciling scanner conventions the app cannot see.

*Consequence, named honestly:* Katch-McArdle wants fat-free mass, and
`weight × (1 − bodyFatPct)` is fat-free mass by definition, so the derivation is
sound. What it inherits is the scanner's own body fat figure, which is the input
the user actually has.

### Katch-McArdle for the measured path

`370 + 21.6 × fatFreeMassKg`, then the same activity multiplier and goal
adjustment the existing path uses.

*Why it belongs here and Mifflin-St Jeor does not:* Mifflin-St Jeor's entire job
is guessing body composition from height and weight, because height and weight
are all it has. When composition is measured, the guess is the part to remove —
that is the whole reason this change exists, and it is what the trainer's
feedback was actually about.

*Why the activity multiplier and goal adjustment still apply:* Katch-McArdle
produces resting energy, not daily expenditure. The two later stages of the
existing pipeline are unchanged and unaffected by which formula produced the
resting figure.

### A stated figure is qualified before it is used

Three kinds: resting, total daily, already-adjusted target.

*Why this is a first-class question and not a detail:* it is the failure mode
most likely to make this feature actively harmful. Apple Health exposes
"Resting Energy" and "Active Energy" as separate figures, and a ring or watch
usually shows a total burn, an active burn, or both. These differ by many
hundreds of calories, people conflate them constantly, and every one of them is
"the number my health app says".

A user who reads off active energy — perhaps 600 — and hands it over as a daily
total gets a target that would be dangerous if followed. The app cannot tell
which number it received by looking at it, so it asks, and then it checks the
magnitude is consistent with the answer.

*Why "already-adjusted target" is offered:* someone working with a trainer has
been given a number to eat, not a number they burn. Applying the goal adjustment
to it would double-count the deficit.

### Implausible values are flagged and never corrected

Ranges per kind, as named constants. Outside them, say so and let the user
proceed.

*Why not clamp:* a clamped value looks like the value the user entered and is
not. The app would then compute against a number nobody chose, and the person
would have no way to see it. `MIN_TARGET_CALORIES` clamping is defensible for a
figure the app derived; it is not defensible for one the user typed.

*Why not reject:* athletes, very tall people, and people recovering from illness
have real figures outside any range worth encoding, and the app has no standing
to tell someone their measured number is wrong.

*Why flag at all:* the mistyped digit and the misidentified figure are both
common, and both produce a silently wrong target. A sentence costs nothing and
catches most of them.

*The one place to be loud:* a resulting target below `MIN_TARGET_CALORIES`. The
app still does not block — it is the user's body and the user's decision — but
this is where a quiet note is not enough.

### Every computable estimate is shown at the point of choosing

If the profile can produce an estimate, show it next to the user's figure.

*Why not rank the sources and pick the best:* it is tempting to rank stated
above measured above estimated, and it would be wrong. A DEXA-derived figure is
genuinely solid; a wearable's calorie burn is an estimate from a device with its
own error, and consumer trackers are widely optimistic about active energy. So
"the user has a number" does not mean the number is better than the app's.

The app is not equipped to referee that, and the user is the one who knows where
their figure came from. So the app shows its working, and the user chooses.
Which is also the honest posture for a feature whose whole premise is that the
user may know more than the form.

### Recalculation becomes conditional, and this is a requirement

`profileStore.update` recomputes on every write. With a stated source that
silently destroys the user's figure the next time they log a weight.

*Why it needs stating rather than being obvious:* the current line is correct
today and will keep looking correct. The bug only appears for a user who stated
a figure and then edited something unrelated — and it appears as a number
quietly drifting, with no error and nothing to notice. The person most likely to
be affected is the one who cared enough to get a scan.

*The rule:* estimated recomputes from the profile, measured recomputes from the
measurement, stated recomputes nothing. Past days are already protected by
`ensureDailyTarget`.

### A stale measurement is disclosed rather than expired

Record the measurement weight and date. When current weight diverges materially,
say the derived target is less reliable and offer to update it.

*Why disclose rather than fall back:* silently reverting to Mifflin-St Jeor
would change someone's target without their involvement, which is the same class
of mistake as the recalculation bug. Their measurement is still the best
information available; it is just older.

*Why weight divergence rather than elapsed time:* someone whose weight has not
moved in a year has a measurement that is probably still fine, and someone who
has lost eight kilograms in three months does not. Time is a proxy; weight
change is the thing the derivation actually depends on.

### One routing screen, pre-answered

*Why not a longer form for everyone:* the trainer's complaint was that
onboarding does not ask enough to work out what *they* need — a person with a
scan. The fix for that is a branch, not more questions for the person who has
never heard of Katch-McArdle. A form that asks everybody for a body fat
percentage makes onboarding worse for almost everyone in order to serve a few.

*Why during onboarding rather than only in settings:* someone who has a DEXA
scan wants their target right from day one, and a target that was wrong for a
month is a bad first impression for exactly the audience most able to tell.

## Risks / Trade-offs

**A misidentified figure produces a dangerous target** → the sharpest risk here,
and the reason the kind is asked and the magnitude checked. It cannot be fully
eliminated: a user determined to enter active energy as a total can.

**The app starts to look clinical** → body-composition inputs invite
body-composition outputs, and the request that prompted this used the word
diagnosis. Mitigation is the storage boundary — only fields that compute
something — plus a copy audit and a forbidden-word test, the same machinery as
decisions 108 and 142.

**Katch-McArdle is not obviously better in practice** → it is better when
composition is measured accurately, and consumer bioimpedance devices vary. A
DEXA is solid; an InBody is decent; a bathroom scale's body fat reading is close
to noise. The app cannot tell which it received. Mitigation: this is why the
alternatives are shown side by side rather than the app declaring one correct.

**Three sources triple the paths through target calculation** → mitigated by
resolving to one function with a source parameter, and by the existing two
stages staying shared.

**Someone enters a figure and forgets** → months later their target is a number
they no longer remember choosing. Mitigation: the source is visible wherever the
target is, which is also what makes it changeable.

## Migration Plan

One forward-only migration adding to the profile, all nullable: target source,
body fat percentage, measurement weight, measurement date, stated figure, stated
figure kind.

Existing profiles get the estimated source, which is what they already are.
Their behaviour is byte-identical afterwards — the same formula, the same
recalculation, the same number.

`DROP_ALL` needs no change if the profile table is already covered — confirm.

Rollback ignores the new columns and computes as today.

## Open Questions

- **What counts as material weight divergence.** A named constant, and a guess
  until there is usage. Probably a percentage of body weight rather than an
  absolute.
- **Whether the activity enum should also get finer**, which is the other half
  of the trainer's complaint. Training frequency and type would improve the
  multiplier for everyone, not just people with scans. Genuinely worth doing and
  deliberately not in this change, which is already touching the oldest code in
  the app.
- **Whether a stated figure should decay.** A tracker's figure from a year ago
  is as stale as a scan, and nothing here detects that. The weight-divergence
  check does not apply, because a stated total already includes whatever the
  device thought.
