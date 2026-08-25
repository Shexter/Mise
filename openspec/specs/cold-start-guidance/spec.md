# cold-start-guidance Specification

## Purpose
Guides first-time users and users without configured API keys with safe sample datasets, clear manual intake options, and zero broken or unresponsive screen states.

## Requirements

### Requirement: Keyless discovery banner and safe demo loading

When no vision API key is configured, the system SHALL show an informative, non-blocking discovery card on Today and Settings offering a one-tap Demo Kitchen Data loader and manual logging buttons.

#### Scenario: User opens app without an API key
- **WHEN** the user opens Mise for the first time without an API key
- **THEN** Today shows an option to explore with sample demo data or log foods manually
- **AND** the app never stays on an empty unresponsive skeleton

#### Scenario: Existing user data safety
- **WHEN** the user already has logged meals or pantry items
- **THEN** loading demo data requires explicit confirmation to prevent accidental data mixing

### Requirement: Seamless manual food estimation fallback

When an AI estimation cannot proceed due to a missing or invalid API key, the review screen SHALL immediately offer direct manual entry for dish name and calorie/macro numbers.

#### Scenario: Manual entry transition
- **WHEN** the user navigates to estimate without a key
- **THEN** the screen offers clean numeric fields to log calories and food name manually
