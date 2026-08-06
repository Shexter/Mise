## Purpose

Seeding the catalogue and its aliases from an externally licensed taxonomy,
without letting a licence obligation arrive unnoticed and without letting a
broad, Euro-centric dataset dilute the entries the app exists for.

## ADDED Requirements

### Requirement: Nothing is incorporated before the licence terms are settled

The system SHALL NOT incorporate content from a share-alike licensed source into
any shipped artefact until the obligations of doing so have been established and
recorded.

Investigating the terms SHALL be permitted before that point. Incorporating
content SHALL NOT.

#### Scenario: No shipped artefact contains the content beforehand

- **GIVEN** the licence obligations have not been recorded
- **WHEN** an application is built
- **THEN** it contains no content derived from that source

#### Scenario: Investigation is allowed

- **WHEN** the licence terms are being established
- **THEN** the source may be examined and measured

#### Scenario: The conclusion is recorded

- **WHEN** the obligations are established
- **THEN** they are recorded with the decision they support

### Requirement: Taxonomy-derived content is identifiable after the fact

Every field seeded from the taxonomy SHALL record that origin, so that the
derived subset can be listed, published, or removed as a whole.

#### Scenario: The derived subset can be listed

- **WHEN** the catalogue is inspected
- **THEN** every taxonomy-derived field can be enumerated

#### Scenario: The derived subset can be removed

- **WHEN** taxonomy-derived content must be withdrawn
- **THEN** it can be removed without disturbing hand-authored content

### Requirement: The hand-authored catalogue stays authoritative

Seeding SHALL fill only empty fields, MUST NOT overwrite a hand-authored value,
and MUST NOT remove an ingredient because the taxonomy lacks it.

#### Scenario: A hand-authored value survives seeding

- **GIVEN** an ingredient with hand-authored fields
- **WHEN** the taxonomy offers different values
- **THEN** the hand-authored values are kept

#### Scenario: An ingredient absent from the taxonomy survives

- **GIVEN** an ingredient the taxonomy does not contain
- **WHEN** seeding runs
- **THEN** it remains in the catalogue with its fields intact

#### Scenario: Only gaps are filled

- **GIVEN** an ingredient with an empty field
- **WHEN** the taxonomy offers a value for it
- **THEN** it is recorded

### Requirement: Seeding is curated, not wholesale

The system SHALL incorporate a selected subset of taxonomy entries, and MUST NOT
import the taxonomy in its entirety.

#### Scenario: Irrelevant entries are not imported

- **WHEN** seeding runs
- **THEN** entries with no application to a home kitchen are not added

#### Scenario: The selection is reviewable

- **WHEN** entries are selected for seeding
- **THEN** the selection is reviewable before it is committed

### Requirement: In-script aliases are seeded in the script they are written in

Where the taxonomy provides a translation in a non-Latin script, the system
SHALL seed it as an alias in that script, and MUST NOT romanise it.

#### Scenario: A non-Latin translation is seeded in script

- **WHEN** the taxonomy provides a non-Latin translation
- **THEN** it is stored as an alias in that script

#### Scenario: No romanised form is produced

- **WHEN** a non-Latin translation is seeded
- **THEN** no romanised form of it is created or stored

#### Scenario: A seeded alias resolves a reference

- **GIVEN** an alias seeded from a translation
- **WHEN** a reference matching it is resolved
- **THEN** it resolves to that ingredient

### Requirement: Seeded aliases carry a confidence appropriate to their origin

A seeded alias SHALL be distinguishable from one confirmed by a user, and its
recorded confidence SHALL reflect that it was imported rather than confirmed.

#### Scenario: A seeded alias is distinguishable

- **WHEN** an alias is seeded from the taxonomy
- **THEN** it is distinguishable from a user-confirmed alias

#### Scenario: A user correction outranks a seeded alias

- **GIVEN** a seeded alias
- **WHEN** the user resolves the same reference differently
- **THEN** the user's resolution takes precedence

### Requirement: The source is attributed wherever its data is shown

Where content derived from the taxonomy is displayed, the system SHALL attribute
its source.

#### Scenario: Displayed derived content is attributed

- **WHEN** taxonomy-derived content is shown
- **THEN** its source is attributed

#### Scenario: Attribution does not follow hand-authored content

- **WHEN** only hand-authored content is shown
- **THEN** no attribution to that source is implied
