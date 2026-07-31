## Purpose

Turns a raw food reference from any channel — a scanned barcode, a receipt line,
a vision estimate, or a logged meal item — into the one canonical ingredient it
means, cheaply and mostly offline, getting better at it every time it is used.

## ADDED Requirements

### Requirement: Raw references are normalised before lookup

The system SHALL normalise a raw food reference before matching it. Normalisation
SHALL case-fold, remove punctuation, collapse whitespace, strip package size
tokens, strip weight-priced tails, strip known store-brand prefixes, and expand
known retailer abbreviations.

Normalisation MUST NOT transliterate non-Latin scripts.

#### Scenario: A receipt line is reduced to a matchable name

- **WHEN** the reference `KIKKO SOY 500ML` is normalised
- **THEN** the size token `500ML` is removed from the lookup form

#### Scenario: Abbreviations are expanded

- **WHEN** the reference `GRN ONION BNCH` is normalised
- **THEN** the lookup form reads as green onion rather than the abbreviated text

#### Scenario: A weight-priced tail is discarded

- **WHEN** the reference `BANANAS 0.62 LB @ 0.59/LB` is normalised
- **THEN** the price and weight portion is removed from the lookup form

#### Scenario: Non-Latin text survives normalisation

- **WHEN** the reference `醬油` is normalised
- **THEN** the lookup form still contains `醬油`

### Requirement: References resolve through an ordered cascade

The system SHALL attempt to resolve a normalised reference in order of
decreasing certainty and increasing cost: exact barcode match first, then exact
alias match, then approximate alias match, then model-assisted resolution, and
finally proposing a new canonical ingredient.

The system SHALL stop at the first step that produces a result meeting its
confidence bar, and MUST NOT invoke a later, costlier step once an earlier one
has succeeded.

#### Scenario: A barcode short-circuits the cascade

- **GIVEN** a product exists with the scanned barcode
- **WHEN** the barcode is resolved
- **THEN** its canonical ingredient is returned
- **AND** no approximate matching or model call is performed

#### Scenario: An exact alias avoids a model call

- **GIVEN** an alias whose normalised form equals the normalised reference
- **WHEN** the reference is resolved
- **THEN** its canonical ingredient is returned without a model call

### Requirement: The common path requires no network and no API key

The system SHALL resolve barcode matches against cached product data, exact
alias matches, and approximate alias matches entirely on the device.

With no network connection and no API key configured, the system SHALL still
return matches for references resolvable by those steps, and SHALL report the
remainder as unresolved rather than failing the whole operation.

#### Scenario: Matching works offline

- **GIVEN** no network connection and no API key configured
- **WHEN** a set of references containing seeded ingredient names is resolved
- **THEN** the seeded names resolve successfully

#### Scenario: Unresolvable references degrade rather than fail

- **GIVEN** no network connection
- **WHEN** a set of references containing one unknown string is resolved
- **THEN** the known references resolve
- **AND** the unknown reference is reported as unresolved
- **AND** the operation does not report an error

### Requirement: Approximate matches are banded by confidence

The system SHALL assign a confidence score to an approximate match and act on it
by band: accept without asking above an upper threshold, accept but mark for
one-tap user confirmation between the thresholds, and treat as unresolved below
the lower threshold.

Both thresholds SHALL be defined as named, adjustable values rather than
scattered literals, because they require tuning against real data.

#### Scenario: A high-confidence approximate match is accepted silently

- **WHEN** a reference matches an existing alias with confidence above the upper
  threshold
- **THEN** the canonical ingredient is returned
- **AND** the user is not asked to confirm

#### Scenario: A mid-confidence match asks for confirmation

- **WHEN** a reference matches with confidence between the two thresholds
- **THEN** the canonical ingredient is returned
- **AND** the match is flagged for user confirmation

#### Scenario: A low-confidence match falls through

- **WHEN** the best approximate match falls below the lower threshold
- **THEN** no canonical ingredient is returned from that step
- **AND** resolution continues to the next step of the cascade

### Requirement: Resolutions are remembered as aliases

When a reference is resolved by approximate matching, by the model, or by the
user, the system SHALL record the normalised reference as an alias of the
resolved canonical ingredient, so that the identical reference resolves by exact
alias match on any later occasion.

A user confirming or correcting a match SHALL cause the corrected mapping to be
recorded, and the corrected mapping SHALL take precedence on subsequent lookups.

#### Scenario: A resolved receipt string is free the second time

- **GIVEN** the reference `KIKKO SOY 500ML` was resolved by a model call
- **WHEN** the same reference is resolved again
- **THEN** it resolves by exact alias match
- **AND** no model call is made

#### Scenario: A user correction is learned

- **GIVEN** a reference was matched to the wrong canonical ingredient
- **WHEN** the user corrects it to a different ingredient
- **THEN** a later lookup of the same reference returns the corrected ingredient

### Requirement: Ambiguity resolves toward ingredients the user has

Where a reference matches more than one canonical ingredient with comparable
confidence, the system SHALL prefer, in order: an ingredient the user currently
has, then one already opened, then one used more frequently in the user's
history.

The system MUST NOT interrupt meal logging to ask the user which of several
similar ingredients was meant.

#### Scenario: Only one candidate is in the kitchen

- **GIVEN** the user has light soy sauce but not dark soy sauce or tamari
- **WHEN** a logged meal references `soy sauce`
- **THEN** it resolves to light soy sauce

#### Scenario: Opened stock wins over unopened

- **GIVEN** the user has two soy sauces, one opened and one unopened
- **WHEN** a logged meal references `soy sauce`
- **THEN** it resolves to the opened one

#### Scenario: Meal logging is never interrupted by disambiguation

- **GIVEN** several candidate ingredients match a logged meal item
- **WHEN** the meal is logged
- **THEN** a candidate is selected without prompting the user

### Requirement: Model-assisted resolution is batched and context-aware

Where local steps cannot resolve one or more references, the system SHALL
resolve the remaining references in a single batched request rather than one
request per reference.

The request SHALL include the candidate canonical ingredients under
consideration and the ingredients the user currently has, so that resolution is
biased toward the user's actual kitchen.

#### Scenario: One request covers a whole receipt

- **GIVEN** a scanned receipt with several references unresolved locally
- **WHEN** model-assisted resolution runs
- **THEN** exactly one request is made for all of them

#### Scenario: The user's kitchen informs resolution

- **WHEN** model-assisted resolution runs
- **THEN** the request includes the canonical ingredients the user currently has

### Requirement: Unknown foods can become new canonical ingredients

Where no existing canonical ingredient matches, the system SHALL be able to
propose a new one, populated with a display name, food class, default storage
location, shelf life, and typical use amount.

A proposed canonical ingredient SHALL be checked against existing ingredients
for duplication before being created, and SHALL require user confirmation of its
name before it is stored.

#### Scenario: A new ingredient is proposed with usable metadata

- **GIVEN** a reference matching no existing canonical ingredient
- **WHEN** a new canonical ingredient is proposed
- **THEN** the proposal includes a class, a default location, and a shelf life

#### Scenario: A proposal that duplicates an existing ingredient is not created

- **GIVEN** a proposed ingredient sufficiently similar to an existing one
- **WHEN** creation is attempted
- **THEN** the existing ingredient is offered instead of creating a duplicate

### Requirement: Unresolved references are queued, never blocking

The system SHALL record references it could not resolve confidently in a review
queue, retaining the original text and enough context to resolve it later.

An unresolved reference MUST NOT block or abort the operation that produced it.
A scan containing unresolvable lines SHALL still apply every line it did
resolve.

#### Scenario: A partially resolvable receipt still applies

- **GIVEN** a scanned receipt of thirty lines of which three cannot be resolved
- **WHEN** the scan is applied
- **THEN** the twenty-seven resolved lines are applied
- **AND** the three unresolved lines are added to the review queue

#### Scenario: A queued reference retains its context

- **WHEN** a queued reference from a receipt is reviewed later
- **THEN** the original text is shown
- **AND** the context captured at scan time is available

#### Scenario: Resolving a queued reference teaches the matcher

- **GIVEN** a reference in the review queue
- **WHEN** the user resolves it to a canonical ingredient
- **THEN** an alias is recorded so the same reference resolves automatically
  next time
