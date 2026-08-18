## Purpose

Records fibre, vitamin C, iron, vitamin B12, calcium, folate, vitamin A, and
potassium per canonical ingredient from FoodData Central — the same
build-time catalogue that already supplies calories and macros — with the
same nullable-not-zero discipline, and upgrades fibre from a vision-only
estimate to a catalogue-backed value.

## ADDED Requirements

### Requirement: Eight nutrients are recorded per canonical ingredient where FoodData Central has a value

The system SHALL record, per canonical ingredient, a nullable per-100g value
for fibre, vitamin C, iron, vitamin B12, calcium, folate, vitamin A, and
potassium, sourced from the same FoodData Central response already fetched
for calories and macros.

A nutrient FoodData Central has no value for SHALL remain unknown rather
than defaulting to zero.

#### Scenario: A resolved response carries all eight nutrients

- **WHEN** the catalogue build processes an ingredient whose FoodData
  Central entry reports all eight nutrients
- **THEN** the canonical ingredient records a value for each

#### Scenario: FoodData Central omits a nutrient for a food

- **WHEN** an ingredient's FoodData Central entry has no value for one of
  the eight nutrients
- **THEN** that nutrient remains unknown on the canonical ingredient
- **AND** it is not recorded as zero

### Requirement: Fibre is sourced from the catalogue ahead of the text-only fallback

The system SHALL treat catalogue-sourced fibre as more authoritative than
the existing text-only nutrition fallback, and less authoritative than
resolved product or receipt nutrition, when deriving a meal item's fibre.

#### Scenario: A resolved ingredient with catalogue fibre no longer falls back to text

- **WHEN** a meal item resolves to a canonical ingredient that has a
  catalogue-sourced fibre value
- **AND** no product or receipt nutrition applies
- **THEN** the meal item's fibre is the catalogue value
- **AND** the text-only fallback is not used

#### Scenario: Product nutrition still outranks the catalogue

- **WHEN** a meal item resolves to a barcode product with its own fibre
  value
- **AND** the underlying canonical ingredient also has a catalogue fibre
  value
- **THEN** the meal item's fibre is the product's value, not the catalogue's

### Requirement: Each nutrient records its own provenance

The system SHALL record, per canonical ingredient and per nutrient field
introduced by this change, which source supplied its value — reusing the
existing per-field provenance mechanism rather than a new one.

#### Scenario: A catalogue refresh does not overwrite a hand-authored value

- **GIVEN** a canonical ingredient with a hand-authored value for one of the
  eight nutrients
- **WHEN** the catalogue is rebuilt from FoodData Central
- **THEN** the hand-authored value is kept
- **AND** the dataset's differing value is reported, not applied

#### Scenario: A first-time build fills a previously empty field

- **GIVEN** a canonical ingredient with no value for one of the eight
  nutrients
- **WHEN** the catalogue build finds a value in FoodData Central
- **THEN** the field is filled
- **AND** its source is recorded as the dataset
