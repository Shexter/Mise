## 1. Draft Model and Validation

- [x] 1.1 Define the editable meal/item draft types and conversion from a stored `MealWithItems`, preserving immutable metadata and existing item identities.
- [x] 1.2 Implement pure draft normalization, dirty-state comparison, venue/servings normalization, and validation for names, item count, quantities, and nutrients.
- [x] 1.3 Add unit tests for valid zero nutrients, invalid numeric input, non-home servings, unchanged drafts, changed drafts, item ordering, and immutable-field preservation.

## 2. Transactional Persistence

- [x] 2.1 Add query-layer edit input types and a meal-existence check in `src/db/queries.ts` without adding or changing schema.
- [x] 2.2 Refactor the existing depletion reversal/application internals so they can participate in a caller-owned SQLite transaction while preserving delete, undo, clamp, and drift behavior.
- [x] 2.3 Implement one exclusive transaction that reverses recorded depletion, updates editable meal columns, replaces the ordered item set, applies corrected depletion, and writes replacement consumption events.
- [x] 2.4 Short-circuit a normalized no-op edit so it does not rewrite rows, add events, or change drift.

## 3. Persistence and Depletion Tests

- [x] 3.1 Test successful metadata and item edits, including added, removed, reordered, and retained item ids and preserved meal provenance.
- [x] 3.2 Test home quantity and servings corrections restore the old applied depletion and leave only the corrected effect.
- [x] 3.3 Test home-to-out, out-to-home, and any-to-leftovers venue changes produce the specified pantry effect and normalize non-home servings to one.
- [x] 3.4 Inject failures at meal, item, pantry, and event stages and verify the old meal, items, pantry values, drift counters, and events all survive unchanged.
- [x] 3.5 Re-run and preserve all existing add, delete, undo, depletion reversal, clamp, drift, and export tests.

## 4. Store Coordination

- [x] 4.1 Add `updateMeal` to `src/store/dayStore.ts` to plan corrected depletion, invoke the atomic query, refresh the selected date, and expose save errors without discarding the draft.
- [x] 4.2 Invalidate or refresh dinner/macro suggestion state using the same meal/pantry-change policy as a newly logged meal.
- [x] 4.3 Add store tests proving corrected daily totals/macros appear immediately, a selected past date remains selected, and failed saves leave visible state unchanged.

## 5. Meal Editor UI

- [x] 5.1 Add `app/meal/[id].tsx` to load the authoritative meal, show loading/not-found states, and populate a local draft.
- [x] 5.2 Build the keyboard-aware, scrollable meal form for name, meal type, venue, home servings, calculated totals, and pinned Save/Cancel controls using existing components and theme tokens.
- [x] 5.3 Build item add/edit/remove UI for name, quantity, unit, calories, macros, and catalogue identity while preserving unknown versus entered-zero values supported by the model.
- [x] 5.4 Add dirty-back-navigation protection and discard confirmation, ensuring Cancel never writes meal or pantry state.
- [x] 5.5 Show save errors without leaving the editor; after success, return only after the selected day has refreshed and then show confirmation.

## 6. Today Navigation and Accessibility

- [x] 6.1 Replace the no-op Today meal-row callback with navigation to `/meal/[id]`.
- [x] 6.2 Update `MealRow` accessibility text so activation communicates editing and the independent swipe gesture communicates deletion.
- [x] 6.3 Add component/navigation tests for tapping a row, opening the correct id, missing-meal handling, and retaining swipe-to-delete behavior.

## 7. Automated Verification

- [x] 7.1 Run `npm run typecheck` and correct every new strict-TypeScript error.
- [x] 7.2 Run the full `npm test` suite and confirm all existing and new tests pass without a network connection or API key.
- [x] 7.3 Run `git diff --check` and `openspec validate edit-logged-meals --strict`.

## 8. Owner Device Acceptance

- [ ] 8.1 In Expo Go, tap a manual and a photographed meal under Today’s meals and confirm the correct populated editor opens.
- [ ] 8.2 With the keyboard open, edit fields near the bottom and confirm the screen scrolls, Save remains reachable, and no control is obscured.
- [ ] 8.3 Correct calories and macros, save, and confirm the row, calorie balance, and macro bars visibly update before the success message.
- [ ] 8.4 Change a home meal to Ate out and back to Cooked in, then confirm pantry state reverses and reapplies correctly without duplicate depletion.
- [ ] 8.5 Edit a meal on a deliberately selected past day and confirm Save returns to that same day with the corrected record.
- [ ] 8.6 Make a draft change, cancel/back out, and confirm the discard prompt appears and declining it keeps the draft while discarding it leaves stored totals and pantry unchanged.
