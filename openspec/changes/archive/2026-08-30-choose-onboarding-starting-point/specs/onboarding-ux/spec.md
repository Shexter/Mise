## ADDED Requirements

### Requirement: First-run presents starting-point choice with dual setup paths

The system SHALL present a first-run starting-point choice ("Where would you like to start?") letting a person choose between "Daily calorie & macro target" and "Kitchen & meal prep".

#### Scenario: Person chooses calorie targets as starting point
- **WHEN** a person selects "Daily calorie & macro target" on the first screen
- **THEN** the system SHALL immediately start the calorie target setup path (basic calculation or DEXA/InBody scan)
- **AND** it SHALL not require kitchen appliance or pantry setup before calculating the daily target

#### Scenario: Person chooses kitchen & meal prep as starting point
- **WHEN** a person selects "Kitchen & meal prep" on the first screen
- **THEN** the system SHALL immediately start the kitchen setup path (dietary preferences, appliances, starter pantry, and first plan)
- **AND** it SHALL not require body metrics, DEXA scans, or calorie targets before generating the initial plan

### Requirement: Post-milestone bridges offer next setup or direct app entry

Upon completing the chosen starting-point setup milestone, the system SHALL offer a clear choice to continue with the remaining setup or head straight to the app.

#### Scenario: Person finishes calorie target calculation and continues to kitchen
- **WHEN** a person finishes the calorie calculation on the results screen and taps "Set up kitchen & meal prep"
- **THEN** the system SHALL navigate into the kitchen setup path (appliances, starter pantry, first plan)
- **AND** preserve the calculated nutrition profile

#### Scenario: Person finishes calorie target calculation and heads straight to app
- **WHEN** a person finishes the calorie calculation on the results screen and taps "Head straight to the app"
- **THEN** the system SHALL persist the profile and navigate into the main app tabs
- **AND** the pantry tab SHALL display a resumable prompt to configure kitchen appliances and stock later

#### Scenario: Person finishes first meal prep plan and continues to calorie setup
- **WHEN** a person completes the first cooking plan and taps "Set up daily calorie target"
- **THEN** the system SHALL navigate into the calorie setup path
- **AND** preserve the confirmed kitchen appliances and pantry inventory

#### Scenario: Person finishes first meal prep plan and heads straight to app
- **WHEN** a person completes the first cooking plan and taps "Head straight to the app"
- **THEN** the system SHALL persist cooking preferences and navigate into the main app tabs
- **AND** the today tab SHALL display a resumable prompt to configure calorie targets later

### Requirement: Navigation stack is deterministic and non-recursive

All onboarding forward transitions and back navigation SHALL navigate between distinct routes without self-referential redirect loops or trapped states.

#### Scenario: Continuing from starting point choice
- **WHEN** a person selects an initial starting point and taps Continue
- **THEN** the system SHALL push the distinct initial route for that flow
- **AND** back navigation SHALL return cleanly to the starting point choice
