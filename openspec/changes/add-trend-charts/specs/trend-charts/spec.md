## Purpose

A user-configurable set of line charts over logged nutrition metrics across
a date range, built on the existing per-day honest-coverage aggregation
and rendered without a charting library — extending, not replacing, the
day-by-day history calendar.

## ADDED Requirements

### Requirement: A ranged view reuses the existing per-day coverage logic

The system SHALL compute a per-day value and coverage state for a chosen
metric across a date range using the same logic that already computes a
single day's summary, rather than a separate aggregation.

#### Scenario: A range spanning days with different coverage

- **GIVEN** a date range containing a day with no logged meals, a day with
  a complete known total, and a day with a partial total
- **WHEN** the trend for a metric is computed across that range
- **THEN** each day's value and coverage state matches what the single-day
  summary would report for that day individually

### Requirement: Which metrics are charted, and their order, is a stored user preference

The system SHALL let a user enable or disable a chart for any available
metric and set the display order, and SHALL persist that choice.

#### Scenario: No configuration means no charts

- **GIVEN** a user who has never configured chart preferences
- **WHEN** the trend view is opened
- **THEN** no chart is shown for a metric that has not been explicitly
  enabled, or a documented default set is shown — either way, the shown
  set matches the stored preference

#### Scenario: Enabling a metric persists across sessions

- **WHEN** a user enables a chart for a metric
- **THEN** it remains enabled the next time the app is opened

#### Scenario: Reordering changes display order

- **WHEN** a user reorders enabled charts
- **THEN** they are displayed in the new order on subsequent views

### Requirement: Available metrics are limited to those with per-day consumed data

The system SHALL only offer a chart for a metric that has a per-day
consumed value already computable — energy, protein, carbohydrate, fat,
and fibre at launch — and SHALL NOT offer weight or any nutrient that is
only recorded at the catalogue-ingredient level rather than per meal.

#### Scenario: Weight is not an available chart metric

- **WHEN** a user views the list of chartable metrics
- **THEN** weight does not appear, since no per-day weight history is
  recorded

#### Scenario: A catalogue-only nutrient is not an available chart metric

- **GIVEN** a nutrient recorded per canonical ingredient but not per
  consumed meal item
- **WHEN** a user views the list of chartable metrics
- **THEN** that nutrient does not appear
