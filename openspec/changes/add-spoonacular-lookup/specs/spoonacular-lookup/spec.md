## Purpose

An optional live lookup against a third-party food API whose terms forbid
storing what it returns. The whole capability is shaped by that one constraint:
it shows things, and it keeps nothing.

## ADDED Requirements

### Requirement: Nothing the service returns is persisted

The system MUST NOT write data obtained from the service, or any value derived
or transformed from it, to the database, to a file, or to any other durable
store.

#### Scenario: A lookup writes nothing

- **WHEN** a lookup is performed
- **THEN** no row is created or updated in the database
- **AND** no file is written

#### Scenario: A derived value is not persisted either

- **WHEN** a value is computed from a lookup result
- **THEN** it is not persisted

#### Scenario: Closing the app discards results

- **WHEN** the app is closed and reopened
- **THEN** no previous lookup result is available

#### Scenario: Data deletion has nothing to remove

- **WHEN** the user deletes all data
- **THEN** no lookup-derived content exists to remove

### Requirement: A lookup result never populates the app's own records

The system MUST NOT use a lookup result to create or modify a logged meal, a
meal item, a pantry item, a canonical ingredient, an alias, or a dietary rule.

#### Scenario: A meal is not populated from a lookup

- **WHEN** the user views a lookup result and then logs a meal
- **THEN** the meal's figures come from the estimator, the catalogue, or the
  user
- **AND** not from the lookup

#### Scenario: The catalogue is not enriched from a lookup

- **WHEN** a lookup returns nutrition for an ingredient
- **THEN** no canonical ingredient is created or updated from it

#### Scenario: No alias is learned from a lookup

- **WHEN** a lookup names an ingredient
- **THEN** no alias is written

### Requirement: Results are held in memory and expire within the permitted window

Where results are retained to avoid repeat requests, the system SHALL hold them
in memory only, and SHALL discard them no later than the permitted caching
window.

#### Scenario: A repeat lookup within the window makes no request

- **GIVEN** a result retained in memory
- **WHEN** the same lookup is repeated within the window
- **THEN** no request is made

#### Scenario: An expired result is discarded

- **WHEN** the permitted window has passed
- **THEN** the retained result is discarded

#### Scenario: Retention does not survive the process

- **WHEN** the app restarts
- **THEN** nothing retained from a previous session is available

### Requirement: The app is unchanged when the lookup is unavailable

Every existing feature SHALL behave identically when no key is configured, when
the service is unreachable, and when a subscription has lapsed.

#### Scenario: No key changes nothing

- **GIVEN** no key for the service is configured
- **WHEN** the app is used
- **THEN** every existing feature behaves as before
- **AND** the lookup surface explains what it needs

#### Scenario: Offline changes nothing

- **GIVEN** no connection
- **WHEN** the app is used
- **THEN** every existing feature behaves as before

#### Scenario: A lapsed subscription strands nothing

- **GIVEN** access to the service has ended
- **WHEN** the app is used
- **THEN** no stored record is missing, broken, or in need of removal

#### Scenario: No stored record references the service

- **WHEN** stored data is inspected
- **THEN** nothing in it originates from or refers to the service

### Requirement: The user supplies their own credential

The system SHALL require the user to supply their own key for the service, and
MUST NOT include a key in a built application.

The key SHALL be held by the same mechanism as other provider credentials and
SHALL NOT reach the database, logs, or the export.

#### Scenario: The user's own key is used

- **WHEN** a lookup is made
- **THEN** it uses a key the user supplied

#### Scenario: No key ships

- **WHEN** an application is built
- **THEN** it contains no key for the service

#### Scenario: The key stays out of stored data

- **WHEN** data is exported
- **THEN** it contains no key

### Requirement: The service is attributed wherever its results are shown

The system SHALL attribute the service wherever its results are displayed, in
whatever form its terms require.

#### Scenario: Results carry attribution

- **WHEN** a lookup result is displayed
- **THEN** the service is attributed

#### Scenario: The app's own content is not attributed to it

- **WHEN** content from the app's own sources is displayed
- **THEN** it is not attributed to the service

### Requirement: A lookup result is visibly not the app's own data

Where a lookup result is shown alongside the app's own content, the system SHALL
make clear which is which.

#### Scenario: Provenance is visible

- **WHEN** a lookup result appears near the app's own data
- **THEN** the user can tell them apart

#### Scenario: A result is not offered as savable

- **WHEN** a lookup result is displayed
- **THEN** no action is offered that would store it
