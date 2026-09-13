## MODIFIED Requirements

### Requirement: First-run presents starting-point choice with dual setup paths
The system SHALL present a first-run starting-point choice ("Where would you like to start?") with "Plan my meals" as the leading option and "Set my calorie & macro target" as a direct alternative.

#### Scenario: Person chooses calorie targets as starting point
- **WHEN** a person selects "Set my calorie & macro target" on the first screen
- **THEN** the system SHALL immediately start the calorie target setup path (basic calculation or DEXA/InBody scan)
- **AND** it SHALL not require kitchen appliance or pantry setup before calculating the daily target

#### Scenario: Person chooses kitchen & meal prep as starting point
- **WHEN** a person selects "Plan my meals" on the first screen
- **THEN** the system SHALL offer skippable dietary/equipment preferences, local recipe selection and assignment to a dated meal slot
- **AND** it SHALL not require body metrics, scans, calorie targets, pantry capture or an API key to save the first scheduled meal

### Requirement: Post-milestone bridges offer next setup or direct app entry
Upon completing the chosen starting-point milestone, the system SHALL preserve confirmed setup and offer continuation into the remaining setup or direct app entry. A confirmed first scheduled meal SHALL persist before handoff.

#### Scenario: Person finishes calorie target calculation and continues to kitchen
- **WHEN** a person finishes calorie calculation and taps "Plan my meals"
- **THEN** the system SHALL navigate into planning without requiring pantry capture
- **AND** preserve the calculated nutrition profile

#### Scenario: Person finishes calorie target calculation and heads straight to app
- **WHEN** a person taps "Head straight to the app" after calorie calculation
- **THEN** the system SHALL persist the profile and open Today without forcing planning
- **AND** optional kitchen setup SHALL remain resumable from Pantry

#### Scenario: Person finishes first meal prep plan and continues to calorie setup
- **WHEN** a person saves the first scheduled meal and taps "Set up daily calorie target"
- **THEN** the system SHALL navigate into calorie setup
- **AND** preserve the saved schedule, preferences, appliances and any confirmed pantry inventory

#### Scenario: Person finishes first meal prep plan and heads straight to app
- **WHEN** a person chooses to view the plan after saving the first meal
- **THEN** the system SHALL open Today in Week view focused on that saved meal
- **AND** optional target setup SHALL remain resumable without another onboarding requirement

## ADDED Requirements

### Requirement: Skipped or completed onboarding does not block planning
The system SHALL retain existing onboarding completion on upgrade and support returning to a saved first schedule after restart. Skipping planning SHALL leave local recipe selection, dinner fallback and ordinary logging usable.

#### Scenario: Existing user opens the updated app
- **WHEN** onboarding was already completed before planner installation
- **THEN** the app does not replay setup or fabricate a prior first plan
- **AND** it offers one dismissible planning introduction from Today

#### Scenario: Restart after first plan save
- **WHEN** the app closes after saving the first scheduled meal but before handoff completes
- **THEN** reopening or resuming setup restores that meal without duplicate scheduling

#### Scenario: Planning is skipped
- **WHEN** a person skips planning
- **THEN** the main app opens with usable empty slots, dinner fallback and Add
- **AND** no recurring blocking setup prompt appears
