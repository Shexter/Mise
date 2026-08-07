## Context

See `proposal.md` — Why, why a past day keeps its own target, and why an empty
day is not a zero day.

What ships today:

- `src/components/DateStrip.tsx` renders `weekOf(selectedDate)` and nothing
  else. Seven cells, no paging control anywhere.
- `src/logic/dates.ts` has `weekOf` and no wider helper.
- `dayStore.setDate(localDate)` accepts any date and sets `following: false`.
  The store is already capable of everything this change needs; only the
  interface is bounded.
- `getLoggedDates()` is `SELECT DISTINCT local_date FROM meals` — unbounded,
  refreshed on every `refresh()`, already in memory.
- `ensureDailyTarget` writes a `daily_targets` row per day and returns the
  existing one if present.
- `DateStrip` tests membership with `loggedDates.includes(date)`.

## Goals / Non-Goals

**Goals:**

- Any logged day is two taps away.
- No new stored data, because none is needed.
- History reads as history, not as a scorecard.

**Non-Goals:**

- Charts, trends, streaks, editing from the calendar, a year heatmap,
  backfilling, changing the day view, search. See the proposal.

## Decisions

### No schema change, and that is the interesting part

Everything is already stored. `meals` and `meal_items` hold the content,
`daily_targets` holds the per-day target, and `getLoggedDates()` already returns
every date the user has ever logged.

*Why this is worth stating:* it reframes the work. This is not a history
feature to be built; it is a view onto history the app has been keeping since
the first release and has never shown. The risk profile is completely different
— nothing to migrate, nothing to backfill, and no way to lose data by getting it
wrong.

*The one thing missing:* a per-day *summary*. `getMealsForDate` reads one day in
full, which is far too much for a grid of 35 cells. That is a new query, not new
data.

### One grouped query per displayed range

`getDaySummaries(from, to)` — one row per day with entries, joined against
`daily_targets`.

*Why not per day:* a month is 28-31 days, and a grid usually shows 35-42 cells
including the spill from adjacent months. Calling `getMealsForDate` per cell is
forty queries and forty full meal reads to render some dots.

*Why grouped rather than reading all meals and summing in JS:* the totals are a
`SUM` over `meal_items.calories`, which SQLite does in one pass. Pulling every
meal of a month into memory to add up four numbers per day is the kind of thing
that is fine at 40 days and unpleasant at 400.

*What a row contains:* the date, the calorie total, and the target that was
recorded for that day. Days with no entries produce no row — see below.

### A day is judged against its own recorded target

Read `daily_targets`, do not recompute.

*Why:* `ensureDailyTarget` snapshots deliberately. Recomputing from the current
profile would be easy, would pass every test written on a single day, and would
silently rewrite the user's history each time they changed a goal — someone who
lowers their target today has not retroactively failed last month.

*Why this gets more important soon:* `add-energy-sources` makes the target
come from a scan, a stated figure, or the profile, and changeable for reasons
unrelated to any particular day. A calendar recomputing from "the current
profile" would then be wrong in more ways and more often.

*The honest edge:* a day with meals but no `daily_targets` row shows its total
with no comparison. Absent is absent.

### Absent days produce no row, and the grid renders that as absent

The query returns rows only for days with entries. The grid treats a missing
date as *no entries*, never as a zero total.

*Why it has to be structural:* a `LEFT JOIN` producing `0` for empty days would
be the easy shape, and it would put a zero in front of the user for every day
they did not open the app. That reads as "you ate nothing", which is a claim the
app cannot support. It also makes an empty day look like an extraordinary
success against a calorie target, which is worse than meaningless.

Same discipline as decision 120 on unknown fibre and decision 140 on a storage
term that is not a duration.

### `loggedDates` becomes a set

`DateStrip` currently does `loggedDates.includes(date)` — a linear scan per
cell. Seven cells against a few hundred dates is nothing; a month grid is 42
cells, and the calendar will do it for every visible month.

*Why change it now rather than when it hurts:* it is a one-line change at the
store boundary, the array is already being built, and the alternative is the
kind of quiet quadratic that is invisible until someone has logged for two
years. The store keeps its array for anything that needs order; the membership
test gets a `Set`.

### The strip pages; the calendar jumps

Two controls, two jobs.

*Why both:* "yesterday" and "last Tuesday" are the common cases and want a
swipe, not a modal. "The 14th of March" wants a calendar. Building only the
calendar makes the common case worse than it is now, and building only paging
leaves the user swiping thirty times to reach last month.

*Why the strip keeps its existing behaviour otherwise:* `fix-day-selection`
shipped 24 tasks establishing how the strip, the store, and the day boundary
interact. This change adds a way to move the window and touches nothing else.

### `following` must survive all of it

`dayStore` sets `following: false` on `setDate` and back to `true` on returning
to today. That flag is what makes the header advance at midnight.

*Why it is called out:* it is exactly the class of bug `fix-day-selection`
existed to fix — a date shown that has quietly stopped tracking reality. A new
navigation surface that sets dates without maintaining the flag would reintroduce
it, and the symptom (the app showing yesterday after midnight) is one nobody
notices until they log a meal against the wrong day.

## Risks / Trade-offs

**A calendar invites a heatmap** → coloured squares over twelve months is a
trend display, and it makes claims about adherence the app has consistently
refused to make. Named as a non-goal so it is a later decision rather than a
drift.

**Rendering a month is more work than a week** → mitigated by the grouped query
and the set lookup, both of which are cheap and both of which are in this
change rather than deferred.

**A long history makes `getLoggedDates` grow** → unbounded today, and it is
loaded on every refresh. Five years of daily logging is under 2,000 short
strings, so this is not urgent; the set fix removes the part that would actually
have degraded.

**The empty-day rule is easy to get wrong later** → a `LEFT JOIN … COALESCE(…,
0)` looks like a tidy improvement and would break it silently. Worth a test that
asserts an unlogged day is distinguishable from a zero one, rather than trusting
the comment.

## Migration Plan

None. No schema change, no new stored data, no backfill. If this change grows a
migration, something has been misunderstood.

## Open Questions

- **Whether the month grid should show calories per day or only a marker.** A
  number is more useful and more cluttered, and at 42 cells it may be noise.
  Answerable by looking at it, not by argument.
- **Whether the strip should page by week or scroll continuously.** Continuous
  is nicer and interacts with `weekOf`'s week-boundary assumption in ways paging
  does not.
- **How far back the calendar should allow scrolling when the user has logged
  only a handful of days.** Bounded at the first entry per the spec, but a user
  three days in gets a very short calendar, which may want a different empty
  state rather than a bound.
