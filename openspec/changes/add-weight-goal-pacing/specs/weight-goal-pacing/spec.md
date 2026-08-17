## Purpose

An optional target weight and desired rate of change that, when set,
replace the fixed lose/maintain/gain calorie adjustment with one derived
from the rate, and surface a forecast completion date computed live rather
than stored — additive to the existing goal-direction choice, never
required.

## ADDED Requirements

### Requirement: A target weight and rate are optional and unset by default

The system SHALL allow a user to set a target weight and a desired weekly
rate of change, both nullable, defaulting to unset for every profile.

#### Scenario: A profile with neither set behaves exactly as before this change

- **GIVEN** a profile with no target weight and no rate set
- **WHEN** the daily calorie target is computed
- **THEN** it uses the existing fixed goal adjustment
- **AND** no forecast date is shown

#### Scenario: Setting only one of the two leaves the fixed adjustment in effect

- **GIVEN** a profile with a target weight set and no rate, or a rate set
  and no target weight
- **WHEN** the daily calorie target is computed
- **THEN** it uses the existing fixed goal adjustment, not the rate-derived
  one

### Requirement: A calorie adjustment derives from the rate when both are set

The system SHALL compute the daily calorie adjustment from the target
weight and rate, in place of the fixed goal adjustment, whenever both are
set — subject to the same minimum daily calorie floor the fixed adjustment
already respects.

#### Scenario: A weight-loss rate produces a deficit

- **GIVEN** a target weight below the current weight and a positive rate of
  loss
- **WHEN** the daily calorie target is computed
- **THEN** the adjustment is a deficit derived from the rate
- **AND** the resulting target does not fall below the existing minimum

#### Scenario: A rate implying an extreme deficit is floored, not silently accepted

- **GIVEN** a rate that would imply a target below the existing minimum
  daily calories
- **WHEN** the daily calorie target is computed
- **THEN** the target is floored at the existing minimum, exactly as the
  fixed-adjustment path already floors

### Requirement: The forecast date is computed live and never stored as a fact

The system SHALL compute a forecast completion date from the current
weight, target weight, and rate at the time it is displayed, and SHALL NOT
persist a computed date as a stored value.

The forecast SHALL be presented as an estimate that can change, not as a
guaranteed date.

#### Scenario: A change in current weight shifts the forecast

- **GIVEN** a target weight and rate are set
- **WHEN** the profile's current weight changes
- **THEN** the next-displayed forecast date reflects the new weight
- **AND** no previously computed date is displayed as if unchanged

#### Scenario: Forecast copy does not overstate certainty

- **WHEN** a forecast date is displayed
- **THEN** the accompanying copy identifies it as an estimate

### Requirement: The rate input is bounded

The system SHALL constrain the weekly rate a user can select to a bounded
range, rather than accepting an arbitrary value.

#### Scenario: A rate outside the bounded range cannot be selected

- **WHEN** a user adjusts the rate control
- **THEN** the value stays within the defined minimum and maximum
