## Purpose

Suggestion templates make the normal tonight answer fit a person's immediate
cooking priorities while keeping long-term nutrition settings, food safety, and
other suggestion modes separate.

## ADDED Requirements

### Requirement: Tonight offers fixed, composable preference controls

The system SHALL offer a fixed base intent set of balanced, use-it-up,
protein-forward, lighter-portions, and familiar-favourites. It SHALL also offer
standard and quick prep-speed values. The set SHALL NOT be user-editable.

#### Scenario: The available choices are understandable

- **WHEN** the user opens tonight preference controls
- **THEN** each base intent describes how it shapes suggestions
- **AND** prep speed is presented as a separate choice

#### Scenario: A user combines intent and speed

- **WHEN** the user selects protein-forward and quick
- **THEN** both values are active for tonight suggestions

#### Scenario: The controls do not claim an outcome

- **WHEN** any template label or description is shown
- **THEN** it does not promise weight, health, or body-composition results

### Requirement: The default is profile-informed and an explicit choice is reversible

The system SHALL derive a recommended base intent from the profile goal when no
explicit preference exists. It SHALL persist an explicit base-intent and
prep-speed choice locally, provide a way to return to the recommendation, and
MUST NOT alter the profile or its targets as a consequence.

#### Scenario: A new preference derives from the profile

- **GIVEN** no saved dinner preference and a profile goal
- **WHEN** the user opens tonight suggestions
- **THEN** a matching recommended base intent and standard prep speed are active

#### Scenario: An explicit choice persists without changing the profile

- **WHEN** the user saves an explicit dinner preference
- **THEN** it is active when tonight suggestions are opened again
- **AND** the profile goal, calorie target, and macro targets are unchanged

#### Scenario: Reset returns to the current recommendation

- **GIVEN** a saved dinner preference
- **WHEN** the user chooses to use the recommendation
- **THEN** the saved preference is cleared
- **AND** the current profile-derived base intent and standard prep speed become active

### Requirement: Preferences rank and explain, but do not exclude

The resolved preference SHALL influence candidate framing, local ordering,
visible portion guidance, and factual explanation cues. It MUST NOT itself
exclude a candidate or relax a hard constraint.

#### Scenario: A lighter-portion intent preserves availability

- **GIVEN** a dish above the remaining calorie allowance
- **WHEN** lighter-portions is active
- **THEN** the dish may still be suggested
- **AND** a smaller portion is offered only when it can be calculated

#### Scenario: Quick has a factual explanation

- **GIVEN** quick prep speed is active and a displayed dish meets the quick-time threshold
- **WHEN** the dish is shown
- **THEN** its explanation includes a cue based on its known effort estimate

#### Scenario: Existing reasons remain visible

- **WHEN** a suggestion clears expiring stock or is affected by dietary filtering
- **THEN** template explanation cues do not replace the existing reason information

### Requirement: Preference controls are progressive and mode-appropriate

The system SHALL present tonight preferences as a secondary, accessible control.
It SHALL not show that control in stretch planning or macro-gap suggestion flows.

#### Scenario: The recommendation requires no action

- **WHEN** the user opens tonight suggestions without tuning
- **THEN** suggestions load using the recommendation or saved preference

#### Scenario: Macro-gap remains focused

- **WHEN** the user opens a macro-gap suggestion flow
- **THEN** no tonight template or prep-speed control is shown

### Requirement: Templates preserve deterministic dietary and urgency safeguards

Dietary exclusion and the use-first constraint SHALL be applied before template
ranking. Unknown nutrition SHALL remain unknown in both template display and
selection logic.

#### Scenario: Every intent retains the use-first requirement

- **WHEN** suggestions are generated under every base intent and prep speed
- **THEN** every displayed eligible suggestion uses an item that needs using first

#### Scenario: An unknown nutrient is not falsified

- **WHEN** a preference needs nutrition information that is unavailable
- **THEN** the interface does not display a zero-value nutrition claim
- **AND** the preference does not remove the dish solely for that absence
