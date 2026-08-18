## 1. Ranged summary and performance check

- [x] 1.1 Add a ranged summary function that calls `dailyNutritionSummary`
      once per day across a date range and collects `knownValue`/
      `coverage` per day, per metric.
- [x] 1.2 Profile it against a realistic 90-day range with real logged
      data. If the naive per-day loop is too slow, replace the underlying
      meal fetch with a single ranged query while keeping the exact same
      per-day coverage semantics — do not change what a day's coverage
      means to fix a performance problem.
- [x] 1.3 Test that ranged output matches single-day `dailyNutritionSummary`
      output for every day in a range with mixed no-meals/partial/complete
      days.

## 2. Chart preferences

- [x] 2.1 Append a migration creating `chart_preferences` (singleton row,
      `enabled_metrics` as ordered JSON, matching `suggestion_preferences`'s
      existing pattern).
- [x] 2.2 Add `DROP TABLE IF EXISTS chart_preferences;` to `DROP_ALL`.
- [x] 2.3 Add read/write queries in `src/db/queries.ts`.
- [x] 2.4 Test enabling, disabling, and reordering persist correctly, and
      that an unconfigured profile behaves per the documented default (see
      design.md's open question).

## 3. Chart rendering

- [x] 3.1 Add `react-native-svg` as a dependency.
- [x] 3.2 Build a hand-rolled line-chart component reading exclusively from
      `src/constants/theme.ts` for colour/font/spacing — no literals,
      matching `MacroBars`' existing convention.
- [x] 3.3 Render a coverage-aware point/line style — a day with unknown or
      partial coverage should read visibly differently from a fully-known
      day, not silently plot as if it were complete.
- [x] 3.4 Test the chart component in isolation with fixture data covering
      empty range, single point, and mixed-coverage ranges.

## 4. Chart management UI

- [x] 4.1 Add a screen or section listing available metrics with
      enable/disable and reorder controls, writing through the task 2
      queries.
- [x] 4.2 Render the enabled charts, in stored order, using the task 3
      component and the task 1 ranged data.
- [x] 4.3 Accessibility: large text, screen reader labels for chart data
      points (not just the visual line), reduced-motion handling for any
      chart-entry animation.

## 5. Quality gates

- [x] 5.1 Run `npm run typecheck`, the full Vitest suite, and strict
      OpenSpec validation.
- [x] 5.2 Confirm *Delete all data* removes `chart_preferences` along with
      everything else.
- [ ] 5.3 Owner device check: enable several charts, reorder them, restart
      the app, confirm the configuration and rendered data both persist and
      match manually-verified totals for a known date range.
