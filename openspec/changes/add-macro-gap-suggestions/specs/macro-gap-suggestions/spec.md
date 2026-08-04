## Purpose

Turns a macro bar the user is looking at into something they can act on, using
food they already own. The gap is already stated on screen; this answers it.

## ADDED Requirements

### Requirement: A macro shortfall can be acted on from where it is shown

The system SHALL let the user request a suggestion directly from a displayed
macro, and the suggestion SHALL target that macro specifically.

#### Scenario: Acting on a shown shortfall

- **WHEN** the user acts on a displayed macro that is below its target
- **THEN** a suggestion targeting that macro is produced

#### Scenario: The targeted macro is the one acted on

- **GIVEN** several macros are below target
- **WHEN** the user acts on one of them
- **THEN** the suggestion targets that one

#### Scenario: A met target offers nothing to solve

- **WHEN** the user acts on a macro already at or above its target
- **THEN** no shortfall suggestion is produced

### Requirement: Suggestions are drawn from the kitchen

Every suggestion SHALL be composed of ingredients currently in stock, except
where it discloses something as missing.

#### Scenario: Suggestions use owned ingredients

- **WHEN** a suggestion is produced
- **THEN** its ingredients are in the kitchen, or are disclosed as missing

#### Scenario: An empty kitchen produces no false options

- **GIVEN** a kitchen with nothing that supplies the targeted macro
- **WHEN** a suggestion is requested
- **THEN** no suggestion is fabricated from ingredients the user does not have

### Requirement: The answer is scaled to the gap and the time of day

The system SHALL size a suggestion to the shortfall and the hour, offering an
addition or a small item where a whole meal would be inappropriate, and a meal
where one is due.

#### Scenario: A late shortfall is answered by something small

- **GIVEN** a shortfall late in the day, after meals are usually eaten
- **WHEN** a suggestion is produced
- **THEN** it is something small rather than a full meal

#### Scenario: A shortfall at a mealtime may be answered by a meal

- **GIVEN** a shortfall at a time when a meal is usually eaten
- **WHEN** a suggestion is produced
- **THEN** a meal is an acceptable answer

#### Scenario: A small shortfall is not answered by a large dish

- **GIVEN** a shortfall a single item would close
- **WHEN** a suggestion is produced
- **THEN** it is proportionate to the shortfall

### Requirement: Ranking follows the targeted macro, with expiry as a tiebreak

The system SHALL rank candidate ingredients by their contribution to the
targeted macro, and SHALL use approaching expiry to choose between candidates
that contribute comparably.

Expiry MUST NOT override the targeted macro. An expiring ingredient that does
not supply the macro is not an answer to the shortfall.

#### Scenario: Contribution decides before expiry

- **GIVEN** an expiring ingredient low in the targeted macro and a non-expiring
  one high in it
- **WHEN** ranking runs
- **THEN** the higher-contributing ingredient ranks first

#### Scenario: Expiry breaks a tie

- **GIVEN** two ingredients contributing comparably, one expiring sooner
- **WHEN** ranking runs
- **THEN** the sooner-expiring one ranks first

### Requirement: A shortfall the kitchen cannot close is stated as such

Where no combination of available ingredients closes the shortfall, the system
SHALL say so, and MUST NOT present a partial answer in terms that imply the gap
is solved.

Where a suggestion closes part of the gap, the system SHALL state how much.

#### Scenario: An unclosable gap is reported honestly

- **GIVEN** a shortfall larger than the kitchen can supply
- **WHEN** a suggestion is requested
- **THEN** the user is told the kitchen cannot close it

#### Scenario: A partial answer states its contribution

- **WHEN** a suggestion closes part of the shortfall
- **THEN** the amount it contributes is stated

#### Scenario: Partial is not presented as complete

- **WHEN** a suggestion closes part of the shortfall
- **THEN** it is not described in terms implying the shortfall is met

### Requirement: Suggestions are requested, never pushed

The system MUST NOT prompt, notify, or badge the user about a macro shortfall.
Suggestions are produced only when the user asks for them.

#### Scenario: A shortfall raises no prompt

- **GIVEN** a macro well below its target
- **WHEN** the user opens the day view
- **THEN** no prompt, notification, or badge about it appears

#### Scenario: The affordance is available without being insistent

- **WHEN** a macro is below target
- **THEN** acting on it is possible
- **AND** nothing urges the user to

### Requirement: Cooking or eating a suggestion logs it like any other meal

Where the user records that they ate a suggestion, the system SHALL log it
through the established meal path, carrying the ingredients' canonical
identities so stock is debited by identity.

#### Scenario: A suggestion becomes a logged meal

- **WHEN** the user records eating a suggestion
- **THEN** a meal is logged with its ingredients and amounts

#### Scenario: The targeted macro moves

- **WHEN** a suggestion targeting a macro is logged
- **THEN** that macro's figure for the day increases accordingly
