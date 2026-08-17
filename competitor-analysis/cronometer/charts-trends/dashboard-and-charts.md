# Discover dashboard + Charts tab

**Screenshots:** `dashboard.jpg, charts-calories-weight.jpg`
**Cronometer tier:** free tab, but the dashboard's "Report Summary" and
"Crono Coach" panels are Gold-gated (lock icon, upsell copy)

## What it does

A "Discover" tab with four sub-tabs (Dashboard / Charts / Report /
Snapshots). Dashboard surfaces a Gold upsell banner, a report summary
("Consumed Average" once enough data exists), and a locked "Crono Coach"
card. Charts shows a stacked line chart of calories consumed by macro
(protein/carbs/fat/alcohol as separate coloured lines) over a configurable
date window, plus a separate Weight trend chart below it, each with
"Manage Charts" / "Add Chart" controls implying a user-configurable set of
trend charts rather than a fixed dashboard.

## UI pattern observed

Tabbed sub-navigation within one screen. Charts are user-manageable
(add/remove/reorder implied by "Manage Charts"), not a fixed set. Locked
premium features render in place with a lock icon rather than being hidden
— visible but inert until paid.

## Implied data model

A per-metric time series query (calories by macro, weight) over an
arbitrary date range, plus a user-level "which charts are shown, in what
order" preference record.

## Gap-check against Mise

- **Already have:** Mise's history calendar (`add-history-calendar`) and
  dinner-decision/analytics surfaces cover browsing past days; the
  underlying data (macros per day, weight per entry) already exists.
- **Partially have:** no evidence of a dedicated multi-week trend *chart*
  (line graph over date range) in the specs reviewed — history calendar is
  day-by-day, not a continuous trend visualization.
- **Missing entirely:** user-configurable chart management ("Manage
  Charts" / "Add Chart") — Mise has no equivalent of picking which metrics
  get a trend chart.

## Verdict

**Adopt, including chart configurability** — overridden from an initial
"adapt, skip the configurability" call. Build the full "Manage Charts" /
"Add Chart" system: user picks which metrics get a trend chart, from
weight/calories/macros today, extending to individual micronutrients once
`full-micronutrient-report.md`'s tracking lands. See
`CRONO-ADAPTATION-PLAN.md` for scope.

**Linked OpenSpec change:** `none yet`.
