## Why

The app already holds every day the user has ever logged. It just will not show
them.

`src/components/DateStrip.tsx` renders `weekOf(selectedDate)` — exactly seven
days, the week containing whatever is selected. There is no control that moves
to another week. `dayStore.setDate` accepts any date, and nothing in the
interface can produce one outside the current seven.

Meanwhile `getLoggedDates()` is `SELECT DISTINCT local_date FROM meals` with no
bound, loaded into the store on every refresh. The dots for every day the user
has ever logged are already in memory, and six of seven are unreachable.

That is the complaint: the app is stiff, you can see this week, and last week
does not exist. It is not a missing feature so much as a missing door to data
the user created and the app is already holding.

## What Changes

- **A month calendar**, reachable from the day header, scrolling back through
  history and stopping at the first day ever logged.
- **Each day shows whether anything was logged**, and where it landed against
  the target that was active *then*.
- **Tapping a day goes there** — the same day view that exists now.
- **The week strip pages.** Swiping past the edge moves a week at a time, so
  short hops need no calendar.
- **A day with no entries reads as no entries**, never as a day of zero
  calories. The app cannot tell "did not eat" from "did not log".
- **Returning to today restores following**, so the header goes back to
  tracking the real date.

## Capabilities

### New Capabilities

- `history-calendar`: Reaching any previously logged day. Covers the month
  view and its bounds, the per-day summary and which target it is judged
  against, paging the week strip, the distinction between an empty day and an
  unlogged one, and returning to today.

### Modified Capabilities

- `day-selection`: the selected date can now be any date at or before today,
  rather than one of the seven in the current week.

## Non-goals

- **Charts, trends, streaks, or insights.** A calendar answers "what did I eat
  on the 14th". Weekly averages and streak counters are a different feature
  with a different failure mode — they make claims about progress, and
  decisions 108, 142 and 170 all exist because this app does not do that.
- **Editing history from the calendar.** Tapping a day opens the day. Whatever
  is possible there is unchanged.
- **A year view or a heatmap.** Twelve months of coloured squares is a trend
  display wearing a calendar's clothes, and the honest version of it needs the
  numbers to mean more than they do.
- **Backfilling or estimating unlogged days.** An empty day stays empty.
- **Changing what a day view shows.** This change adds a way to reach days, not
  a new way to read them.
- **Search.** "When did I last eat laksa" is a good question and a different
  query.

## Impact

**Schema.** None. Every figure this needs is already stored — `meals`,
`meal_items`, and the per-day `daily_targets` rows `ensureDailyTarget` already
writes.

**Code.**
- `src/logic/dates.ts` — month helpers. It currently has `weekOf` and nothing
  wider.
- `src/db/queries.ts` — one grouped summary query over a date range.
- `src/store/dayStore.ts` — month summaries, and `loggedDates` as a set.
- `src/components/DateStrip.tsx` — paging.
- A calendar surface.

**Dependencies.** None added. No calendar library — the grid is a month of
`localDateString`s and the app already owns its date conventions.

**Depends on** `fix-day-selection` (merged), whose `following` flag and
day-boundary conventions this must not break.

## A past day is judged against the target it had, not the one you have now

`ensureDailyTarget` snapshots: it writes a `daily_targets` row per day and
returns the existing one if there is one. That is deliberate, and it is what
makes history meaningful — someone who cuts their target by 400 calories today
has not retroactively failed every day last month.

So the calendar reads the stored target per day. Recomputing from the current
profile would be easy, would look right in every test written on one day, and
would quietly rewrite the user's own history every time they changed a goal.

This matters more once `add-energy-sources` lands, since a target can then come
from a scan or a stated figure and can change for reasons that have nothing to
do with the day being displayed.

## An empty day is not a zero day

A day with no meals means the user did not log. It does not mean they did not
eat, and the app has no way to tell the difference.

So an unlogged day shows as unlogged. It is not drawn as 0 kcal, not counted as
a day under target, and not styled as an achievement. This is the same
discipline as decision 120 on unknown fibre and decision 140 on a storage term
that is not a duration: absence is not zero, and rendering it as zero invents a
fact.

It also matters for what this feature is *for*. Someone scrolling back through a
month wants to find the day they ate the thing they are trying to remember. A
grid that scores them on adherence is answering a question they did not ask.
