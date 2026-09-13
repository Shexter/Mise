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

#### Scenario: Speech intake remains a sibling of the camera

- **WHEN** the step presents its intake choices
- **THEN** the speech action SHALL remain directly available on the step
  alongside the camera and manual entry
- **AND** it SHALL NOT be reachable only from inside the camera capture flow

### Requirement: The first plan presents its cooking guide as illustrated steps

The first prep plan screen SHALL present the dish, the appliance it uses, its
portions and its time, and a numbered cooking guide. This requirement governs
how that screen presents whatever plan it is given; it does not decide where a
plan is stored or what happens after the screen is finished.

#### Scenario: A plan step names a recognised technique

- **WHEN** a cooking guide step resolves to a technique in the bounded vocabulary
- **THEN** the step SHALL render its technique illustration alongside its text

#### Scenario: A plan step names no recognised technique

- **WHEN** a cooking guide step resolves to no technique
- **THEN** the step SHALL render as numbered text
- **AND** a guide mixing illustrated and text-only steps SHALL remain visually
  coherent rather than appearing to have failed to load
