## 1. Date helpers

Pure. No database, no network. All of section 1 is testable before any screen
exists.

- [ ] 1.1 Add `monthOf(localDate)` to `src/logic/dates.ts`, returning the grid
      of dates for that month including the leading and trailing days that fill
      the first and last weeks.
- [ ] 1.2 Add `addMonths(localDate, n)` and `monthLabel(localDate)`.
- [ ] 1.3 Add `addWeeks(localDate, n)` for the strip's paging.
- [ ] 1.4 Keep the existing local-date convention — `yyyy-MM-dd` strings through
      `localDateString`, never `Date` objects across a boundary. `dates.ts` owns
      the day boundary and `fix-day-selection` spent 24 tasks establishing it.
- [ ] 1.5 Unit-test month boundaries, a month starting on a Sunday, a month
      starting on a Monday, February in a leap year, and a grid that spills into
      both adjacent months.

## 2. The summary query

- [ ] 2.1 Add `getDaySummaries(from, to)` to `src/db/queries.ts`: one row per day
      **that has entries**, with the calorie total and the target recorded for
      that day.
- [ ] 2.2 **One query for the whole range.** Not one per day — a month grid is
      35-42 cells, and `getMealsForDate` per cell is forty queries and forty full
      meal reads to render some dots.
- [ ] 2.3 Sum in SQL rather than pulling every meal of a month into memory to add
      up four numbers per day.
- [ ] 2.4 Join `daily_targets` for the target **as recorded**. Do not recompute
      from the current profile — `ensureDailyTarget` snapshots deliberately, and
      recomputing would rewrite the user's history every time they changed a
      goal.
- [ ] 2.5 **Return no row for a day with no entries.** Do not `LEFT JOIN` and
      coalesce to zero. That shape is tidier and puts a zero in front of the user
      for every day they did not open the app, which reads as "you ate nothing"
      — a claim the app cannot support, and one that makes an empty day look like
      an extraordinary success against a calorie target.
- [ ] 2.6 Return the total without a comparison where a day has entries but no
      recorded target.
- [ ] 2.7 Test: a month with gaps, a fully logged month, an empty month, and a
      day whose recorded target differs from the current one.
- [ ] 2.8 **Test that an unlogged day is distinguishable from a zero-calorie
      one.** This is the rule most likely to be "tidied" away later by a
      well-meaning coalesce.

## 3. Store

- [ ] 3.1 Add month summaries to `dayStore`, keyed by month so moving back and
      forth does not refetch.
- [ ] 3.2 Expose `loggedDates` membership as a `Set`. `DateStrip` currently does
      `loggedDates.includes(date)` — a linear scan per cell, fine at seven and
      not at forty-two per visible month.
- [ ] 3.3 Keep the array for anything that needs order; only the membership test
      changes.
- [ ] 3.4 Add the earliest logged date, for bounding the calendar.
- [ ] 3.5 **Preserve `following`.** `setDate` clears it, returning to today
      restores it. Any new navigation path must go through the same store
      actions rather than setting dates directly — this is exactly the bug class
      `fix-day-selection` existed to fix, and its symptom (the app showing
      yesterday after midnight) is one nobody notices until they log a meal
      against the wrong day.
- [ ] 3.6 Test that navigating via the calendar and returning to today leaves
      `following` true.

## 4. The calendar surface

- [ ] 4.1 Build the month view, reachable from the day header.
- [ ] 4.2 Mark days with entries distinguishably from days without.
- [ ] 4.3 Mark today.
- [ ] 4.4 Disable future days, matching `DateStrip`'s existing `isFuture`
      behaviour.
- [ ] 4.5 **Bound scrolling at the earliest logged day.** No infinite scroll into
      empty years.
- [ ] 4.6 Selecting a day navigates to it and closes the calendar.
- [ ] 4.7 **Show no total for an unlogged day**, and do not mark it as under or
      over target. Absent is absent.
- [ ] 4.8 Give a user with no entries at all an empty state rather than an empty
      grid.
- [ ] 4.9 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.
- [ ] 4.10 **No library.** The grid is a month of `localDateString`s and the app
      already owns its date conventions; a calendar dependency would bring its
      own.

## 5. Paging the strip

- [ ] 5.1 Let `DateStrip` move to the previous and following weeks.
- [ ] 5.2 Do not page beyond the week containing today.
- [ ] 5.3 Keep selection behaviour otherwise identical — `fix-day-selection`
      established how the strip, the store, and the day boundary interact, and
      this adds a way to move the window and nothing else.
- [ ] 5.4 Keep a way back to today visible whenever the strip is not on today's
      week.

## 6. Scope discipline

- [ ] 6.1 **No charts, trends, streaks, or averages.** A calendar answers "what
      did I eat on the 14th". Adherence scoring is a different feature that makes
      claims about progress, which decisions 108, 142 and 170 all exist to
      refuse.
- [ ] 6.2 No year heatmap. Twelve months of coloured squares is a trend display
      wearing a calendar's clothes.
- [ ] 6.3 No editing from the calendar. Tapping a day opens the day; whatever is
      possible there is unchanged.
- [ ] 6.4 **No migration.** If this change grows one, something has been
      misunderstood — every figure it needs is already stored.

## 7. Verification

- [ ] 7.1 Log meals on several days across two months, then reach each from the
      calendar.
- [ ] 7.2 Confirm a day from last week is reachable by paging the strip alone.
- [ ] 7.3 Confirm an unlogged day shows as unlogged, not as 0 kcal, and is not
      marked against a target.
- [ ] 7.4 Change the calorie target, then confirm previously logged days are
      summarised exactly as before.
- [ ] 7.5 Confirm the calendar does not scroll earlier than the first logged day.
- [ ] 7.6 Confirm future days are unselectable in both the calendar and the
      strip.
- [ ] 7.7 Navigate to a past day, return to today, cross midnight, and confirm
      the header advances — `following` survived.
- [ ] 7.8 Confirm one query per displayed month, not one per day.
- [ ] 7.9 Run `npm run typecheck` and `npm test`.
