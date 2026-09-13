## Purpose

Provide a bounded, usable recipe collection for weekly planning with explicit ingredient, yield, dietary and nutrition evidence.

The picker's appearance, cuisine control and preview-before-scheduling composition are reconciled by `separate-today-views-and-illustrate-cuisine-chooser`'s `illustrated-cuisine-chooser` capability. Everything this capability requires about availability, evidence and snapshot stability continues to hold there.

## ADDED Requirements

### Requirement: Planning recipes are available without pantry or provider setup
The system SHALL offer local meal-type and cuisine filtering, repeat selections, and saved recipes without requiring network access, an API key, or pantry stock. The starter collection SHALL contain at least three distinct reviewed options per meal type, including no-cook breakfast and Asian cuisine coverage; a recipe can belong to multiple meal types.

#### Scenario: Empty pantry offline
- **WHEN** a new user opens the picker offline with no key or pantry
- **THEN** breakfast, lunch, and dinner each offer local choices with yield, ingredients and cooking guidance
- **AND** missing pantry stock does not hide those recipes

#### Scenario: Cuisine filter has no eligible result
- **WHEN** no compatible recipe matches the selected cuisine
- **THEN** the picker explains the empty result and offers clearing the cuisine filter or selecting a saved recipe
- **AND** no generated or placeholder recipe is presented as reviewed content

#### Scenario: Every ingredient must be purchased
- **WHEN** a person chooses a recipe whose required ingredients are all absent from their pantry
- **THEN** the recipe remains selectable and schedulable for the grocery haul
- **AND** the planner does not impose the dinner engine's pantry-coverage, use-first or missing-ingredient constraints
- **AND** the accepted ingredients become grocery requirements

### Requirement: Recipe claims have reviewable evidence
The system SHALL retain stated yield, ingredient quantities/units/preparation basis, optional inclusion, nutrient provenance, and cooking instructions. Resolved dietary conflicts SHALL exclude candidates from compatible suggestions; unresolved ingredients or equipment SHALL be marked unverified instead of assumed compatible. Omission of an optional ingredient SHALL update both nutrition and groceries.

#### Scenario: Sauce conflicts with dietary preference
- **WHEN** a recipe contains a resolved excluded ingredient inside a sauce or optional garnish
- **THEN** a broad cuisine or dietary tag does not override the conflict
- **AND** compatibility requires explicit omission of any removable conflicting ingredient

#### Scenario: Saved recipe is incomplete
- **WHEN** a saved recipe lacks a yield, quantity, conversion, or nutrient value
- **THEN** the person can review it or schedule it with incomplete results disclosed
- **AND** unknown values never become invented amounts or zero nutrition

### Requirement: Scheduled recipes are stable snapshots
The system SHALL retain the accepted recipe version in scheduled meals. Source changes or deletion SHALL not silently alter their ingredients, instructions, nutrition, or grocery demand. Applying an update SHALL require a preview.

#### Scenario: Original recipe changes
- **WHEN** a saved recipe is edited or deleted after scheduling
- **THEN** the scheduled snapshot remains readable and unchanged
- **AND** an explicit recipe update previews nutrition and shopping effects before acceptance
