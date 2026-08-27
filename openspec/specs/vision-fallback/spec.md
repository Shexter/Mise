# vision-fallback Specification

## Purpose
Provides graceful fallback, live retry countdown feedback, and smooth manual intake transitions when AI vision requests encounter rate limits or temporary server errors.

## Requirements

### Requirement: Live retry countdown during rate limit pauses

When a vision provider returns a rate limit response with a required delay (HTTP 429), the review screen SHALL display a real-time countdown indicator of the remaining wait time with a cancel action.

#### Scenario: User waits for automatic retry
- **WHEN** estimation is paused for a provider rate limit delay
- **THEN** the screen displays "Waiting X seconds for quota reset..."
- **AND** the user can cancel the wait at any moment to return to manual logging

### Requirement: Automatic lighter model tier fallback

When a primary vision model is quota-exhausted or rate-limited, the system SHALL attempt one fallback to an available lighter model tier (e.g. Gemini 2.5 Flash $\rightarrow$ Gemini 2.5 Flash Lite) before surfacing a hard error.

#### Scenario: Fallback model succeeds
- **WHEN** primary model returns 429 or quota limit
- **THEN** transport retries with the designated fallback model tier
- **AND** if successful, the meal estimate is returned seamlessly

### Requirement: Direct handoff to manual logging preserving capture

If all vision retries and fallbacks are exhausted, the review screen SHALL offer a 1-tap "Log Manually" button that retains the captured photo and allows direct calorie and dish entry without restarting from the camera.

#### Scenario: Transition to manual after failure
- **WHEN** vision estimate fails
- **THEN** user taps "Log Manually"
- **AND** the photo remains attached to the draft meal with editable text fields
