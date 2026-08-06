## Purpose

Arrives at the review screen with the right venue already selected, so the user
usually changes nothing. It never takes the choice away — it removes the need to
make it.

## ADDED Requirements

### Requirement: A known venue is used directly, never inferred

Where the system already knows how a meal came to exist, it SHALL use that venue
and MUST NOT run inference for it.

A meal logged by cooking a suggestion SHALL be recorded as cooked at home.

#### Scenario: Cooking a suggestion is not a guess

- **WHEN** a meal is logged by cooking a suggestion
- **THEN** its venue is home
- **AND** no inference is performed

#### Scenario: A known venue is not overridden by a signal

- **GIVEN** a meal whose venue is known from how it was created
- **WHEN** signals would suggest otherwise
- **THEN** the known venue stands

#### Scenario: A known venue teaches nothing

- **WHEN** a meal's venue is known rather than inferred
- **THEN** no learned per-dish default is recorded from it

### Requirement: A venue is preselected for every logged meal

The system SHALL select a venue before the user reaches the review screen, and
SHALL present it as a normal, changeable selection.

The user SHALL be able to change it in a single action, and their choice SHALL
always take precedence over the guess.

#### Scenario: The review screen arrives with a venue chosen

- **WHEN** a meal reaches review
- **THEN** a venue is already selected

#### Scenario: Changing it takes one action

- **GIVEN** a preselected venue
- **WHEN** the user selects a different one
- **THEN** it changes immediately

#### Scenario: The user's choice always wins

- **GIVEN** the user has changed the venue
- **WHEN** the meal is committed
- **THEN** their choice is used, not the guess

### Requirement: A guess is never applied without being shown

The system MUST NOT commit a meal, or debit any stock, on an inferred venue the
user has not been shown.

#### Scenario: Nothing is debited on an unseen inference

- **WHEN** a venue is inferred
- **THEN** no stock moves until the user has seen the selection and committed

#### Scenario: The guess is visible, not implicit

- **WHEN** a meal reaches review
- **THEN** the selected venue is legible on screen

### Requirement: The estimator contributes a venue guess within the existing request

The system SHALL request a venue assessment as part of the meal estimate it
already makes, and MUST NOT make a separate request to obtain one.

A response omitting the assessment SHALL remain a valid estimate.

#### Scenario: No extra request is made

- **WHEN** a meal is estimated
- **THEN** exactly one request is made
- **AND** it carries both the estimate and the venue assessment

#### Scenario: An omitted assessment does not fail the estimate

- **WHEN** an estimate returns no venue assessment
- **THEN** the meal is still estimated normally
- **AND** the venue falls back to the other signals

### Requirement: Local signals refine the guess

The system SHALL consider, in addition to the estimator's assessment, how much
of the meal is drawn from ingredients currently in stock, and whether an earlier
batch of the same dish has portions still outstanding.

These signals SHALL be computed on the device from data already recorded.

#### Scenario: A meal made entirely from stock leans home

- **GIVEN** a meal whose ingredients are all in the pantry
- **WHEN** a venue is inferred
- **THEN** home is favoured

#### Scenario: A meal matching nothing in stock leans out

- **GIVEN** a meal whose ingredients match nothing in the pantry
- **WHEN** a venue is inferred
- **THEN** eating out is favoured

#### Scenario: An outstanding batch offers leftovers

- **GIVEN** a dish logged recently as making several servings, with portions
  unaccounted for
- **WHEN** the same dish is logged again
- **THEN** leftovers is favoured

#### Scenario: A fully-consumed batch stops offering leftovers

- **GIVEN** a batch whose portions have all been logged
- **WHEN** the same dish is logged again
- **THEN** leftovers is not favoured on that basis

### Requirement: An uncertain guess favours cooking at home

Where the signals do not agree or none is strong, the system SHALL select home.

#### Scenario: Conflicting signals resolve to home

- **WHEN** the available signals disagree
- **THEN** home is selected

#### Scenario: No signal at all resolves to home

- **GIVEN** a meal with no photograph and no matching stock
- **WHEN** a venue is inferred
- **THEN** home is selected

### Requirement: Corrections teach the default for that dish

Where the user changes the venue for a dish, the system SHALL remember that
choice for the same dish and favour it next time.

A learned default SHALL still be overridable, and SHALL not override a strong
contrary signal without being visible.

#### Scenario: A corrected dish guesses correctly next time

- **GIVEN** a dish the user has corrected to eating out
- **WHEN** the same dish is logged again
- **THEN** eating out is preselected

#### Scenario: A learned default is still changeable

- **WHEN** a learned default is preselected
- **THEN** the user can change it as normal

### Requirement: The servings control follows the venue

Where the selected venue is not cooking at home, the system SHALL not apply a
servings multiplier, consistent with decision 51.

#### Scenario: Leftovers carry no multiplier

- **WHEN** leftovers is selected
- **THEN** no servings multiplier is applied

#### Scenario: Changing venue away from home clears the multiplier

- **GIVEN** a servings figure entered for a home-cooked meal
- **WHEN** the user changes the venue to eating out
- **THEN** no multiplier is applied
