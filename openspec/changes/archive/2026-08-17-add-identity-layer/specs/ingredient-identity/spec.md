## Purpose

Defines what a food item *is*, independently of how it was referenced. Gives the
app one row per real-world ingredient so that stock, expiry, spending, and
recipe suggestions all reason about the same thing, and keeps a user's kitchen
free of duplicate entries for the same food.

## ADDED Requirements

### Requirement: Canonical ingredients are the single identity for a food

The system SHALL represent each distinct food concept as exactly one canonical
ingredient, carrying a stable identifier, a display name, a food class, a
default storage location, shelf life figures for unopened and opened states, and
a typical single-use amount where one is meaningful.

Food class SHALL be one of a closed set that determines how the ingredient
depletes. Storage location SHALL be recorded separately from class, because
location determines expiry while class determines depletion.

#### Scenario: A canonical ingredient carries its depletion class

- **WHEN** the canonical ingredient for jasmine rice is read
- **THEN** its class is a staple class, indicating depletion is tracked by mass

#### Scenario: Class and location vary independently

- **WHEN** the canonical ingredient for dried pasta is read
- **THEN** its default location is the pantry and its class is a staple class
- **AND** neither value is derived from the other

#### Scenario: Opened and unopened shelf life are distinct

- **WHEN** the canonical ingredient for light soy sauce is read
- **THEN** it exposes an unopened shelf life for its default location
- **AND** a separate, shorter shelf life that applies once the item is opened

#### Scenario: Seasonings carry a typical use amount

- **WHEN** the canonical ingredient for sesame oil is read
- **THEN** it exposes a typical amount consumed in one use, with a unit

### Requirement: Products resolve to canonical ingredients

The system SHALL represent a specific purchasable SKU as a product, carrying its
barcode where known, brand, package size, and per-100 nutrition where known.
Every product SHALL reference exactly one canonical ingredient. Multiple products
SHALL be able to reference the same canonical ingredient.

A canonical ingredient SHALL be usable without any product, so that unpackaged
foods are represented normally rather than as an exception.

#### Scenario: Two brands of the same food share one canonical ingredient

- **WHEN** products for two different brands of light soy sauce are stored
- **THEN** both reference the same canonical ingredient

#### Scenario: An unpackaged food needs no product

- **WHEN** loose ginger bought without packaging is recorded
- **THEN** it resolves to a canonical ingredient with no associated product
- **AND** no placeholder product is created

### Requirement: Aliases map observed text to canonical ingredients

The system SHALL store alternative names for a canonical ingredient as aliases.
Each alias SHALL record the text as observed, a normalised lookup form, the
channel it came from, and a confidence value.

Aliases SHALL support non-Latin scripts. Text in Chinese, Japanese, Korean, or
other non-Latin scripts SHALL be stored in its original script and MUST NOT be
transliterated into Latin characters.

#### Scenario: Multiple names resolve to one ingredient

- **WHEN** the aliases `醬油`, `간장`, `kecap asin`, and `toyo` are looked up
- **THEN** all four resolve to the same canonical ingredient for soy sauce

#### Scenario: Non-Latin text is preserved in script

- **WHEN** an alias is created from the observed text `醬油`
- **THEN** the stored alias retains the characters `醬油`
- **AND** no romanised form replaces it

#### Scenario: An alias records its origin

- **WHEN** an alias created from a scanned receipt is read
- **THEN** it reports that it originated from the receipt channel

### Requirement: Seed ingredient data is available without network access

The system SHALL ship a seed set of canonical ingredients and aliases as part of
the application, loaded on first launch. The seed set SHALL include coverage of
East and Southeast Asian sauces, pastes, and seasonings alongside common Western
staples.

A newly installed app with no network connection and no API key configured SHALL
still be able to resolve seeded ingredient names.

#### Scenario: Seeded ingredients resolve offline

- **GIVEN** a fresh install with no network connection and no API key
- **WHEN** the name `gochujang` is looked up
- **THEN** it resolves to a canonical ingredient from the seed set

#### Scenario: Asian ingredients are present in the seed set

- **WHEN** the seed set is loaded
- **THEN** canonical ingredients exist for doubanjiang, gochujang, fish sauce,
  oyster sauce, Shaoxing wine, mirin, miso, and belacan

### Requirement: Duplicate canonical ingredients are prevented on creation

The system SHALL check for an existing equivalent canonical ingredient before
creating a new one. Where a sufficiently similar canonical ingredient already
exists, the system SHALL NOT create a second one silently, and SHALL instead
either reuse the existing ingredient or ask the user to confirm they are
distinct.

#### Scenario: A near-duplicate is not created silently

- **GIVEN** a canonical ingredient named "Light soy sauce" exists
- **WHEN** creation of a canonical ingredient named "Soy sauce (light)" is
  attempted
- **THEN** no second canonical ingredient is created without user confirmation

#### Scenario: A genuinely distinct ingredient is allowed

- **GIVEN** a canonical ingredient named "Light soy sauce" exists
- **WHEN** creation of "Dark soy sauce" is attempted and the user confirms they
  are distinct
- **THEN** a separate canonical ingredient is created

### Requirement: Canonical ingredients can be merged

The system SHALL allow a user to merge two canonical ingredients into one. On
merge, every alias and every product referencing the absorbed ingredient SHALL
be repointed at the surviving ingredient, and the absorbed ingredient SHALL no
longer be offered as a match.

Merging SHALL NOT lose aliases: an alias that existed on either ingredient
before the merge SHALL resolve to the surviving ingredient afterwards.

#### Scenario: Aliases survive a merge

- **GIVEN** two canonical ingredients for soy sauce, one with alias `醬油` and
  one with alias `kikko soy`
- **WHEN** the two are merged
- **THEN** both `醬油` and `kikko soy` resolve to the surviving ingredient

#### Scenario: Products follow the merge

- **GIVEN** a product referencing the ingredient that will be absorbed
- **WHEN** the merge completes
- **THEN** that product references the surviving ingredient

#### Scenario: The absorbed ingredient stops appearing

- **WHEN** a merge completes
- **THEN** the absorbed ingredient is not returned as a match candidate for any
  subsequent lookup

### Requirement: Ingredient identity data is covered by data deletion

The system SHALL remove all canonical ingredient, alias, and product data when
the user deletes all application data, leaving no residue that would repopulate
a new session.

#### Scenario: Delete all data clears ingredient identity

- **WHEN** the user chooses to delete all data
- **THEN** stored canonical ingredients, aliases, and products are removed
- **AND** a subsequent launch reloads only the shipped seed set

### Requirement: Displayed names come from canonical ingredients

The system SHALL display the canonical ingredient's own name wherever an
ingredient is shown to the user. Raw text observed from a receipt, a barcode
record, or a vision estimate MUST NOT be shown as an ingredient's name.

#### Scenario: A receipt abbreviation is never displayed

- **GIVEN** a receipt line reading `KIKKO SOY 500ML` resolved to the canonical
  ingredient "Light soy sauce"
- **WHEN** that ingredient appears anywhere in the interface
- **THEN** it is labelled "Light soy sauce"
- **AND** the text `KIKKO SOY 500ML` is not shown as its name
