## Purpose

Building the canonical catalogue from open datasets instead of from guesses,
without letting a dataset overwrite the entries that make the app worth using,
and without letting a food safety source turn into safety advice.

## ADDED Requirements

### Requirement: Open datasets are consumed at build time, never at runtime

The system SHALL incorporate open dataset content into the shipped catalogue
through a build-time process, and MUST NOT request either dataset from the
running app.

No credential for an open dataset SHALL be included in a built application.

#### Scenario: The running app makes no dataset request

- **WHEN** the app predicts an expiry or reads an ingredient's nutrition
- **THEN** no network request is made to an open dataset

#### Scenario: No dataset credential ships

- **WHEN** an application is built
- **THEN** it contains no API key for an open dataset

#### Scenario: The catalogue is a reviewed artefact

- **WHEN** the catalogue is regenerated
- **THEN** the change to the shipped asset is reviewable before it is committed

### Requirement: Only unencumbered sources are incorporated

The system SHALL incorporate only sources whose licence imposes no share-alike
obligation on the shipped catalogue, and SHALL record each source and its
licence terms alongside the data.

#### Scenario: A source's terms are recorded

- **WHEN** a source contributes data to the catalogue
- **THEN** that source and its licence are recorded

#### Scenario: An attribution-only source is incorporated

- **GIVEN** a government dataset permits reuse with attribution and imposes no share-alike obligation
- **WHEN** it contributes a reviewed value to the catalogue
- **THEN** the catalogue records the source and required attribution beside the data

#### Scenario: A share-alike source is not incorporated here

- **WHEN** a source carries a share-alike obligation
- **THEN** it is not incorporated by this process

### Requirement: A shelf-life range sets both the expiry date and the early warning

Where a source gives a shelf-life range, the system SHALL use the upper bound as
the predicted expiry and the lower bound as the point from which the item is
treated as approaching expiry.

The system MUST NOT flatten a range to a single figure, and MUST NOT invent a
midpoint.

#### Scenario: The upper bound sets the expiry

- **GIVEN** an ingredient whose source gives a shelf-life range
- **WHEN** its expiry is predicted
- **THEN** the prediction uses the upper bound

#### Scenario: The lower bound opens the early warning

- **GIVEN** an ingredient whose source gives a shelf-life range
- **WHEN** the lower bound has passed and the upper bound has not
- **THEN** the item is treated as approaching expiry
- **AND** it is not treated as most urgent

#### Scenario: The most urgent group follows the upper bound

- **WHEN** an item passes into the most urgent group
- **THEN** that transition is driven by the upper bound

#### Scenario: A single-figure source behaves as before

- **GIVEN** an ingredient whose shelf life is a single figure
- **WHEN** its expiry is predicted
- **THEN** the behaviour is unchanged

### Requirement: A non-numeric storage term produces no figure

Where a source expresses a storage duration as a term rather than a duration —
indefinite, until ripe, not recommended — the system SHALL NOT convert it into a
number of days.

#### Scenario: An indefinite term yields no expiry

- **GIVEN** a source stating storage is indefinite
- **WHEN** the catalogue is built
- **THEN** no shelf-life figure is recorded for that location

#### Scenario: A not-recommended term is not a zero

- **GIVEN** a source stating a storage method is not recommended
- **WHEN** the catalogue is built
- **THEN** no shelf-life figure is recorded for that location
- **AND** it is not recorded as zero days

#### Scenario: Absence produces no claim

- **WHEN** an ingredient has no shelf-life figure for a location
- **THEN** no expiry is predicted for an item stored there

### Requirement: Every catalogue field records where it came from

The system SHALL record, per field, whether its value came from an open dataset
or was authored by hand, and which dataset.

#### Scenario: A dataset-derived value is attributable

- **WHEN** a field's value came from a dataset
- **THEN** that dataset is recorded against the field

#### Scenario: A hand-authored value is distinguishable

- **WHEN** a field was authored by hand
- **THEN** it is distinguishable from a dataset-derived value

### Requirement: A refresh never overwrites or removes hand-authored content

Where the catalogue is rebuilt, the system SHALL preserve hand-authored field
values, and MUST NOT remove an ingredient because a dataset does not contain it.

#### Scenario: A hand-authored figure survives a refresh

- **GIVEN** an ingredient with a hand-authored shelf life
- **WHEN** the catalogue is rebuilt and a dataset offers a different figure
- **THEN** the hand-authored figure is kept

#### Scenario: An ingredient absent from every dataset survives

- **GIVEN** an ingredient present in no open dataset
- **WHEN** the catalogue is rebuilt
- **THEN** it remains in the catalogue with its fields intact

#### Scenario: A dataset fills only what is empty

- **GIVEN** an ingredient with no recorded shelf life
- **WHEN** a dataset offers one
- **THEN** it is recorded

#### Scenario: A conflict is surfaced, not resolved silently

- **WHEN** a dataset value differs from a hand-authored one
- **THEN** the difference is reported during the build

### Requirement: A dataset row reaches an ingredient through the existing matcher

The system SHALL resolve a dataset row to a canonical ingredient using the
existing resolution path, and MUST NOT apply an uncertain match without review.

#### Scenario: A confident match is applied

- **WHEN** a dataset row resolves confidently to an ingredient
- **THEN** its values are applied to that ingredient

#### Scenario: An uncertain match waits for review

- **WHEN** a dataset row's match is uncertain
- **THEN** its values are not applied
- **AND** the row is reported for review

#### Scenario: No second matcher is introduced

- **WHEN** dataset rows are matched
- **THEN** the existing resolution path is used

### Requirement: Ingredient nutrition is available without a photograph

The system SHALL make calories and macronutrients available per canonical
ingredient where a source provides them, so that a quantity of an ingredient can
be given a nutritional figure with no model call.

A figure derived from a photograph of an actual meal SHALL take precedence over
a table figure for the ingredient.

#### Scenario: A manual quantity gets a figure

- **GIVEN** an ingredient with recorded nutrition
- **WHEN** a quantity of it is entered by hand
- **THEN** calories and macros are available for it
- **AND** no model call is made

#### Scenario: A photograph still wins

- **GIVEN** a meal estimated from a photograph
- **WHEN** its items also exist in the catalogue with recorded nutrition
- **THEN** the estimate from the photograph is used

#### Scenario: Missing nutrition is unknown, not zero

- **WHEN** an ingredient has no recorded nutrition
- **THEN** its figures are unknown
- **AND** they are not reported as zero

#### Scenario: Missing nutrition is explained

- **GIVEN** a user selects a catalogue ingredient whose nutrition is wholly unavailable
- **WHEN** automatic nutrition cannot be calculated
- **THEN** the manual-entry screen explains that catalogue nutrition is unavailable
- **AND** it invites the user to enter the figures manually

### Requirement: Expiry is described as quality, never as safety

Where the system describes an expiry, a shelf life, or an urgency, it SHALL
describe expected quality, and MUST NOT state or imply that food is safe,
unsafe, or safe to eat until a date.

#### Scenario: Expiry language stays about quality

- **WHEN** a predicted expiry is shown
- **THEN** it is described in terms of expected quality

#### Scenario: No safety claim is made

- **WHEN** any expiry, shelf life, or urgency is described
- **THEN** no claim about safety is made

#### Scenario: The figure's origin is available

- **WHEN** the user asks where a shelf-life figure came from
- **THEN** its source is shown
