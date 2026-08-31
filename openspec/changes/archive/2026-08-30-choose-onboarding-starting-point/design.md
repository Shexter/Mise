## Context

See `proposal.md` for motivation.

Mise combines on-device calorie & macro tracking with kitchen pantry stock & meal prep. The onboarding experience currently routes through `app/onboarding/welcome.tsx` (which presents calorie target options first) and `app/onboarding/goals.tsx` (which had a circular routing bug when continuing).

## Goals / Non-Goals

**Goals:**
- Make the first screen (`welcome.tsx`) present the clear starting point choice ("Where would you like to start?"):
  1. **Daily calorie & macro target** (estimated calculation or DEXA/InBody report)
  2. **Kitchen & meal prep** (appliances, starter pantry, first plan)
- When calorie setup finishes (`results.tsx`), provide two clear actions:
  - Primary: **"Set up kitchen & meal prep"** $\rightarrow$ flows into `appliances.tsx`
  - Secondary: **"Head straight to the app"** $\rightarrow$ enters `(tabs)`
- When kitchen setup finishes (`first-plan.tsx`), provide two clear actions:
  - Primary: **"Set up daily calorie target"** $\rightarrow$ flows into `sex.tsx`
  - Secondary: **"Head straight to the app"** $\rightarrow$ enters `(tabs)`
- Fix `ONBOARDING_ENTRY_ROUTES` and dynamic step resolution (`getOnboardingSteps` and `stepIndex`) to support bidirectional flow sequences without circular loops.

**Non-Goals:**
- Removing either feature from the product.
- Storing partial unconfirmed data.

## Decisions

### 1. Unify starting screen on `welcome.tsx`
- **Decision**: Keep `welcome.tsx` as the single canonical first route, but retheme its content as the starting point choice ("Where would you like to start?"). Tapping either card directly routes to the appropriate next screen:
  - Calorie target $\rightarrow$ `/onboarding/sex` (or DEXA options)
  - Kitchen & meal prep $\rightarrow$ `/onboarding/dietary` $\rightarrow$ `appliances`
- **Alternative considered**: Having two separate welcome screens. Rejected to avoid route clutter and confusing back transitions.

### 2. State & Dynamic Step Progression
- **Decision**: Update `src/store/onboardingStore.ts`:
  - `ONBOARDING_ENTRY_ROUTES.estimated` points to `/onboarding/sex`.
  - Update `getOnboardingSteps(startingPoint, completedBranches)` to accurately calculate the progress bar ticks for the active path without getting trapped.
- **Alternative considered**: Hardcoding fixed step counts. Rejected because `StepShell` dynamically computes accessible step count.

### 3. Post-Milestone Handoff Actions
- **Decision**:
  - In `app/onboarding/results.tsx`, add a footer with:
    - Primary: `Set up kitchen & meal prep`
    - Secondary: `Head straight to the app` (calls `resetDraft()` and `router.replace('/(tabs)')`)
  - In `app/onboarding/first-plan.tsx`, add footer actions:
    - Primary: `Set up daily calorie target` (routes to `/onboarding/sex`)
    - Secondary: `Head straight to the app` (calls `resetDraft()` and `router.replace('/(tabs)')`)

## Affected Modules

- `app/onboarding/welcome.tsx`
- `app/onboarding/goals.tsx` (remove or merge into welcome)
- `app/onboarding/results.tsx`
- `app/onboarding/first-plan.tsx`
- `src/store/onboardingStore.ts`
- `test/regular-onboarding.test.ts`
- `test/onboarding-intake-ui.test.ts`
- `test/meal-prep-onboarding-routes.test.ts`

## Risks / Trade-offs

- [Risk] If someone skips kitchen setup, they might wonder where to configure appliances later.
  $\rightarrow$ **Mitigation**: The Pantry and Settings tabs already contain entry points to edit appliances.
- [Risk] If someone skips calorie setup, they might wonder where to configure body stats later.
  $\rightarrow$ **Mitigation**: The Today and Settings tabs already contain entry points to calculate/edit calorie targets.
