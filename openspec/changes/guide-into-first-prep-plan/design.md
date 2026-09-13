## Context

**Planning only.** No implementation is authorized by this document.

**Reconciled 2026-09-07.** This change has been narrowed to the two onboarding
screens. Its plan-persistence and hand-off decisions moved to
[`lead-with-weekly-meal-planning`](../lead-with-weekly-meal-planning/); see
"Decisions settled elsewhere" below for where each one landed and what it was
answered with. What remains is presentation and intake work on
`app/onboarding/starter-pantry.tsx` and `app/onboarding/first-plan.tsx`.

Step 3 is a checkbox list of catalogue rows where the concept is camera-led.
Step 4 is text cards where the concept is a hero dish, meta chips, an ingredient
summary and an illustrated numbered guide. The technique illustration registry
that `connect-generated-illustrations` built is unused on the one screen it was
drawn for. `resolveTechnique()` lives in `src/media/techniqueIllustrations.ts`
and is rendered through `src/components/TechniqueIllustration.tsx`.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Steps 3 and 4 matching the accepted concept.
- An intake step that a person with no camera and no provider key can finish.
- A cooking guide that reads as designed when only some steps resolve to art.

**Non-Goals:**
- Persisting a plan, or choosing where one lives.
- Changing the kitchen branch's destination or the Pantry resume banner.
- Mandatory photography.
- New generated art.

## Decisions to make

These are the forks worth settling before anyone writes code. Each is stated
with a recommendation and the reason, not as a conclusion.

### 1. Step 3's intake shape

- **Recommendation**: camera-led with escapes that stay visible. A framed scan
  area with vector viewfinder corners (the same chrome
  `enliven-illustrated-surfaces` introduces on the add sheet), **Scan
  ingredients** as the primary action into the existing `/pantry-capture` route,
  suggested starter chips beneath, and **Add by hand** last.
- The existing catalogue list is not deleted, it stops being the front door.
  `Manual entry is never blocked by API-key setup` already binds this screen: a
  person with no key and no camera must still be able to finish, so the chips
  and the by-hand path are load-bearing, not decoration.
- **Decision 180 binds the layout, not just the copy.** It settled that this
  step lists voice "beside camera and manual entry" and that none of those gate
  anything. The microphone action must therefore survive the redesign as a
  visible sibling on the step. Promoting the camera is fine; folding speech into
  the capture flow, or pushing it below the fold to make room for the scan
  frame, would reverse 180. Treat the three intake routes plus the catalogue
  list as one row of peers with the camera visually primary.
- The suggested starters in the concept — chicken, rice, potatoes, vegetables,
  meat — are broad canonical ingredients, and each already has promoted tier-3
  art. No generation needed.

### 2. Step 4's presentation

- **Recommendation**: hero dish, three meta chips (appliance, portions, time),
  an ingredient summary, then the numbered guide with a technique illustration
  per step from `resolveTechnique()`.
- The technique matcher is already conservative: a step it cannot match renders
  as text. On template steps like "Rinse rice and add water" that is the likely
  outcome for some rows, and the design must look deliberate with a mix of
  illustrated and text-only steps rather than assuming every step gets art.
- **This is the one place a stored technique id would pay off.**
  `CookingGuideStep` already carries `applianceId` and `actionType`; templates
  are authored, not free text, so a `techniqueId` on the template would make
  step art exact instead of inferred. `resolveTechnique()` was built to prefer a
  stored id for exactly this.
- The counter-argument, recorded because it is the reason this is still a
  question: a `techniqueId` puts a presentation concern onto a content record
  that `lead-with-weekly-meal-planning` is about to snapshot into immutable
  planner records. If it is added, it should be added before those snapshots
  start being written, not after.

### 3. What step 4 shows once the planner owns the plan

- `lead-with-weekly-meal-planning` replaces the in-memory `MealPrepPlan` this
  screen builds with a saved dated meal, and routes planned-meal cooking guides
  to the existing review/save journey. This change does not decide that.
- **Recommendation**: build the presentation against the data the screen already
  has — dish, appliance, portions, time, ingredients, `CookingGuideStep[]` —
  and let the planner change swap what supplies it. All of those fields exist on
  both shapes, so the layout does not need to know which one it is rendering.
- What this change must not do is add a second way for step 4 to hold a plan.
  That is the "second saved-plan system" the planner change's task 7.5 exists to
  prevent.

## Decisions settled elsewhere

Recorded so the reasoning is not lost and so nobody reopens them here.

| Question this change used to ask | Where it is answered | Answer |
| --- | --- | --- |
| Where a first plan is persisted — table, blob, or rebuilt on demand | `lead-with-weekly-meal-planning` design §7 | Durable records — `meal_schedules`, `planner_recipe_snapshots`, `planned_batches`, `planned_meal_slots`, `week_templates` — as forward-only migrations behind the existing query facade. The old recommendation here (a `meal_prep_plans` table) is superseded by a schedule that holds many dated meals. The rejection of "rebuild it deterministically" survives and is the same argument: a plan rebuilt from a changed pantry is a quiet substitution. |
| What "finish" does on `first-plan` | `lead-with-weekly-meal-planning` §7.4 and its `onboarding-ux` delta | The first scheduled meal persists before handoff, and the person lands in Week focused on that meal. Both setup bridges are preserved. |
| Where the resume prompt lives | `lead-with-weekly-meal-planning` §7.5 | Pantry setup prompts are reconciled with the shared planner; Today gains one dismissible planning introduction for existing installs. |
| What a saved plan says once the pantry no longer matches it | `lead-with-weekly-meal-planning` design §5 | The premise is removed rather than answered: pantry stock never gates a planned recipe. Grocery demand is the plan's own requirement, coverage is an optional review, and changed demand invalidates coverage for re-review instead of invalidating the plan. |

## Implementation Seams

- `app/onboarding/starter-pantry.tsx`, `app/onboarding/first-plan.tsx`.
- `src/media/techniqueIllustrations.ts` (`resolveTechnique()`) and
  `src/components/TechniqueIllustration.tsx` — read-only unless decision 2 lands
  on a stored id.
- `src/logic/mealPrepTemplates.ts` and `src/types.ts` (`CookingGuideStep`), only
  if a `techniqueId` is added.
- `app/pantry-capture.tsx` — entered, not modified.
- **No `src/db/` change and no migration.** That is the reconciliation's whole
  effect on this document.

## Risks / Trade-offs

- **[Risk] Camera-first excludes.** Mitigated by chips, by-hand and the existing
  catalogue list, which the current spec already requires. The failure mode to
  watch is not "no camera path" but "the escapes are below the fold".
- **[Risk] The redesign quietly demotes voice.** Decision 180 put the microphone
  on this step deliberately. A scan frame is large and will compete for the same
  space. Verify the microphone is still visible without scrolling at 411 dp.
- **[Risk] Step 4 gets rewritten twice.** `lead-with-weekly-meal-planning`
  changes what supplies this screen. Building the layout against fields that
  exist on both shapes keeps the rewrite to a data source swap; landing this
  change after the planner's §7.3–7.4 avoids it entirely.
- **[Trade-off] Partial technique coverage is visible.** Designing for a mix is
  more work than assuming full coverage, and it is the honest option:
  `resolveTechnique()` returning `null` is a real outcome on authored template
  steps, not an edge case.
