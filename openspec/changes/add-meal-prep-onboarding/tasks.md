## 1. Establish the contracts and migration

- [x] 1.1 Inspect the current bootstrap and onboarding completion guards; write a focused test matrix for calorie-only, meal-prep-only, combined, and skipped flows.
- [x] 1.2 Define controlled `OnboardingIntent` and `ApplianceId` types, plus `MealPrepPlan`, local template, and cooking-guide contracts with unit tests.
- [x] 1.3 Add a forward-only migration for local cooking preferences and owned appliances, with migration and repository tests.
- [x] 1.4 Implement local repositories for cooking preferences and appliances, including controlled-ID validation and editable states.
- [x] 1.5 Decide and document how optional dietary preferences work without a calorie `Profile`; do not create placeholder body data.

## 2. Build deterministic first-plan logic

- [x] 2.1 Create a small local starter template catalogue with declared ingredient, appliance, portion, duration, and guide-step requirements.
- [x] 2.2 Implement strict plan eligibility and matching tests for confirmed pantry items, missing items, no-appliance choices, and dietary filters.
- [x] 2.3 Implement plan construction that never invents quantities, appliance ownership, or pantry presence.
- [x] 2.4 Add tests proving the new meal-prep plan contract does not change existing cached dinner `Suggestion` behaviour.

## 3. Add conditional onboarding state and routes

- [x] 3.1 Extend the onboarding draft with independent intents and dynamic route/progress resolution, covered by route tests.
- [x] 3.2 Add the two-card goal-selection screen with accessible selected and unselected states; preserve the existing calorie-only sequence.
- [x] 3.3 Refactor completion routing so meal-prep-only onboarding can enter the app without a nutrition `Profile`, while calorie profiles persist through the existing valid path.
- [x] 3.4 Add the appliance-selection route, including no-appliance and skip states, then persist confirmed choices locally.
- [x] 3.5 Add the starter-pantry route with finite common options and explicit links into existing manual and capture intake routes.
- [x] 3.6 Add a review-and-confirm boundary before starter-pantry draft entries call the existing pantry persistence contract.

## 4. Deliver the first prep result

- [x] 4.1 Add the first-plan route with title, portions, known duration, confirmed ingredients, missing ingredients, and required appliance disclosure.
- [x] 4.2 Render accessible ordered cooking-guide steps that name each appliance or no-cook action.
- [x] 4.3 Connect start, choose-another-idea, defer, and exit actions without silently logging a meal or mutating pantry inventory.
- [x] 4.4 Add a deliberate handoff from a completed cooking guide to the existing recipe review/logging flow.

## 5. Make the setup resumable and usable

- [x] 5.1 Add Pantry and Settings entry points to resume deferred setup and edit appliance ownership.
- [x] 5.2 Apply the active design tokens and basic vector/system visuals; do not introduce generated food assets in this change.
- [x] 5.3 Verify large text, screen-reader labels, focus states, colour-independent selection, and minimum touch targets across every new route.

## 6. Verify and document

- [x] 6.1 Run focused unit, migration, repository, and onboarding route tests; record exact commands and results.
- [x] 6.2 Run the repository typecheck and lint commands required by the current workspace, resolving regressions in affected surfaces.
- [x] 6.3 Perform native-device or simulator walkthroughs for the four intent states and screenshot the implemented flow.
- [x] 6.4 Update relevant product and onboarding documentation with final route, persistence, and no-inference behaviour.
- [x] 6.5 Run `openspec validate add-meal-prep-onboarding --strict` after any proposal updates.
