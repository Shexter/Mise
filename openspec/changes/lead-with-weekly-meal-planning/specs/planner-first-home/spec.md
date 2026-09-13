## Purpose

Make scheduled meals the main daily and weekly journey while preserving quick dinner decisions and independent food logging.

## ADDED Requirements

### Requirement: Schedule leads the existing home destination
The system SHALL retain Today, Pantry, Shop and Settings as the four bottom destinations and the shared Add action. Today SHALL lead with scheduled meals and a Day/Week view control, one primary action appropriate to empty/partial/ready state, and access to actual nutrition and history. It SHALL NOT require planning before ordinary logging.

Reconciled with `separate-today-views-and-illustrate-cuisine-chooser`: scheduled meals and actual nutrition are reached through Today's `Meal plan` and `Calories` subpages rather than one vertical scroll, and the Today/Week switch becomes a compact Day/Week view control inside `Meal plan`. Every other requirement in this capability — persistence, grocery, batch, onboarding and acceptance — is unchanged by that follow-up.

#### Scenario: Empty or partial schedule
- **WHEN** a person opens Today's Meal plan page with no scheduled meals or a partial week
- **THEN** Plan your week or Continue planning leads when there is no upcoming meal on the selected day
- **AND** an upcoming scheduled meal takes priority over prompting to fill the rest of the week
- **AND** actual nutrition/history on Calories and the existing Add action remain accessible

#### Scenario: Scheduled day
- **WHEN** meals are scheduled for the selected date
- **THEN** the agenda shows breakfast, lunch, and dinner with the next scheduled meal as its leading action
- **AND** Review groceries opens the existing Shop destination with the selected plan range

### Requirement: Dinner remains an immediate fallback
The system SHALL keep “What's for dinner?” visible as a secondary one-tap action from Today and empty dinner slots. Its existing route and cook/log flow SHALL remain usable without a schedule. A suggestion SHALL enter the planner only after explicit slot confirmation.

#### Scenario: Spontaneous meal
- **WHEN** the person taps What's for dinner from Today without creating a plan
- **THEN** the existing dinner experience opens directly and ordinary cooking/logging remains available

#### Scenario: Fill a dinner slot
- **WHEN** the person chooses a suggestion for a dated slot
- **THEN** a recipe/portion preview is shown before scheduling
- **AND** cancelling leaves the schedule, shopping list, and meal log unchanged

#### Scenario: Dinner provider is unavailable
- **WHEN** dinner generation has no usable provider or fails
- **THEN** its existing recovery remains available and the person can return to local planner recipes or manual logging without losing the schedule

### Requirement: Scheduling does not depend on drag gestures
The system SHALL support drag placement and equivalent labelled tap actions for move, copy, replace and remove. It SHALL preserve readable meal content at large text sizes, screen-reader focus after edits, and reduced-motion behavior.

#### Scenario: Screen-reader user reschedules lunch
- **WHEN** the user selects Move to and chooses another date/meal without dragging
- **THEN** the same conflict checks and saved result apply as for drag placement
- **AND** the resulting date/meal is announced with focus restored to the edited entry

#### Scenario: Narrow screen and large text
- **WHEN** the week is viewed on a narrow phone at enlarged text size
- **THEN** meals remain readable in day sections without requiring seven compressed columns
- **AND** controls and recovery messages remain reachable without clipped actions

### Requirement: Mobile editing preserves context and cancellation
The system SHALL keep the selected date and meal type visible through recipe selection and confirmation. Long recipe selection/guide content SHALL remain scrollable with reachable actions. Move, copy, batch and portion edits SHALL preserve the previous saved state until confirmation and SHALL not trap native Back navigation or stack competing modal tasks.

#### Scenario: Picker returns to the originating slot
- **WHEN** a person opens Choose Monday lunch, previews a recipe and cancels
- **THEN** the system returns to Monday lunch with the original slot unchanged
- **AND** no recipe is scheduled merely by browsing it

#### Scenario: Keyboard is open during portion editing
- **WHEN** a person types a portion value using the on-screen keyboard
- **THEN** the value, validation message and confirmation/cancellation actions remain reachable
- **AND** native Back or dismissal preserves the saved portion unless explicitly confirmed

#### Scenario: Cross-day drag
- **WHEN** a person drops a meal onto another day in the day rail
- **THEN** the system requests that day's breakfast/lunch/dinner destination before saving
- **AND** hovering or auto-scrolling alone does not move the meal

### Requirement: Partial schedules can proceed to a grocery haul
The system SHALL allow people to finish editing any partial week and review groceries without filling all meal slots. The review SHALL show its cooking-date range and provide optional already-owned checks without blocking use of the full list.

#### Scenario: Finish a two-meal plan
- **WHEN** a person selects Done planning after scheduling only two meals
- **THEN** Review groceries remains usable for those meals
- **AND** the system does not treat empty breakfast, lunch or dinner slots as errors

### Requirement: Planner states and nutrition remain distinguishable
The system SHALL distinguish planned, eaten, projected, skipped, to-buy and purchased states in visible and accessible text. Actual nutrition SHALL retain existing Fibre access. Loading SHALL not masquerade as an empty schedule, and persistence failure SHALL not show saved feedback.

#### Scenario: Week is loading or failed to save
- **WHEN** a saved week is loading or an edit fails to persist
- **THEN** the UI shows loading or retry with the preserved draft respectively
- **AND** it does not show a misleading empty-week setup prompt or success message

#### Scenario: Day is finished
- **WHEN** all scheduled meals for the day are logged or skipped
- **THEN** the system offers View week rather than a stale next-meal action
- **AND** actual nutrition, including Fibre, and dinner fallback remain accessible

### Requirement: Mobile appearance supports native use
The system SHALL respect safe areas, keyboard insets, platform Back behavior, supported light/dark themes and enlarged text. Controls SHALL meet minimum platform touch-target sizes and not rely on color alone. Expanded layouts SHALL restructure navigation/content while preserving destination identity.

#### Scenario: Theme and text size change
- **WHEN** a person opens the planner in a supported dark theme or at 200% text size
- **THEN** recipe titles, ingredient amounts, status labels and primary actions remain readable and reachable
- **AND** semantic selection and grocery status remain understandable without color

#### Scenario: Expanded display
- **WHEN** the planner is displayed on a supported tablet or expanded window
- **THEN** the week and selected content use the available space through an adaptive pane layout
- **AND** destination meaning and meal-editing behavior match the compact experience
