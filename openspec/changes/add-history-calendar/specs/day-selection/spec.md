## ADDED Requirements

### Requirement: The selected date is not confined to one week

The selected date SHALL be any date from the user's earliest logged day up to
today, and the interface SHALL provide a way to reach any of them.

#### Scenario: Selection is not limited to the current week

- **WHEN** the user selects a date outside the currently displayed week
- **THEN** it becomes the selected date

#### Scenario: The day view is unchanged

- **WHEN** a date outside the current week is selected
- **THEN** the day is displayed the same way as any other day

### Requirement: Navigation preserves date-following

Where navigation changes the selected date, the system SHALL maintain whether
the app is following the current date, so that the displayed day advances when
the date changes only while today is selected.

#### Scenario: Navigating away stops following

- **WHEN** the user navigates to a past date
- **THEN** the displayed day does not advance when the date changes

#### Scenario: Returning resumes following

- **WHEN** the user returns to today
- **THEN** the displayed day advances when the date changes

#### Scenario: Every navigation path behaves the same

- **WHEN** the selected date is changed by any available control
- **THEN** the following state is maintained consistently
