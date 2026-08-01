## Purpose

Governs which day the Today screen shows. The app's first promise is that a
meal you log appears; this is the layer that keeps that promise true when the
real date moves or the user goes looking through the week.

## ADDED Requirements

### Requirement: The Today screen opens on the current day

The system SHALL show the current day whenever the Today screen is opened,
regardless of how long the application has been running or which day was last
viewed.

The current day SHALL be determined at the moment of display, never at
application start.

#### Scenario: A long-running application still opens on today

- **GIVEN** the application has been running since a previous day
- **WHEN** the user opens the Today screen
- **THEN** the current day is shown

#### Scenario: Midnight passes with the screen open

- **GIVEN** the Today screen is open and showing the current day
- **WHEN** the date changes and the screen is next brought to the foreground
- **THEN** the newly current day is shown

#### Scenario: A cold start shows today, not a remembered day

- **WHEN** the application is started fresh
- **THEN** the current day is shown
- **AND** no previously selected day is restored

### Requirement: A deliberately chosen day is respected while the user stays there

Where the user selects a day other than the current one, the system SHALL keep
showing that day for as long as they remain on the screen, and MUST NOT
re-synchronise underneath them.

#### Scenario: Reviewing a past day is not interrupted

- **GIVEN** the user has selected an earlier day
- **WHEN** they scroll, read, and interact with that day's contents
- **THEN** the selected day does not change

#### Scenario: Leaving and returning resets to today

- **GIVEN** the user has selected an earlier day
- **WHEN** they navigate away and return to the Today screen
- **THEN** the current day is shown

### Requirement: Logging a meal leaves the user looking at that meal

When a meal is saved, the system SHALL show the day the meal was filed under, so
that the meal just created is visible.

This applies regardless of which day was being viewed when the meal was logged.

#### Scenario: Logging while viewing a past day moves the view

- **GIVEN** the user is viewing an earlier day
- **WHEN** they log a meal
- **THEN** the view moves to the day the meal was filed under
- **AND** the meal appears in the list

#### Scenario: The day's totals reflect the new meal

- **WHEN** a meal is saved
- **THEN** the displayed remaining calories and macros include it

#### Scenario: A meal is filed under the day it was eaten

- **GIVEN** the user is viewing an earlier day
- **WHEN** they log a meal
- **THEN** the meal is recorded against the current day
- **AND** not against the day being viewed

### Requirement: Confirmation never contradicts what is on screen

The system MUST NOT report a meal as saved while the resulting screen shows no
record of it.

Any confirmation shown after saving SHALL be consistent with the state the user
is looking at when it appears.

#### Scenario: Saving is confirmed against a visible result

- **WHEN** a meal is saved and confirmation is shown
- **THEN** the meal is present in the list behind that confirmation

#### Scenario: An empty day is never reported as having saved a meal

- **WHEN** the day shown reads as having nothing logged
- **THEN** no confirmation claiming a meal was saved is displayed

### Requirement: The week shown follows the day shown

The system SHALL display the week containing the day being shown, with days
after the current day non-selectable.

#### Scenario: The strip follows a corrected day

- **GIVEN** the shown day is corrected to the current day
- **WHEN** the week strip is displayed
- **THEN** it shows the week containing the current day

#### Scenario: Future days cannot be selected

- **WHEN** the week strip includes days after the current day
- **THEN** those days are not selectable
