# Weight goal + goal-rate onboarding

**Screenshots:** `onboarding-1-profile.jpg, onboarding-1-sex-picker.jpg, onboarding-1-birthday-picker.jpg, onboarding-1-height-picker.jpg, onboarding-2-activity-level.jpg, onboarding-2-activity-custom.jpg, onboarding-3-weight-goal.jpg, onboarding-4-goal-rate.jpg, onboarding-5-goal-overview.jpg`
**Cronometer tier:** free

## What it does

A 7-step onboarding wizard. Steps relevant here: (1) sex/birthday/height/
weight, (2) activity level — six presets from Sedentary to Very Active, each
with a one-line example ("Pro athletes, military training...") plus a
"Custom" option to hand-enter a fixed daily exercise-calorie value, (3) a
target weight, (4) a **goal rate** — a stepper the user nudges up/down
("0.113 kg lost / week") with live reassurance copy underneath ("This goal
rate is often easier to maintain... without needing to push or restrict
further"), (5) a goal overview screen showing the resulting energy target
(2467 kcal), the weight goal, and a **forecast completion date** ("Goal
Forecast: Aug 25, 2028") computed from the rate.

## UI pattern observed

Linear numbered wizard (STEP 1 of 7, dot progress bar at top), each step
full-screen with a big heading + one-line explainer, Next/Skip at the
bottom. The goal-rate step reads as an editorial device more than a slider:
it doesn't show numeric bounds, just a stepper and changing supportive
copy, so pushing the rate too aggressive presumably swaps in different
(less reassuring) text — that pattern wasn't captured in these screenshots
but is implied by the visible "Goal Rate Review" copy block.

## Implied data model

A target weight, a desired weekly rate of change, and a derived daily
calorie deficit/surplus computed as (rate × known kcal-per-kg) subtracted
from expenditure — then a forecast date from (current weight − target) ÷
rate.

## Gap-check against Mise

- **Already have, and arguably better:** Mise's `add-energy-sources` change
  (decisions 172–173) already supports four target sources — estimated,
  DEXA, InBody, stated — dispatched through a closed `TargetSource` union.
  That's a more rigorous expenditure model than Cronometer's simple
  Mifflin-St Jeor + six-bucket activity multiplier shown here.
- **Missing entirely:** the *goal-directed* layer on top of expenditure —
  a target weight, a chosen rate of change, and a calorie budget derived
  from that rate with a forecast date. Nothing in `docs/product-decisions.md`
  or `src/logic` covers weight-goal pacing; Mise's targets appear to answer
  "what do I burn," not "what should I eat to hit a weight by when."
- **Conflicts with a non-negotiable:** worth flagging, not necessarily
  rejecting — a forecast date is a specific, falsifiable claim ("Aug 25,
  2028") derived from a rate the user picked, which sits close to the
  spirit of decision 15 (don't display what you can't defend) even though
  it's not a *pantry* quantity. If adopted, the copy should read as a
  reversible estimate that moves as logging continues, not a promise.

## Verdict

**Adopt** — goal-directed calorie budgeting (weight target + rate → daily
target + forecast) is a real, well-scoped feature Mise doesn't have at all,
and it composes cleanly on top of the existing `TargetSource` work rather
than replacing it: the rate/forecast layer just needs an expenditure number
to subtract from, which Mise already computes.

**Linked OpenSpec change:** `none yet` — candidate `add-weight-goal-pacing`,
scoped to sit on top of `add-energy-sources` rather than re-deriving BMR.
