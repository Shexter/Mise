## Purpose

Named objectives for the suggestion engine, so that the question the user has —
eat lighter, eat more, get it done in twenty minutes, clear the fridge — is
stated once rather than re-derived from three dinner ideas.

## ADDED Requirements

### Requirement: The suggestion engine offers a fixed set of named templates

The system SHALL offer a fixed set of named templates, each expressing a
different objective for the same kitchen, and SHALL allow the user to select one.

Exactly one template SHALL be active for a given request. The set SHALL NOT be
user-editable.

#### Scenario: Templates are selectable

- **WHEN** the suggestion surface is shown
- **THEN** the available templates are shown
- **AND** the active one is indicated

#### Scenario: One is active at a time

- **WHEN** the user selects a template
- **THEN** it becomes the active one
- **AND** the previously active one is not also applied

#### Scenario: The set is fixed

- **WHEN** the user browses templates
- **THEN** they cannot create or edit one

### Requirement: The active template defaults from the profile

The system SHALL derive the initially active template from the user's recorded
goal, and SHALL allow it to be changed.

Selecting a template MUST NOT alter the profile, its goal, or any calorie or
macro target.

#### Scenario: A goal produces a starting template

- **GIVEN** a profile with a recorded goal
- **WHEN** the suggestion surface is first opened
- **THEN** a template consistent with that goal is active

#### Scenario: Choosing a template leaves the profile alone

- **WHEN** the user selects a different template
- **THEN** the profile's goal is unchanged
- **AND** the calorie and macro targets are unchanged

#### Scenario: A later change of goal moves the default

- **WHEN** the user changes their goal in the profile
- **THEN** the default template follows it

### Requirement: A template changes ranking and portion, never availability

A template SHALL express itself by weighting the existing ranking and by sizing
the portion offered, and MUST NOT exclude a dish from the results.

#### Scenario: The same kitchen produces different orderings

- **GIVEN** one kitchen
- **WHEN** suggestions are requested under two templates
- **THEN** the results differ

#### Scenario: No dish is withheld by a template

- **WHEN** a dish does not suit the active template
- **THEN** it may still be suggested
- **AND** it is ranked accordingly

#### Scenario: Calorie fit is expressed as a portion

- **GIVEN** a template that favours a lighter meal
- **WHEN** a suggested dish exceeds the remaining allowance
- **THEN** a smaller portion is offered
- **AND** the dish is not withheld

### Requirement: No template may relax the use-first constraint

Every suggestion SHALL use at least one item bucketed for use first, under every
template without exception.

Where the active template cannot be served within that constraint, the system
SHALL return fewer suggestions and say so, and MUST NOT return suggestions that
ignore expiring stock.

#### Scenario: The constraint holds under every template

- **WHEN** suggestions are produced under any template
- **THEN** each uses at least one item that should be used first

#### Scenario: An unservable template returns less, not different

- **GIVEN** a template that cannot be served from the expiring stock
- **WHEN** suggestions are produced
- **THEN** fewer suggestions are returned
- **AND** the user is told why

#### Scenario: Clearing stock is itself a template

- **WHEN** the user wants clearing expiring stock to be the whole objective
- **THEN** a template expressing that is available

### Requirement: Templates describe their bias, never an outcome

Where a template is named or described, the system SHALL describe what it
changes about the suggestions, and MUST NOT state or imply that following it
produces a health, weight, or body-composition outcome.

#### Scenario: A template explains what it does

- **WHEN** a template's description is shown
- **THEN** it describes how suggestions are shaped

#### Scenario: No outcome is promised

- **WHEN** any template is named or described
- **THEN** no weight, health, or body-composition result is claimed

### Requirement: Reason chips are drawn from the active template

Each suggestion's stated reasons SHALL include at least one drawn from what the
active template optimises, in addition to the reasons the engine already gives.

#### Scenario: The reason matches what was asked for

- **GIVEN** an active template
- **WHEN** a suggestion is shown
- **THEN** at least one of its reasons reflects that template's objective

#### Scenario: Existing reasons are not displaced

- **WHEN** a suggestion clears expiring stock
- **THEN** that reason is still shown

### Requirement: Suggestions are cached per template

Cached suggestions SHALL be keyed by the active template, so that a set produced
for one is never shown for another.

#### Scenario: A different template regenerates

- **GIVEN** suggestions cached under one template
- **WHEN** suggestions are requested under another
- **THEN** the cached set is not reused

#### Scenario: The same template reuses its cache

- **GIVEN** suggestions cached under a template
- **WHEN** they are requested again under the same template and the same kitchen
- **THEN** the cached set is reused

#### Scenario: The last choice is remembered

- **WHEN** the user returns to the suggestion surface
- **THEN** the template they last selected is active

### Requirement: Dietary rules apply under every template

Where dietary rules are recorded, they SHALL be applied to suggestions under
every template, and a template MUST NOT cause an excluded suggestion to be shown.

#### Scenario: Exclusion survives the template

- **GIVEN** a recorded allergen
- **WHEN** suggestions are produced under any template
- **THEN** no suggestion containing it is shown

#### Scenario: Ranking and exclusion compose

- **GIVEN** recorded dislikes and an active template
- **WHEN** suggestions are ranked
- **THEN** both the template's weights and the dislike's weight apply
