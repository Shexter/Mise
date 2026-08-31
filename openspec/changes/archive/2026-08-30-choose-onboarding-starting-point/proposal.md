# Proposal: Choose Onboarding Starting Point

## Why

Mise combines daily calorie tracking with pantry-based meal prep. However, people download the app with different immediate motivations and operating contexts:
- A person logging their daily nutrition at a desk or on the commute wants to calculate their calorie and macro target immediately, but is not at home to inventory their kitchen appliances or pantry staples.
- A person in their kitchen staring at ingredients wants instant meal prep ideas from their appliances and stock without stepping on a scale or calculating metabolic rates.

Currently, the onboarding flow has a circular routing bug on the goal/intent screen, backwards screen ordering (presenting DEXA/calorie options before intent), and forces people into rigid either/or choices rather than letting them pick what to set up first and smoothly offering the other or letting them head straight to the app.

## What Changes

- **Starting Point Selection ("Where would you like to start?")**: The entry screen clearly introduces Mise's dual strengths (nutrition tracking + kitchen meal prep) and lets the user choose which setup to tackle first:
  1. **Daily calorie & macro target** (calculate targets from body stats, or scan a DEXA/InBody report)
  2. **Kitchen & meal prep** (select appliances & starter pantry staples to generate cooking plans)
- **Calorie Setup First Flow**:
  - Direct route through body metrics (Sex $\rightarrow$ Age $\rightarrow$ Height $\rightarrow$ Weight $\rightarrow$ Activity $\rightarrow$ Goal $\rightarrow$ API Key (skippable) $\rightarrow$ Dietary rules) or DEXA/InBody intake.
  - Reaching the **Results Step** calculates daily targets and presents a seamless bridge:
    - Primary action: **"Set up kitchen & meal prep"** (proceeds to Appliances $\rightarrow$ Starter Pantry $\rightarrow$ First Plan $\rightarrow$ App)
    - Secondary action: **"Head straight to the app"** (enters app with active calorie targets; Pantry tab retains a gentle 1-tap invitation to set up appliances/pantry when home)
- **Kitchen Setup First Flow**:
  - Direct route through Kitchen & Meal Prep (Dietary rules $\rightarrow$ Appliances $\rightarrow$ Starter Pantry $\rightarrow$ First Plan).
  - Completing the first cooking plan presents a seamless bridge:
    - Primary action: **"Set up daily calorie target"** (proceeds to Sex $\rightarrow$ Age $\rightarrow$ Height $\rightarrow$ Weight $\rightarrow$ Activity $\rightarrow$ Goal $\rightarrow$ API Key $\rightarrow$ Results $\rightarrow$ App)
    - Secondary action: **"Head straight to the app"** (enters app with ready meal prep plan; Today tab retains a gentle 1-tap invitation to set calorie targets)
- **Fix Navigation Routing Bugs**: Resolve the circular route recursion on `goals.tsx` / `ONBOARDING_ENTRY_ROUTES` and ensure back-stack navigation works correctly across all paths.

## Capabilities

### Modified Capabilities
- `onboarding-ux`: Update the entry sequence, starting-point selection, and post-milestone bridge steps ("Ready to set up the next one?" vs "Head straight to the app") so that either flow can be completed first while keeping both features first-class and resumable.

## Impact

- `app/onboarding/welcome.tsx` / `app/onboarding/goals.tsx`: Realigned so that the first screen is "Where would you like to start?" with clear starting points.
- `app/onboarding/results.tsx`: Updated footer actions to offer "Set up kitchen & meal prep" (primary) and "Head straight to the app" (secondary).
- `app/onboarding/first-plan.tsx`: Updated completion actions to offer "Set up calorie target" (primary) and "Head straight to the app" (secondary).
- `src/store/onboardingStore.ts`: Fix `ONBOARDING_ENTRY_ROUTES` and dynamic step resolution (`getOnboardingSteps`, `stepIndex`).
- Unit and navigation tests in `test/` updated and verified.

## Non-goals

- Removing calorie tracking or meal prep from the app.
- Forcing users to complete both setups before entering the app.
- Creating a cloud sync or account system (Mise remains strictly local-first).
