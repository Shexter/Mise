## MODIFIED Requirements

### Requirement: Post-milestone bridges offer next setup or direct app entry
Upon completing the chosen starting-point setup milestone, the system SHALL offer a clear choice to continue with the remaining setup or head straight to the app. When the completed milestone produced a first meal-prep plan, that plan SHALL be persisted, and the choice SHALL include starting it.

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

#### Scenario: Person finishes first meal prep plan and starts cooking it
- **WHEN** a person completes the first cooking plan and chooses to start cooking
- **THEN** the system SHALL persist the plan and open its cooking guide
- **AND** the person SHALL NOT be returned to an unrelated tab to find it again

#### Scenario: Person finishes first meal prep plan and heads straight to app
- **WHEN** a person completes the first cooking plan and taps "Head straight to the app"
- **THEN** the system SHALL persist the plan and cooking preferences and navigate into the main app tabs
- **AND** the pantry tab SHALL display a resumable prompt that opens the saved plan
- **AND** the today tab SHALL display a resumable prompt to configure calorie targets later

#### Scenario: A saved plan is started or discarded
- **WHEN** a person starts or discards their saved first plan
- **THEN** the resumable prompt for it SHALL stop appearing
- **AND** the prompt SHALL NOT reappear on a later launch

## ADDED Requirements

### Requirement: Starter pantry intake leads with the camera and never depends on it

The starter pantry step SHALL present photographing what is on hand as its
primary action, and SHALL offer at least one path that completes the step with
no camera and no provider key.

#### Scenario: Person photographs their staples

- **WHEN** a person opens the starter pantry step and taps the scan action
- **THEN** the system SHALL open the existing pantry capture flow
- **AND** every identified item SHALL remain reviewable before it enters the pantry

#### Scenario: Person has no camera or no provider key

- **WHEN** a person cannot or does not want to photograph their staples
- **THEN** the step SHALL still be completable through suggested starters or by
  adding items by hand
- **AND** the step SHALL NOT present photography as the only way forward

#### Scenario: Suggested starters are offered

- **WHEN** the step offers suggested starter ingredients
- **THEN** each SHALL be a canonical ingredient rendered through the food visual
  hierarchy
- **AND** selecting one SHALL add it as reviewable stock rather than as a fact
  about the person's kitchen

### Requirement: The first plan presents its cooking guide as illustrated steps

The first prep plan SHALL present the dish, the appliance it uses, its portions
and its time, and a numbered cooking guide.

#### Scenario: A plan step names a recognised technique

- **WHEN** a cooking guide step resolves to a technique in the bounded vocabulary
- **THEN** the step SHALL render its technique illustration alongside its text

#### Scenario: A plan step names no recognised technique

- **WHEN** a cooking guide step resolves to no technique
- **THEN** the step SHALL render as numbered text
- **AND** a guide mixing illustrated and text-only steps SHALL remain visually
  coherent rather than appearing to have failed to load
