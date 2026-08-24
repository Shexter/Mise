## Purpose

Provides a gesture-driven swipeable card deck for choosing and logging target-compliant meals for lunch and dinner based on on-hand pantry stock and remaining calories.

## ADDED Requirements

### Requirement: Swipeable Meal Suggestion Card Deck
The system SHALL present meal suggestions as an interactive stack of cards supporting left swipe (pass), right swipe (accept/cook), upward swipe or tap (cooking outline details), and tap-based undo.

#### Scenario: Swiping right to accept meal
- **WHEN** the user drags a meal card to the right beyond the width-relative decision threshold ($\ge 35\%$ card width or high velocity)
- **THEN** the system triggers a single haptic feedback pulse and opens the cooking confirmation sheet for that dish without discarding the card until the save succeeds.

#### Scenario: Cancelling cooking confirmation
- **WHEN** the user dismisses the cooking confirmation sheet without saving
- **THEN** the card remains in front of the suggestion deck.

#### Scenario: Swiping left to pass meal
- **WHEN** the user drags a meal card to the left beyond the pass threshold
- **THEN** the system dismisses the top card with an exit transition, adds it to the undo stack, and brings the next candidate meal card to the front of the stack.

#### Scenario: Tapping undo
- **WHEN** the user taps the undo button after passing a card
- **THEN** the previously passed card is animated back to the front of the stack.

#### Scenario: Exhausting the deck
- **WHEN** the user passes all cards in the current suggestion deck
- **THEN** the system displays an empty-deck view with options to reload fresh suggestions, adjust dietary intents, or start manual meal logging.

### Requirement: Calorie Target and Macro Budget Compliance
Every suggested meal card in the deck SHALL display its calorie and macronutrient breakdown and indicate its fit relative to the user's remaining daily calorie allowance.

#### Scenario: Suggested meal fits within remaining calories
- **WHEN** a suggested dish has calories less than or equal to the remaining daily target
- **THEN** the card displays a green badge confirming that it fits the remaining daily budget with exact calories and protein.

#### Scenario: Suggested meal exceeds remaining calories
- **WHEN** a suggested dish exceeds the remaining daily target
- **THEN** the card displays the calorie count and a neutral badge indicating the excess calorie delta without hiding or disabling the card.

#### Scenario: Missing catalog nutrient data
- **WHEN** a suggested dish has ingredients lacking catalog nutritional data
- **THEN** the calorie count is labelled as "Estimated" rather than claiming a guaranteed fit.

### Requirement: Dual Serving Portion Control
The cooking confirmation sheet SHALL distinguish between total batch yield and individual consumed portion.

#### Scenario: Logging batch cooked meal
- **WHEN** a user cooks a multi-serving batch of a suggestion
- **THEN** the system decrements pantry stock based on `servingsMade` and logs consumed calories to the daily diary based on `servingsEaten`.

### Requirement: Expanded Cooking Outline and Stock Breakdown
The system SHALL allow expanding the active card into a cooking outline sheet showing held pantry ingredients, missing items, and step-by-step instructions.

#### Scenario: Expanding card details
- **WHEN** the user swipes up or taps the details button on the top card
- **THEN** the system opens an expandable sheet displaying all required ingredients with held vs missing status and preparation steps.
