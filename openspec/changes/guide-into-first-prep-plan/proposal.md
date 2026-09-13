# Proposal: Build the kitchen setup steps as designed

**Planning only.** This change is a plan. No implementation is authorized by it;
`tasks.md` is unchecked on purpose.

**Reconciled 2026-09-07.** This change originally carried two things: *persist
the first prep plan and hand off into it*, and *build onboarding steps 3 and 4
as the concept draws them*. The first is now owned by
[`lead-with-weekly-meal-planning`](../lead-with-weekly-meal-planning/), which
replaces the single-plan storage this proposal was reaching for with a durable
dated schedule and takes the post-milestone bridge with it. That half has been
removed here rather than left to collide — two changes cannot both own
`onboarding-ux`'s bridge requirement and both add a plan table. The second half
is untouched and is what remains: **the camera-led starter pantry step and the
illustrated cooking guide.** Neither depends on where a plan is stored, and
neither is delivered by the planner change. See "What moved, and why" below.

## Why

Two of the concept screens are still unbuilt as designed.

Step 3, "Start with what you already have", is camera-led in the concept — a
framed scan area, a **Scan ingredients** button, and a row of suggested starters
— where the implemented `app/onboarding/starter-pantry.tsx` is a checkbox list
of catalogue rows. The camera is the fastest honest way to tell Mise what is in
a kitchen, and it is the one the rest of the app already leads with; this step
is the only intake surface that does not offer it.

Step 4, "Your first prep plan", leads with the finished dish, three meta chips,
an ingredient summary, and an illustrated numbered cooking guide. The
implemented `app/onboarding/first-plan.tsx` is text cards. The technique
illustration registry that `connect-generated-illustrations` built is sitting
unused on the one screen it was drawn for.

Both are presentation and intake work. Both were always separable from where a
plan is persisted, and both survive the reconciliation unchanged.

## What Changes

- **Step 3 becomes camera-led**, matching the concept: a framed scan area with
  vector viewfinder corners, a primary **Scan ingredients** action into the
  existing pantry-capture flow, suggested starter chips for people who would
  rather tap than photograph, and **Add by hand** as the quiet third path. The
  existing catalogue selection stays reachable; it stops being the only way.
- **Step 4 adopts the concept layout**: the dish as a hero, appliance, portion
  and time as chips, an ingredient summary line, and a numbered cooking guide
  whose steps carry technique illustrations from the registry
  `connect-generated-illustrations` already built.
- **A mix of illustrated and text-only steps must look deliberate.**
  `resolveTechnique()` is conservative and will not match every authored step,
  so the guide is designed for partial coverage rather than assuming every row
  gets art.

## Decisions

Implements **65** (partial adoption is normal, so nothing here is gated) and
**180** (voice is a sibling of camera capture).

**180 constrains the redesign directly and is easy to break.** It settled that
"the starter-pantry onboarding step lists [voice] beside camera and manual
entry" and that "none of those gate anything". Making the camera primary is
allowed — 180 is about voice not being buried *inside* the camera surface, not
about the camera being demoted — but the microphone must stay a visible sibling
on this step, not fall behind the scan frame. A camera-led step 3 that reduces
voice to an option inside a capture flow would reverse 180 rather than
implement it.

Affected by **198–200**, which move meal planning out of 42's deferred list and
put a durable schedule behind the kitchen branch. Those decisions are the reason
this change no longer carries plan persistence. Nothing here supersedes them.

## What moved, and why

| Originally here | Now owned by | Reason |
| --- | --- | --- |
| Persist a first plan (`meal_prep_plans` table or preference blob) | `lead-with-weekly-meal-planning` §3.1–3.4 | That change adds `meal_schedules`, `planner_recipe_snapshots`, `planned_batches` and `planned_meal_slots`. A second single-plan store beside it is the "second saved-plan system" its task 7.5 exists to prevent. |
| The two-door finish on `first-plan` (start cooking / look around first) | `lead-with-weekly-meal-planning` §7.4 | Both changes modified the same `Post-milestone bridges offer next setup or direct app entry` requirement with different scenarios. Only one can. |
| Widening the Pantry resume banner from `deferred` to `completed` | `lead-with-weekly-meal-planning` §7.5 | The banner's condition is `mealPrepStatus === 'deferred'` at `app/(tabs)/pantry.tsx:213`; reconciling it with the shared planner is explicitly that task. |
| Open questions 1 (where a plan lives) and 2 (guide sheet or route) | `lead-with-weekly-meal-planning` design decisions 4 and 7 | Answered there: durable schedule records behind the existing query facade, and planned-meal cooking guides wired to the existing review/save journey. |
| Open question 3 (a saved plan whose pantry moved) | `lead-with-weekly-meal-planning` design decision 5 | Answered there and inverted: pantry coverage never gates a plan, so a plan does not go stale because stock changed. Demand is recomputed and coverage is re-reviewed. |

Nothing in that column is deleted from the product; it is recorded once, in the
change that carries the migration.

## Capabilities

### Modified Capabilities
- `onboarding-ux`: the kitchen steps gain their intake and presentation
  requirements. This change no longer modifies the post-milestone bridge
  requirement; `lead-with-weekly-meal-planning` owns it.

## Non-goals

- Changing which appliances, ingredients, or plan templates exist.
- Persisting a plan, or defining where one lives. That is
  `lead-with-weekly-meal-planning`'s migration to write.
- Changing where the kitchen branch hands off, or what the Pantry resume banner
  covers.
- Making photography mandatory. Every camera path keeps a by-hand equivalent,
  per the existing `Manual entry is never blocked` requirement.
- Changing the calorie branch's bridge, which already works.
- Any new generated art. The technique, ingredient, and appliance sets already
  cover these screens.

## Open questions

1. **Should authored template steps carry a `techniqueId`?**
   `CookingGuideStep` already has `applianceId` and `actionType`, and
   `resolveTechnique()` was built to prefer a stored id over an inferred match.
   Templates are authored, not free text, so a stored id would make step art
   exact. The counter-argument is that it puts presentation data on a content
   record. This is the only fork left in this change, and it decides task 5.3.

## Impact

- `app/onboarding/starter-pantry.tsx`, `app/onboarding/first-plan.tsx`.
- `src/components/TechniqueIllustration.tsx` and
  `src/media/techniqueIllustrations.ts` (`resolveTechnique()`), read-only unless
  open question 1 lands on adding a stored id.
- `src/logic/mealPrepTemplates.ts` and `src/types.ts`, only if a `techniqueId`
  is added to `CookingGuideStep`.
- **No migration, and no `src/db/` change.** Losing the plan table is what
  reconciliation removed.
- Sequencing: `lead-with-weekly-meal-planning` rewrites the kitchen branch's
  destination in its §7.3–7.4. This change edits the two screens that branch
  passes through. They can land in either order, but landing this one second
  avoids rewriting `first-plan.tsx` twice.
