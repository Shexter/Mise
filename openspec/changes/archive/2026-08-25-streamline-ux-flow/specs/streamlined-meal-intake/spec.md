## Purpose

Provides a fast, low-friction review and intake experience for logging meals with instant one-tap modifiers for meal type, venue, and batch cooking, while preserving strict pantry depletion semantics.

## ADDED Requirements

### Requirement: Fast one-tap modifier chips on meal review

The meal review screen SHALL render meal type (Breakfast/Lunch/Dinner/Snack), venue (Home Cooked/Eating Out), and batch servings ($1\times, 2\times, 4\times$) as compact inline segmented chips visible without opening sub-sheets.

#### Scenario: User toggles venue and batch size in review
- **WHEN** the user is on the meal review screen
- **THEN** they can toggle Home vs. Out and adjust batch servings with a single tap
- **AND** the save button logs the meal immediately without requiring secondary confirmation modals

#### Scenario: Restaurant venue disables batch servings multiplier
- **WHEN** the user selects Eating Out / Restaurant venue
- **THEN** the servings multiplier is locked to 1x and hidden/disabled
- **AND** pantry stock is not decremented (per product decision 11)

### Requirement: Hidden ingredients are advisory and non-blocking

The system SHALL present inferred hidden cooking ingredients (oils, sauces) collapsed with one-tap toggle disclosure, never blocking meal logging.

#### Scenario: User saves a home meal quickly
- **WHEN** the user reviews a meal with inferred hidden ingredients
- **THEN** the primary Log Meal button is immediately actionable without forced interaction
