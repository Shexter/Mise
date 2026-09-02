## Context

**Planning only.** No implementation is authorized by this document.

The kitchen branch of onboarding ends at `app/onboarding/first-plan.tsx`, which
builds a `MealPrepPlan` in React state from templates, shows it, and then calls
`router.replace('/(tabs)')`. `MealPrepPlan` is a type in `src/types.ts` with no
table behind it — `grep` finds no plan schema, no plan query, and no route that
takes a plan id. The plan is gone the moment the screen unmounts.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- A first plan that outlives the screen that built it.
- A hand-off that ends inside the plan rather than on an unrelated tab.
- Steps 3 and 4 matching the accepted concept.

**Non-Goals:**
- A meal-planning feature. One plan, resumable.
- Mandatory photography.
- New generated art.

## Decisions to make

These are the forks worth settling before anyone writes code. Each is stated
with a recommendation and the reason, not as a conclusion.

### 1. Where a first plan is persisted

- **Options**: (a) a `meal_prep_plans` table with its steps and ingredients;
  (b) one JSON blob on cooking preferences; (c) keep it in memory and rebuild it
  deterministically on demand.
- **Recommendation**: (a). The plan already has a modelled shape
  (`MealPrepPlan`, `CookingGuideStep`, `MealPrepIngredient`), and the project's
  convention is that all SQL lives in `src/db/queries.ts` behind a forward-only
  migration. A blob would put a structure the app already types into a column
  nothing can query.
- (c) is tempting and wrong: a plan is built from the pantry, and the pantry
  changes. Rebuilding later produces a *different* plan than the one the person
  was shown and agreed to, which is a quiet substitution.
- Whichever wins, it is a new forward-only migration appended to `MIGRATIONS`,
  never an edit to an existing one.

### 2. What "finish" does

- **Options**: (a) finishing offers **Start cooking** and **Look around first**;
  (b) finishing always lands on Today with a prompt; (c) finishing starts the
  cooking guide outright.
- **Recommendation**: (a). (c) takes the choice away from someone who may have
  been setting the app up on the bus, and (b) is the current behaviour plus a
  banner — better, but it still ends the flow by changing the subject.
- The existing `Post-milestone bridges offer next setup or direct app entry`
  requirement already establishes the two-door pattern for the calorie branch.
  This applies the same shape to the branch that lacks it, rather than inventing
  a second pattern.

### 3. Where the resume prompt lives

- **Recommendation**: Pantry, next to the existing banner, whose condition
  widens from `mealPrepStatus === 'deferred'` to also cover a completed setup
  holding an unstarted plan. Today is the calorie surface; the plan is a kitchen
  object.
- The prompt must be dismissible and must disappear once the plan is started or
  discarded. A permanent banner is a nag, and this one has a definite end state.

### 4. Step 3's intake shape

- **Recommendation**: camera-led with two escapes. A framed scan area with
  vector viewfinder corners (the same chrome `enliven-illustrated-surfaces`
  introduces on the add sheet), **Scan ingredients** as the primary action into
  the existing `/pantry-capture` route, suggested starter chips beneath, and
  **Add by hand** last.
- The existing catalogue list is not deleted, it stops being the front door.
  `Manual entry is never blocked by API-key setup` already binds this screen: a
  person with no key and no camera must still be able to finish, so the chips
  and the by-hand path are load-bearing, not decoration.
- The suggested starters in the concept — chicken, rice, potatoes, vegetables,
  meat — are broad canonical ingredients, and each already has promoted tier-3
  art. No generation needed.

### 5. Step 4's presentation

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

## Implementation Seams

- `src/db/schema.ts` — new forward-only migration, if decision 1 lands on (a).
- `src/db/queries/` — plan read and write.
- `src/store/cookingPreferencesStore.ts` — plan state and lifecycle.
- `app/onboarding/starter-pantry.tsx`, `app/onboarding/first-plan.tsx`.
- `app/(tabs)/pantry.tsx` — widened resume banner.
- `src/logic/mealPrep*` — template-to-plan composition, if a `techniqueId` is added.

## Risks / Trade-offs

- **[Risk] A saved plan goes stale.** It names ingredients the person may use up
  the next day. Open question 3. The honest options are to show the plan with its
  missing items marked, or to say plainly that it no longer fits the pantry —
  never to silently rebuild it into a different plan.
- **[Risk] Camera-first excludes.** Mitigated by chips and by-hand, which the
  existing spec already requires.
- **[Trade-off] Persisting a plan invites a plan library** nobody has asked for.
  Keeping it to one current plan is the smaller commitment, and a table can hold
  more later without a second migration shape.
