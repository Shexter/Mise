# Proposal: Carry people into their first prep plan

**Planning only.** This change is a plan. No implementation is authorized by it;
`tasks.md` is unchecked on purpose.

## Why

Onboarding's kitchen branch ends by building someone a meal-prep plan out of the
appliances and pantry they just entered — and then throws it away.

`app/onboarding/first-plan.tsx` composes `currentPlan` in memory from templates.
Nothing persists it: there is no plan table, no plan query, and no route that
can show it again. `onFinishSetup` calls `router.replace('/(tabs)')`, so the
person lands on Today, and the plan they were just shown no longer exists
anywhere in the app.

The only affordance pointing back at meal prep is the Pantry banner, and it is
gated on `mealPrepStatus === 'deferred'` — it appears for people who **skipped**
the flow and never for people who **finished** it. Finishing is the state with
the least guidance, which is backwards.

Two of the concept screens are also still unbuilt as designed. Step 3, "Start
with what you already have", is camera-led — a framed scan area, a **Scan
ingredients** button, and a row of suggested starters — where the implemented
`starter-pantry` is a checkbox list of catalogue rows. Step 4, "Your first prep
plan", leads with the finished dish, three meta chips, an ingredient summary,
and an illustrated numbered cooking guide; the implemented screen is text cards.

## What Changes

- **The plan survives onboarding.** A completed first plan is persisted so it can
  be reopened, rather than existing only inside one screen's React state.
- **Finishing hands off into the plan, not to the home screen.** Completing the
  kitchen branch offers to start cooking now; choosing to look around first
  lands on Today with a resumable prompt that opens the saved plan — the same
  courtesy the calorie branch already gets, which the meal-prep branch does not.
- **The Pantry resume banner covers `completed`, not only `deferred`.** A person
  who finished setup and has an unstarted plan is the case that most deserves a
  way back in.
- **Step 3 becomes camera-led**, matching the concept: a framed scan area with
  vector viewfinder corners, a primary **Scan ingredients** action into the
  existing pantry-capture flow, suggested starter chips for people who would
  rather tap than photograph, and **Add by hand** as the quiet third path. The
  existing catalogue selection stays reachable; it stops being the only way.
- **Step 4 adopts the concept layout**: the dish as a hero, appliance, portion
  and time as chips, an ingredient summary line, and a numbered cooking guide
  whose steps carry technique illustrations from the registry
  `connect-generated-illustrations` already built.

## Capabilities

### Modified Capabilities
- `onboarding-ux`: the post-milestone bridge requirement gains the meal-prep
  side of the hand-off it currently only specifies for calories, and the kitchen
  steps gain their intake and presentation requirements.

## Non-goals

- Changing which appliances, ingredients, or plan templates exist.
- Building a full meal-plan feature — recurring plans, scheduling, or a plan
  library. This persists one first plan so it can be resumed.
- Making photography mandatory. Every camera path keeps a by-hand equivalent,
  per the existing `Manual entry is never blocked` requirement.
- Changing the calorie branch's bridge, which already works.
- Any new generated art. The technique, ingredient, and appliance sets already
  cover these screens.

## Open questions

1. **Where does a saved plan live?** A new `meal_prep_plans` table is the honest
   home, but a single-row preference blob would do if a plan is never meant to
   be listed. This decides whether the change carries a migration.
2. **Does starting the cooking guide from Today reuse the onboarding sheet, or
   does the guide become its own route?** The second is more work and removes an
   onboarding screen's second job.
3. **What happens to a saved plan when the pantry changes underneath it?** A plan
   naming ingredients someone has since used up should probably say so rather
   than silently mislead.

## Impact

- Likely a forward-only migration for plan persistence, plus queries in
  `src/db/queries/`.
- `app/onboarding/starter-pantry.tsx`, `app/onboarding/first-plan.tsx`.
- `app/(tabs)/pantry.tsx` and `app/(tabs)/index.tsx` resume prompts.
- `src/store/cookingPreferencesStore.ts`.
