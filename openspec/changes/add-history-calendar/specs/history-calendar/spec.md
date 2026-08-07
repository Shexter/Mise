## Purpose

A way to reach any day the user has already logged, from an app that currently
shows one week and offers no way out of it.

## ADDED Requirements

### Requirement: Any day at or before today can be reached

The system SHALL allow the user to navigate to any date from the earliest day
they have logged up to today, and MUST NOT restrict navigation to the current
week.

#### Scenario: A day in a previous week is reachable

- **WHEN** the user navigates to a date in a previous week
- **THEN** that day is shown

#### Scenario: A day months ago is reachable

- **WHEN** the user navigates to a date several months earlier
- **THEN** that day is shown

#### Scenario: Future days remain unreachable

- **WHEN** the user attempts to select a date after today
- **THEN** it is not selectable

### Requirement: A month view shows which days have entries

The system SHALL present a month view in which each day indicates whether
anything was logged on it.

#### Scenario: Logged days are distinguishable

- **WHEN** a month is shown
- **THEN** days with entries are distinguishable from days without

#### Scenario: Selecting a day opens it

- **WHEN** the user selects a day in the month view
- **THEN** that day's meals are shown

#### Scenario: The current day is identifiable

- **WHEN** a month containing today is shown
- **THEN** today is identifiable

### Requirement: History is bounded by the first logged day

The system SHALL NOT offer navigation earlier than the user's first logged day.

#### Scenario: Navigation stops at the earliest entry

- **WHEN** the user reaches the month containing their earliest logged day
- **THEN** no earlier month is offered

#### Scenario: A user with no entries sees no history

- **GIVEN** no day has ever been logged
- **WHEN** the calendar is opened
- **THEN** no earlier history is offered

### Requirement: A day with no entries is shown as unlogged, not as zero

The system SHALL distinguish a day with no entries from a day whose entries
total zero, and MUST NOT display an unlogged day as having consumed nothing.

#### Scenario: An unlogged day claims no total

- **WHEN** a day with no entries is shown
- **THEN** it is shown as having no entries
- **AND** it is not shown as a zero total

#### Scenario: An unlogged day is not scored

- **WHEN** a day with no entries is shown
- **THEN** it is not marked as under or over any target

#### Scenario: A logged day totals normally

- **WHEN** a day with entries is shown
- **THEN** its total is shown

### Requirement: A day is summarised against the target it had at the time

Where a day's total is shown against a target, the system SHALL use the target
recorded for that day, and MUST NOT recompute it from the current profile.

#### Scenario: A past day keeps its own target

- **GIVEN** a day logged under one target
- **WHEN** the current target is different
- **THEN** the day is shown against the target it had

#### Scenario: Changing a target does not rewrite history

- **WHEN** the user changes their calorie target
- **THEN** previously logged days are summarised as before

#### Scenario: A day with no recorded target claims no comparison

- **WHEN** a day has entries but no recorded target
- **THEN** its total is shown without a comparison

### Requirement: Month summaries are read in one query per range

The system SHALL obtain the per-day summaries for a displayed range in a single
query, and MUST NOT query per day.

#### Scenario: One range, one query

- **WHEN** a month of summaries is loaded
- **THEN** one query is made for the range

#### Scenario: Navigating months does not multiply queries

- **WHEN** the user moves between months
- **THEN** each month costs one query

### Requirement: The week strip moves between weeks

The system SHALL allow the week strip to move to the previous and following
weeks without opening the calendar.

#### Scenario: The previous week is reachable from the strip

- **WHEN** the user moves the strip backwards
- **THEN** the previous week's days are shown

#### Scenario: The strip does not page beyond today

- **WHEN** the strip is showing the week containing today
- **THEN** it does not move to a later week

#### Scenario: Selecting from the strip behaves as before

- **WHEN** the user selects a day in the strip
- **THEN** that day is shown

### Requirement: Returning to today resumes following the real date

Where the user returns to today, the system SHALL resume tracking the current
date, so that the day shown advances when the date changes.

#### Scenario: Returning to today resumes following

- **GIVEN** the user is viewing a past day
- **WHEN** they return to today
- **THEN** the day shown follows the current date again

#### Scenario: Viewing a past day does not follow

- **GIVEN** the user is viewing a past day
- **WHEN** the date changes
- **THEN** the day shown does not move

#### Scenario: Returning to today is always available

- **WHEN** the user is viewing any day other than today
- **THEN** an action returning them to today is available
