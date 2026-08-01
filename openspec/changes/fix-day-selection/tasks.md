## 1. Reproduce it first

Do not skip this. The bug shipped because it is invisible in development, and a
fix verified only in Expo Go proves nothing.

- [ ] 1.1 Write a failing test that constructs the store with one date as
      "today", advances the clock to a later date, and asserts the shown day is
      still the old one. `localDateString(date)` already takes an injectable
      date, so no waiting and no fake timers library are needed.
- [ ] 1.2 Write a second failing test: with the store showing an earlier day,
      save a meal, and assert the shown day does not move to the meal's day and
      the meal is absent from the visible list. This is the path that needs no
      stale state and is the likelier cause of the report.
- [ ] 1.3 Confirm both fail against current `main` before changing anything.

## 2. Selection mode

- [ ] 2.1 Add `following: boolean` to `dayStore`, initialised `true`.
- [ ] 2.2 Add `syncToToday()`: when `following` is true and `selectedDate` is not
      today, set it to `localDateString()` and refresh. No-op otherwise, so
      overlapping focus and foreground triggers cost nothing.
- [ ] 2.3 Make `selectDate()` set `following: false` — a tap is a deliberate
      pick and must survive re-sync.
- [ ] 2.4 Add `resumeFollowing()` setting `following: true`, for the screen to
      call when it loses focus.
- [ ] 2.5 Keep the module-level `selectedDate: localDateString()` as a seed. It
      is now always overwritten before display, and removing it would leave an
      undefined day on first render.

## 3. Lifecycle wiring

- [ ] 3.1 Call `syncToToday()` from the existing `useFocusEffect` in
      `app/(tabs)/index.tsx`, before or in place of the bare `refresh()`.
- [ ] 3.2 Call `resumeFollowing()` in that effect's cleanup, so leaving the tab
      restores tracking.
- [ ] 3.3 Subscribe to `AppState` and call `syncToToday()` when the app becomes
      active, covering the app sitting open on this tab across midnight.
- [ ] 3.4 Remove the subscription on unmount.

## 4. Saving lands where the user is looking

- [ ] 4.1 Replace the mismatch branch in `dayStore.addMeal` — currently updating
      only `loggedDates` — with setting `selectedDate` to `stored.localDate`,
      setting `following: true`, and refreshing.
- [ ] 4.2 Confirm the meal is still filed under the current day, not the day
      being viewed. `app/review.tsx:189` computes this correctly and must not
      change.
- [ ] 4.3 Verify the day's totals and macro bars include the new meal
      immediately.

## 5. Honest confirmation

- [ ] 5.1 Order the review screen's success path so the "Meal saved" toast
      appears only after the resulting day is on screen.
- [ ] 5.2 Check the same ordering for the manual-entry path in `app/manual.tsx`.
- [ ] 5.3 Confirm no path can show a save confirmation over a list that does not
      contain the meal.

## 6. Verification

- [ ] 6.1 Both tests from group 1 now pass.
- [ ] 6.2 Select an earlier day, log a meal, and confirm the view moves to today
      with the meal visible.
- [ ] 6.3 Select an earlier day, scroll and interact, and confirm the selection
      does not move on its own.
- [ ] 6.4 Select an earlier day, switch to Pantry, switch back, and confirm the
      screen shows today.
- [ ] 6.5 Confirm the week strip follows a corrected day and that future days
      stay non-selectable.
- [ ] 6.6 **Test on a standalone APK, not Expo Go.** Background the app,
      change the device date forward a day, reopen, and confirm the screen shows
      the new day. Expo Go's reload cycle masks this — it is why the bug shipped.
- [ ] 6.7 Run `npm run typecheck` and `npm test`, then record the outcome in
      `docs/product-decisions.md`.
