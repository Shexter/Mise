## Why

Reported from the first standalone APK: **"adding meals doesn't work at all."**

Meals were saving perfectly. Four of them, on 31 July at 23:25–23:27. The Today
screen was showing 27 July, so the list read "Nothing logged yet" while a toast
said "Meal saved." The user reasonably concluded the feature was broken.

The screenshots contain the whole diagnosis. The header read **"Monday 27
July"** — `friendlyDate` returns the literal date rather than "Today" precisely
when the selected day is not today. A green dot sat under **31**, and in
`DateStrip` a dot means `loggedDates.includes(date)`, so the app was already
saying the meals existed, one column to the right of where the user was looking.
1 and 2 August were greyed as future, which puts the real today at 31 July.

This is not a migration problem. `src/store/dayStore.ts` has one commit — the
initial import — so the code is unchanged from SnapCal. It is also not a
standalone-versus-Expo-Go problem in the way it looks, though the packaging is
why it surfaced now (see below).

## What Changes

Two independent paths produce this symptom, and both need closing.

**1. `selectedDate` is fixed at module-evaluation time and never advances.**
`dayStore.ts:43` reads `selectedDate: localDateString()`, which runs once when
the store module is first evaluated. Nothing moves it afterwards — `refresh()`
re-queries using whatever `selectedDate` already holds.

In Expo Go this is nearly invisible, because a reload re-evaluates the module
and the value is always fresh. That is very likely why it shipped. In a
standalone build Android keeps the JS context alive across days, so the value
can be stale by an arbitrary number of days, and it is stale by one day for
anyone who leaves the app open across midnight.

**2. A meal saved while viewing another day disappears without explanation.**
`app/review.tsx:189` computes `localDateString()` fresh at save time — correctly,
because a meal is eaten now. `dayStore.addMeal` then compares that to the
selected date and, when they differ, deliberately skips the refresh and updates
only the dots:

```ts
if (stored.localDate === get().selectedDate) {
  await get().refresh();
} else {
  set({ loggedDates: await getLoggedDates() });
}
```

The mismatch was anticipated and handled by showing the user nothing. Anyone
scrubbing back through the week and then logging a meal hits this, with no
stale-state required.

**Which one caused this particular report cannot be established from the
screenshots**, and it does not matter — the fixes are complementary and both
conditions are real.

The changes:

- **The selected day follows today by default**, and re-syncs when the app
  returns to the foreground or the Today tab regains focus. Scrubbing within a
  session still sticks, so reviewing history is unaffected.
- **Saving a meal moves the view to the day the meal landed on.** The user
  always ends up looking at what they just created.
- **Confirmation text matches the visible outcome.** "Meal saved" while the list
  stays empty is the actual failure here; correctness of the write is beside the
  point if the interface contradicts it.
- **A clock-controlled regression test**, since no existing test can catch a bug
  whose trigger is the passage of time.

## Capabilities

### New Capabilities

- `day-selection`: Which day the Today screen shows, how that follows the real
  date, and where the user lands after logging a meal.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Changing where a meal is filed.** A meal is eaten now and belongs to today.
  Back-dating a log to the day being viewed would be a different feature and a
  worse default.
- **Persisting the selected day across launches.** A cold start should show
  today. Restoring a stale selection would reintroduce the bug through a
  different door.
- **Reworking `DateStrip` or the week model.** The strip is correct; it was
  drawing the wrong week because it derives from `selectedDate`.
- **Time-zone or travel handling.** The day boundary stays device-local
  midnight, as `dates.ts` already documents.

## Impact

**Schema.** None.

**Code.**
- `src/store/dayStore.ts` — the fix's centre. Selection gains a follow-today
  mode, and `addMeal` stops silently diverging from the view.
- `app/(tabs)/index.tsx` — re-sync on focus, and app-state handling for
  foreground returns.
- `app/review.tsx` — confirmation wording tied to the resulting view.
- `src/logic/dates.ts` — likely unchanged, but every function here takes an
  injectable `date` already, which is what makes the regression test possible.

**Dependencies.** None added.

**Risk.** Low, and mostly about surprise: an over-eager re-sync could yank a user
out of a day they are deliberately reading. The spec draws that line explicitly —
follow today until the user picks a day, then respect the pick for as long as
they stay on the screen.
