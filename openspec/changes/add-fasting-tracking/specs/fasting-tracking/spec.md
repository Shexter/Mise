## Purpose

Records time-restricted eating windows — start, optional target duration,
end, and history — as a self-contained timer with no connection to pantry
depletion, meal logging, or the capture pipeline.

## ADDED Requirements

### Requirement: A user can start and end a fast

The system SHALL let a user start a fast, optionally with a target
duration, and SHALL let the user end an active fast, recording its actual
elapsed duration.

#### Scenario: Starting a fast with no target

- **WHEN** a user starts a fast without specifying a target duration
- **THEN** the fast begins with `target_duration_minutes` unset
- **AND** elapsed time is shown while it remains active

#### Scenario: Ending an active fast

- **GIVEN** an active fast
- **WHEN** the user ends it
- **THEN** its end time is recorded
- **AND** it appears in fasting history with its actual duration

### Requirement: Only one fast can be active at a time

The system SHALL reject starting a new fast while one is already active.

#### Scenario: Starting a second fast while one is active

- **GIVEN** an active fast
- **WHEN** the user attempts to start another
- **THEN** the attempt is rejected
- **AND** the original fast remains the only active one

### Requirement: A fast is stored as a single interval, not bucketed by calendar day

The system SHALL store a fast as one record spanning its full start-to-end
interval, regardless of whether it crosses a device-local midnight
boundary.

#### Scenario: A fast spans midnight

- **GIVEN** a fast started before midnight and ended after it
- **WHEN** the fast is recorded
- **THEN** it appears as a single history entry with its true start and end
- **AND** it is not split into two entries at the day boundary

### Requirement: Fasting never modifies pantry, meal, or consumption records

Starting or ending a fast SHALL NOT create, modify, or reverse any pantry
item, meal, meal item, or consumption event.

#### Scenario: Starting a fast leaves pantry and meal data untouched

- **GIVEN** any pantry and meal state
- **WHEN** a user starts a fast
- **THEN** no pantry item, meal, or consumption record is created, changed,
  or removed as a result

#### Scenario: Ending a fast leaves pantry and meal data untouched

- **GIVEN** any pantry and meal state
- **WHEN** a user ends an active fast
- **THEN** no pantry item, meal, or consumption record is created, changed,
  or removed as a result
