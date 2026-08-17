## Purpose

Lets a user directly ask "what in my kitchen is high in this nutrient,"
independent of any currently displayed shortfall — reusing the existing
pantry-ranking primitive, never routing through the suggestion engine or a
provider request.

## ADDED Requirements

### Requirement: A user can rank in-stock pantry items by any tracked nutrient without a prior shortfall

The system SHALL let a user select any nutrient `CanonicalItem` carries a
per-100g value for, and SHALL rank in-stock pantry items by their measured
contribution to that nutrient, without requiring a logged shortfall for
that nutrient to exist first.

#### Scenario: A directed search runs with no logged deficit

- **GIVEN** the user has not logged any meals today
- **WHEN** the user selects a nutrient to search by
- **THEN** in-stock pantry items are ranked by measured contribution to
  that nutrient

#### Scenario: Fibre becomes a valid search target once catalogue data exists

- **GIVEN** a canonical ingredient with a catalogue-sourced fibre value
- **WHEN** the user searches by fibre
- **THEN** that ingredient's in-stock quantity is ranked by its measured
  fibre contribution

### Requirement: Unmeasurable stock is reported, not silently omitted or scored as zero

The system SHALL indicate when some in-stock pantry items could not be
measured for the selected nutrient, distinct from items that were measured
and contribute nothing.

#### Scenario: Some stock lacks nutrition or quantity data

- **GIVEN** in-stock pantry items where some have no known value for the
  selected nutrient or no measurable quantity
- **WHEN** the search runs
- **THEN** the ranked results include only measurable contributors
- **AND** the surface indicates that some stock could not be measured

### Requirement: The search never invokes a provider request or the suggestion engine

The system SHALL compute directed-search results locally, without a
provider/model call, a suggestion cache entry, or dietary-filtering request
context.

#### Scenario: A directed search works fully offline

- **WHEN** the user runs a directed nutrient search with no network
  connection
- **THEN** ranked results are returned from local pantry and catalogue data

#### Scenario: No cook-this action is offered

- **WHEN** directed search results are shown
- **THEN** no dish, recipe, or cook-this action is presented alongside them
