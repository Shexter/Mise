## 1. Store and Route Progression

- [x] 1.1 Fix `ONBOARDING_ENTRY_ROUTES` in `src/store/onboardingStore.ts` so `estimated` points to `/onboarding/sex` rather than self-referencing `/onboarding/goals`.
- [x] 1.2 Update `getOnboardingSteps` and `stepIndex` in `src/store/onboardingStore.ts` to support starting from either Calorie Target or Kitchen & Meal Prep without broken tick counts.

## 2. Starting Point Screen UI

- [x] 2.1 Refactor `app/onboarding/welcome.tsx` into the "Where would you like to start?" choice screen with two primary cards: Daily Calorie & Macro Target and Kitchen & Meal Prep.
- [x] 2.2 Include the DEXA/InBody and known figure secondary options under the calorie option.
- [x] 2.3 Ensure tapping Kitchen & Meal Prep navigates to `/onboarding/dietary` with proper state tracking.

## 3. Post-Milestone Handoffs and App Entry

- [x] 3.1 Update `app/onboarding/results.tsx` footer to offer "Set up kitchen & meal prep" (primary) and "Head straight to the app" (secondary).
- [x] 3.2 Update `app/onboarding/first-plan.tsx` footer to offer "Set up daily calorie target" (primary) and "Head straight to the app" (secondary).
- [x] 3.3 Ensure "Head straight to the app" correctly saves completed state, resets draft, and navigates to `/(tabs)`.

## 4. Testing and Verification

- [x] 4.1 Update and run unit tests in `test/regular-onboarding.test.ts`, `test/onboarding-intake-ui.test.ts`, and `test/meal-prep-onboarding-routes.test.ts`.
- [x] 4.2 Verify interactive navigation in the Pixel 10a emulator for both Calorie-first and Kitchen-first flows end-to-end.
