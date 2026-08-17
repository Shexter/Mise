## Context

See `proposal.md` — Why. `dailyNutritionSummary(date, meals, target)` in
`src/logic/dailyNutritionSummary.ts` returns, per metric, a `knownValue:
number | null` and a `coverage: 'no-meals' | 'complete' | 'partial' |
'unknown'`. It's already the single place "what did this day total"
logic lives, called with one day's meals and target. No ranged variant
exists — this proposal adds one rather than duplicating the per-day logic.

`MacroBars.tsx` renders its bars with plain `View`/`StyleSheet` — no chart
library, no SVG, width-percentage rectangles. That works for a bar; it does
not work for a line connecting many points, which is why this proposal
introduces `react-native-svg` rather than trying to force the existing
approach further than it reasonably goes.

## Goals / Non-Goals

**Goals:**

- A ranged view of the same honest per-day data `dailyNutritionSummary`
  already computes for one day.
- User-configurable which metrics are charted, reusing the
  `suggestion_preferences` singleton-row pattern.
- A small, auditable rendering component, not an inherited library
  surface.

**Non-Goals:**

- Weight charts, micronutrient charts, zoom/pan, a paywall. See the
  proposal.

## Decisions

### `react-native-svg` over a charting library

Add the drawing primitive; hand-roll a line-chart component on top of it,
matching `MacroBars`' existing pattern of theme-token-driven RN components
rather than an off-the-shelf kit.

*Why not Victory Native, Recharts, or similar:* every existing data
visualization in this app — the macro bars, presumably the energy-summary
ring seen in Cronometer's own Diary screenshot but built independently
here — is a small hand-rolled component reading `src/constants/theme.ts`
directly. A charting library brings its own styling API, its own
theming seam to bridge, and a surface area much larger than "draw a line
through N points and label the axis." For the scope here (a handful of
line charts, no interactivity beyond viewing), the primitive is enough and
keeps the dependency small and auditable.

*Why not stay with plain Views:* a bar's width is one number; a line chart
needs to connect N points with actual paths, which `View`/`StyleSheet`
cannot express. This is the one visualization shape in the app that
crosses that line, hence the one new dependency.

### The ranged summary wraps the existing per-day function, doesn't reimplement it

`nutritionTrend(startDate, endDate, metric)` (working name) calls
`dailyNutritionSummary` once per day in the range and collects the
`knownValue`/`coverage` pair, rather than writing a second aggregation
that recomputes totals from raw meal items across the whole range at once.

*Why:* `dailyNutritionSummary`'s coverage logic (no-meals vs. partial vs.
complete vs. unknown) is exactly the distinction a trend chart needs per
point — a day with no logged meals should render differently from a day
with a fully-known total, and a second implementation risks the two
falling out of sync on what "partial" means. Reusing the function directly
makes that impossible by construction.

*Performance note:* calling it once per day is simple and correct; whether
that's fast enough for a 90-day range depends on how it fetches meals
internally. Task 1 profiles this before committing to the naive loop —
see Risks.

### Chart preferences are a singleton row, matching `suggestion_preferences`

`chart_preferences(id INTEGER PRIMARY KEY CHECK (id = 1),
enabled_metrics TEXT NOT NULL, updated_at TEXT NOT NULL)` — `enabled_metrics`
a JSON array of `DailyNutritionMetric` values, order preserved as the
display order.

*Why a singleton row rather than one row per metric:* `suggestion_
preferences` already established this pattern for a single-user app with
no accounts — one editable settings row is simpler than a table needing
its own CRUD for what is, in practice, one user's one list.

*Why JSON in a text column rather than a join table:* the list is short
(five metrics today, a few more once micronutrients are chartable), always
read and written as a whole, and never queried by individual metric —
exactly the shape a JSON column suits and a join table would over-engineer.

### Micronutrient charting is blocked on a gap this proposal doesn't close

`add-micronutrient-tracking` records nutrition per canonical *ingredient*.
Charting "vitamin C consumed per day" needs a per-day *consumed* figure,
which needs `meal_items` (or equivalent) to carry a resolved vitamin C
value the way it already carries `proteinG` — a change to meal-level
recording, not catalogue-level.

*Why note this here rather than silently deferring it:* `CRONO-ADAPTATION-
PLAN.md` describes item 5 as "extending automatically" once item 1 lands.
That's true for the chart *picker* (a new metric can be added to the
enabled-metrics list once it exists), but not for the underlying data —
this design makes the actual dependency explicit rather than letting the
plan's optimistic framing stand uncorrected.

## Risks / Trade-offs

**A naive per-day loop over a long range may be slow** → task 1 profiles a
90-day range against real data before shipping; if it's too slow, the fix
is a single ranged SQL query feeding the same per-day coverage logic, not
a change to what the chart shows.

**A new dependency, however small** → `react-native-svg` is a drawing
primitive with broad Expo/RN ecosystem support, not a niche or heavy
library; the trade-off is judged worth it because no existing approach in
this codebase can render a line chart at all.

## Migration Plan

Append one forward-only migration creating `chart_preferences`. No changes
to existing tables. `DROP_ALL` gains `DROP TABLE IF EXISTS
chart_preferences;`.

Rollback is additive: an older build has no chart feature and never reads
or writes the table.

## Open Questions

- **Default enabled metrics for a first-time user.** A reasonable default
  (e.g. energy and one macro) versus none-enabled-until-configured is an
  implementation call, not a product decision this design needs to fix in
  advance.
