## Purpose

Receiving a recipe the user found somewhere else, turning it into something the
app can operate on, and crediting where it came from.

## ADDED Requirements

### Requirement: The system never contacts the source platform

The system SHALL obtain recipe content only from what the user supplies — a
shared payload, pasted text, or an image — and MUST NOT request content from the
platform a link refers to.

The system MUST NOT download, transcribe, or store video or audio from a
platform.

#### Scenario: Saving a link makes no platform request

- **WHEN** a recipe is saved from a link
- **THEN** no request is made to the platform

#### Scenario: No media is retrieved

- **WHEN** a recipe is saved from a link
- **THEN** no video or audio is downloaded or stored

#### Scenario: A link with no accompanying content still saves

- **GIVEN** a shared link carrying no usable text
- **WHEN** it is saved
- **THEN** the recipe is retained with its link
- **AND** the user is offered to supply the content

### Requirement: A recipe can arrive as a link, as text, or as an image

The system SHALL accept a recipe from a shared payload, from pasted text, and
from an image, and MUST NOT require the user to state which kind they have.

#### Scenario: Sharing a post reaches the app

- **WHEN** the user shares a post to the app
- **THEN** the app receives it and offers to save a recipe

#### Scenario: Pasted text is accepted

- **WHEN** the user pastes recipe text
- **THEN** a recipe is extracted from it

#### Scenario: A screenshot is accepted

- **WHEN** the user supplies an image of a recipe
- **THEN** a recipe is extracted from it

#### Scenario: No method choice is demanded

- **WHEN** the user adds a recipe
- **THEN** they are not asked to choose between link, text, and image first

### Requirement: Extraction produces a structured recipe

The system SHALL extract a title, a list of ingredients with quantities and
units where stated, and steps where present.

An ingredient whose quantity is not stated SHALL be recorded without one rather
than with an assumed value.

#### Scenario: Ingredients and quantities are extracted

- **WHEN** recipe content is extracted
- **THEN** its ingredients are returned with quantities where stated

#### Scenario: A missing quantity stays missing

- **WHEN** an ingredient states no quantity
- **THEN** it is recorded without a quantity
- **AND** no quantity is assumed

#### Scenario: Content that is not a recipe is reported

- **WHEN** the supplied content contains no recipe
- **THEN** the user is told
- **AND** no recipe is invented from it

### Requirement: Ingredients resolve to canonical identity

The system SHALL resolve each extracted ingredient through the existing
resolution path, and SHALL surface uncertain matches for the user rather than
applying them.

#### Scenario: An ingredient resolves

- **WHEN** an extracted ingredient names a known ingredient
- **THEN** it resolves to that canonical ingredient

#### Scenario: An uncertain match is confirmed, not assumed

- **WHEN** an extracted ingredient's match is uncertain
- **THEN** the user is asked
- **AND** their answer is learned

#### Scenario: An unresolvable ingredient is kept

- **WHEN** an extracted ingredient resolves to nothing
- **THEN** it is retained as text
- **AND** the recipe remains usable

### Requirement: A saved recipe states what the kitchen is missing

The system SHALL compare a recipe's resolved ingredients against current stock
and SHALL show which are held and which are not.

#### Scenario: Coverage is shown

- **WHEN** a saved recipe is viewed
- **THEN** the ingredients held and the ingredients missing are shown

#### Scenario: Coverage reflects current stock

- **GIVEN** a recipe viewed after stock has changed
- **WHEN** its coverage is shown
- **THEN** it reflects the current stock

#### Scenario: An unresolved ingredient is not claimed as held

- **WHEN** an ingredient could not be resolved
- **THEN** it is not reported as held

### Requirement: Cooking a saved recipe logs a meal and depletes stock

The system SHALL allow a saved recipe to be logged as cooked, creating a meal
and running depletion against the recipe's stated quantities.

The venue SHALL be home, and SHALL NOT be inferred.

#### Scenario: Cooking creates a meal

- **WHEN** the user records having cooked a saved recipe
- **THEN** a meal is logged from it

#### Scenario: Depletion uses stated quantities

- **WHEN** a cooked recipe depletes stock
- **THEN** the stated quantities are used rather than estimated ones

#### Scenario: The venue is not guessed

- **WHEN** a saved recipe is cooked
- **THEN** the meal's venue is home
- **AND** no venue inference is performed

### Requirement: The source is retained and always shown

The system SHALL retain the source link with every saved recipe and SHALL
display it wherever the recipe is shown.

#### Scenario: The link is shown with the recipe

- **WHEN** a saved recipe is displayed
- **THEN** its source link is shown

#### Scenario: The link survives editing

- **WHEN** the user corrects a saved recipe's ingredients
- **THEN** its source link is retained

#### Scenario: A recipe with no link is distinguishable

- **WHEN** a recipe was entered without a source
- **THEN** it is distinguishable from one that has a source

### Requirement: Saved recipes stay on the device

Saved recipes SHALL remain local to the device, and the system MUST NOT
transmit, publish, or aggregate them.

#### Scenario: Nothing is transmitted

- **WHEN** a recipe is saved
- **THEN** its content is not sent anywhere beyond the extraction request the
  user initiated

#### Scenario: Deletion removes everything

- **WHEN** the user deletes all data
- **THEN** saved recipes and any stored images go with it
