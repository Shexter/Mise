## Purpose

Enables seamless logging of meals and accurate pantry depletions directly from saved recipe cards into the review flow.

## ADDED Requirements

### Requirement: Pre-filled recipe meal logging flow

The system SHALL allow users on the recipe detail screen to initiate a meal log that opens the meal review screen pre-populated with the recipe's title, ingredients, servings multiplier, and home-cooked venue.

#### Scenario: User cooks a saved recipe
- **WHEN** the user views a ready recipe and taps "Cook & Log Meal"
- **THEN** the review screen opens with the recipe title and its stated ingredients pre-filled
- **AND** the user can adjust meal type, date, and batch servings ($1\times, 2\times, 4\times$) before saving

### Requirement: Stated recipe ingredients drive pantry depletion on log

When a meal logged from a recipe is saved, the system SHALL record the meal with `source: 'recipe'` and decrement pantry stock for all stated recipe ingredients with resolved canonical identities.

#### Scenario: Depletion from cooked recipe
- **WHEN** the user saves a recipe meal from the review screen
- **THEN** a new meal row with `source: 'recipe'` is persisted
- **AND** the corresponding pantry items are decremented according to the servings multiplier
