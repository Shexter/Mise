## ADDED Requirements

### Requirement: First-run intent selection supports independent calorie and meal-prep goals

The system SHALL present calorie tracking and meal prep as independently
selectable first-run intents. The system SHALL require at least one selected
intent before continuing and SHALL support selecting both intents.

#### Scenario: Calorie-only selection preserves the existing profile route

- **WHEN** a person selects calorie tracking only and continues
- **THEN** the system SHALL collect the existing required profile and target
  inputs before completing calorie onboarding
- **AND** it SHALL not show meal-prep setup as a required step

#### Scenario: Meal-prep-only selection does not require body data

- **WHEN** a person selects meal prep only and continues
- **THEN** the system SHALL not require sex, age, height, weight, activity, or
  a calorie target to finish meal-prep onboarding
- **AND** it SHALL not create placeholder nutrition-profile values

#### Scenario: Combined selection includes both valid paths

- **WHEN** a person selects both calorie tracking and meal prep
- **THEN** the system SHALL complete the valid calorie profile path
- **AND** it SHALL offer the meal-prep setup before final app entry

### Requirement: Meal-prep setup records explicit appliance availability

The system SHALL let a meal-prep person select owned appliances from a
controlled local list, select no appliances, or defer the choice. Appliance
availability SHALL be editable after onboarding.

#### Scenario: No appliance is selected

- **WHEN** a person chooses no appliances
- **THEN** the system SHALL persist no appliance ownership
- **AND** it SHALL only offer an eligible no-cook plan or state that more setup
  is needed

#### Scenario: A person changes appliance ownership later

- **WHEN** a person edits their appliance choices from a resumable app entry
- **THEN** the system SHALL update the local cooking setup
- **AND** subsequent meal-prep recommendations SHALL use the changed choices

### Requirement: Starter pantry intake stays confirmed and trustworthy

The system SHALL let a meal-prep person create a finite starter-pantry draft
from common ingredient choices or existing intake routes. The system SHALL not
persist a draft ingredient until the person confirms it.

#### Scenario: Known starter ingredient is confirmed

- **WHEN** a person confirms a resolved starter ingredient
- **THEN** the system SHALL insert it through the existing canonical pantry
  persistence contract
- **AND** it SHALL preserve an unknown quantity as unknown

#### Scenario: Starter pantry is skipped

- **WHEN** a person skips starter-pantry intake
- **THEN** the system SHALL allow app entry
- **AND** it SHALL retain a resumable meal-prep setup state
- **AND** it SHALL not add inferred inventory

### Requirement: Initial meal-prep plans respect confirmed constraints

The system SHALL construct an initial meal-prep plan from confirmed pantry
inventory, declared appliances, and supplied dietary preferences. A plan SHALL
clearly disclose missing ingredients and required appliances.

#### Scenario: Matching appliance and pantry constraints

- **WHEN** an eligible local template matches the confirmed pantry and owned
  appliances
- **THEN** the system SHALL show its recipe summary and ordered cooking guide
- **AND** every required appliance SHALL be owned by the person

#### Scenario: A plan requires a missing ingredient

- **WHEN** an otherwise eligible plan has an ingredient not in the confirmed
  pantry
- **THEN** the system SHALL list that ingredient as missing
- **AND** it SHALL not claim that the pantry contains it

#### Scenario: No eligible plan exists

- **WHEN** no local template satisfies the confirmed constraints
- **THEN** the system SHALL explain the limiting condition without guessing
- **AND** it SHALL offer a safe next action such as adding ingredients, editing
  appliances, or deferring the plan

### Requirement: First-plan generation remains local and does not log food automatically

The system SHALL provide a deterministic local first-plan path that does not
require an API key or cloud provider. Starting or completing a guide SHALL not
automatically create a logged meal or alter pantry inventory.

#### Scenario: No API key is configured

- **WHEN** a person reaches the first-plan route without an API key
- **THEN** the system SHALL use eligible local templates when available
- **AND** it SHALL permit completion or deferral of onboarding

#### Scenario: A person completes a guide

- **WHEN** a person finishes a first cooking guide
- **THEN** the system SHALL offer an explicit handoff to the existing
  recipe-review and meal-logging flow
- **AND** it SHALL not log a meal until that review flow is confirmed

### Requirement: Meal-prep onboarding is accessible and visually independent of generated assets

The system SHALL expose selected state, progress, and available actions through
text or semantics in addition to colour. The flow SHALL remain usable without
generated food-image assets.

#### Scenario: A person uses assistive technology on intent cards

- **WHEN** a person focuses an intent card with a screen reader or keyboard
- **THEN** the system SHALL announce its label and selected state
- **AND** it SHALL provide an operable control to change that state

#### Scenario: No generated food art is available

- **WHEN** the visual-food-identity asset system has not shipped
- **THEN** the system SHALL render the onboarding flow with basic vectors,
  system icons, or source photos where available
- **AND** it SHALL not show a broken-image state as the only representation of
  an ingredient or appliance
