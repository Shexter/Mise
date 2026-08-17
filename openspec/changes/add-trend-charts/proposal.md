## Why

`src/logic/dailyNutritionSummary.ts` already computes an honest per-day
figure for energy, protein, carbohydrate, fat, and fibre — `knownValue`,
`null` when nothing defensible exists, a `coverage` state distinguishing
no-meals from partial from complete. It answers "how did today go." Nothing
in the app answers "how did the last three weeks go" — there is no
multi-day view of this data at all, only the day-by-day history calendar
`add-history-calendar` already built for navigating between individual
days.

Competitor teardown: `competitor-analysis/cronometer/charts-trends/
dashboard-and-charts.md` and `CRONO-ADAPTATION-PLAN.md` item 5. Initially
scoped down to a fixed 2-3 charts to avoid the complexity Cronometer built
to justify a paid tier; overridden on review to keep the user-configurable
"which charts are shown" richness, on the reasoning that the complexity
being avoided was Cronometer's monetization surface, not the chart picker
itself.

## What Changes

- **A new ranged summary function**, built on top of the existing
  `dailyNutritionSummary`, collecting `knownValue` per day across a date
  range for a chosen metric — the same honest null-for-unknown discipline,
  extended across days instead of stopping at one.
- **A line chart per selected metric**, rendered with `react-native-svg` —
  a low-level drawing primitive, not a charting library — in a hand-rolled
  component matching `MacroBars`' existing pattern of a simple,
  theme-token-driven visual built directly on top of RN primitives rather
  than an off-the-shelf UI kit.
- **A user-configurable set of charts.** Which metrics get a chart, and in
  what order, is a stored preference — not a fixed 2-3 charts hard-coded
  into the screen. A new singleton preferences row, matching the pattern
  `suggestion_preferences` already established for a different setting.
- **Available metrics at launch: energy, protein, carbohydrate, fat,
  fibre** — exactly `DailyNutritionMetric`'s existing union. Extending to
  the eight nutrients `add-micronutrient-tracking` introduces requires
  those nutrients to first be recorded *per meal*, not just per
  ingredient in the catalogue — see Non-goals.
- **Weight charting is explicitly not built here.** `profile.weight_kg` is
  a single current value, overwritten on every update — there is no
  `weight_log` table, no time series to chart. Building one is a
  prerequisite this proposal does not attempt.

## Capabilities

### New Capabilities

- `trend-charts`: A user-configurable set of line charts over logged
  nutrition metrics, built on the existing per-day honest-coverage
  aggregation extended across a date range, rendered with a hand-rolled
  SVG component rather than a charting library.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Weight trend charts.** No weight history exists to chart. See What
  Changes. A future `weight_log`-style change is a prerequisite, not part
  of this proposal.
- **Charting the eight micronutrients from `add-micronutrient-tracking`.**
  That change records nutrition per *canonical ingredient* in the build
  catalogue — it does not add per-meal columns recording what a user
  actually consumed of those nutrients on a given day, the way `meal_items`
  already does for calories/protein/carbs/fat/fibre. Without that, there's
  no per-day consumed figure to plot. Recording consumed micronutrients per
  meal is real, separate, unscoped work.
- **A generic charting library.** `react-native-svg` is a drawing
  primitive; this proposal does not add Victory, Recharts, or similar —
  see design.md for the reasoning.
- **Zoom, pan, or custom date-range selection within a chart.** A fixed set
  of reasonable ranges (e.g. last 30/90 days) is enough for a first version;
  arbitrary range picking is follow-up work if it turns out to matter.
- **Any Gold-tier-style paywall or locked chart.** Not applicable — Mise
  has no paid tier.

## Impact

**Schema.** One new table: `chart_preferences` — a singleton row (id
CHECK'd to 1, matching `suggestion_preferences`'s existing pattern) holding
which metrics are enabled and their display order. Appended as one
forward-only migration; `DROP_ALL` and *Delete all data* gain it.

**Code.**
- `src/logic/dailyNutritionSummary.ts` (or a new adjacent module) — a
  ranged variant collecting per-day `knownValue` across a date span.
- `src/db/queries.ts` — chart-preference read/write queries, plus whatever
  date-range meal fetch the ranged summary needs (likely already coverable
  by existing meal-fetching queries called once per day in the range,
  matching how `dailyNutritionSummary` is presumably already invoked per
  day elsewhere).
- A new hand-rolled SVG chart component, following `MacroBars`' existing
  convention: theme tokens only, no literals.
- A chart-management screen (add/remove/reorder enabled metrics).

**Dependencies.** Adds `react-native-svg`. This is the first dependency
added by any of the five proposals in this batch — flagged explicitly
rather than glossed over. It's a low-level, widely-used Expo-compatible
drawing primitive (not a full charting framework), chosen specifically so
the actual chart rendering stays a small, auditable, hand-rolled component
consistent with how `MacroBars` already renders its bars, rather than
inheriting a large library's API surface and styling assumptions.

**Risk.** A multi-day query run naively (one query per day, in a loop) over
a 90-day range is 90 round trips — worth profiling against a single
ranged query early rather than discovering the cost after the feature
ships. Flagged as a task, not assumed away.
