## Context

See `proposal.md` — Why, for the diagnosis and the evidence.

The two relevant lines:

```ts
// src/store/dayStore.ts:43 — runs once, when the module is first evaluated
selectedDate: localDateString(),

// app/review.tsx:189 — runs at save time, correctly
const localDate = localDateString();
```

And the handling that turns a mismatch into silence:

```ts
// src/store/dayStore.ts:79
if (stored.localDate === get().selectedDate) {
  await get().refresh();
} else {
  set({ loggedDates: await getLoggedDates() });   // dots move, list does not
}
```

`src/logic/dates.ts` already takes an injectable `date` on every function, which
is what makes this testable without waiting for midnight.

## Goals / Non-Goals

**Goals:**

- The day on screen is always either today or a day the user deliberately chose.
- A meal you just logged is always visible after logging it.
- The failure is reachable in a test, so it cannot come back quietly.

**Non-Goals:**

- Back-dating meals to the viewed day. See the proposal's non-goals.
- Persisting selection across launches.
- Any change to the day-boundary rule.

## Decisions

### Selection has a mode, not just a value

`dayStore` gains `following: boolean` beside `selectedDate`. `true` means "track
today"; a user tap sets it `false`.

*Why:* the two requirements pull against each other — always open on today, but
never yank someone out of a day they chose. A single date field cannot express
the difference between "27 July because that is today" and "27 July because I
asked". Making the mode explicit is what lets both hold.

*Alternative considered:* comparing `selectedDate` to today and snapping when
they differ. Rejected — it makes deliberate history browsing impossible to
distinguish from staleness, which is exactly the ambiguity that caused this.

### `syncToToday()` is called by lifecycle, not computed on read

An explicit action that, when `following` is true, sets `selectedDate` to
`localDateString()` and refreshes. Called on Today-tab focus and on the app
returning to the foreground.

*Why:* a getter that derives the date on every read would be correct and would
also re-render constantly and fight the existing `refresh()` flow. An explicit
call at the two moments the answer can have changed is cheaper and easier to
reason about.

*Why both triggers:* tab focus alone misses the case where the app sits open on
the Today tab across midnight. Foreground alone misses nothing in practice but
costs nothing to add, and the two together mean the stale value has no window to
be observed in.

### Leaving the screen restores following

Navigating away from the Today tab sets `following` back to `true`.

*Why:* it gives the rule a plain statement — *the Today tab opens on today* —
with the exception scoped to one continuous visit. The alternative, keeping a
chosen day until explicitly cleared, means a user who glanced at last Tuesday
finds the app still on last Tuesday hours later, which is the original bug
wearing a different hat.

### `addMeal` selects the saved meal's date

The mismatch branch stops being a silent dot update and becomes a selection
change:

```ts
const stored = await insertMeal(meal);
set({ selectedDate: stored.localDate, following: true });
await get().refresh();
return stored;
```

*Why:* the existing branch treats "the user is not looking at where this went"
as an acceptable resting state. It is not — the user pressed Save and must see
the result. Setting `following: true` alongside is deliberate: the meal is filed
under today, so after logging, the user is on today and tracking it again.

*Note:* this makes the mismatch branch unreachable in the common flow rather
than merely handled, which is the stronger fix.

### Confirmation is emitted after the resulting state is on screen

The review screen's success path already routes back with `savedMealId`. The
toast moves behind the resulting refresh rather than firing alongside the
navigation.

*Why:* the spec forbids reporting a save that the screen contradicts. The
current ordering is what produced "Meal saved." over "Nothing logged yet", and
that ordering is the defect regardless of the date logic sitting under it.

### The regression test drives the clock, not the calendar

`localDateString(date)` accepts a date, so the test can construct the store's
view of "today" rather than wait for one.

*Why:* the reason this shipped is that no test could express "a day passes".
Every existing suite is same-instant. A test that simulates a date change and
asserts the shown day advances is the only thing that stops this recurring, and
it is cheap because `dates.ts` was already written to allow it.

*What it must assert, at minimum:* that a store initialised on one date shows a
later date once synced, and that a meal saved while viewing an earlier day
leaves the shown day equal to the meal's day.

## Risks / Trade-offs

**Re-sync surprises a user mid-read** → someone studying last Tuesday could be
moved to today by a foreground event. Mitigation: `following` is false the
moment they tap a day, and foreground re-sync respects it. The only reset is
leaving the screen, which is a deliberate act.

**Focus and foreground both fire on some transitions** → a double refresh.
Harmless but wasteful; `syncToToday` should no-op when the date already matches.

**The fix hides the underlying staleness rather than removing it** → the
module-load initialiser still runs once with a value that can age. Mitigation:
it is now only ever a seed, overwritten before display. Removing the initialiser
entirely would mean an undefined state on first render, which is worse.

**Expo Go will not reproduce the original bug** → anyone verifying in
development may conclude it is fixed without having tested the fix, because the
reload cycle hid it in the first place. The verification tasks call for a
standalone APK explicitly, and the automated test exists so the check is not
purely manual.

## Migration Plan

No schema change and no data migration. Existing meals are correctly filed
already — the four in the bug report are on 31 July where they belong.

Rollback is a straight revert; behaviour returns to the current state.

## Open Questions

None. The behaviour is fully specified by the requirements above.
