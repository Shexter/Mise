## Purpose

Let people use meal planning and calorie tracking as separate tasks within Today while preserving dates, drafts, and truthful logged nutrition.

## ADDED Requirements

### Requirement: Today separates Meal plan and Calories

Today SHALL expose subpages labelled exactly `Meal plan` and `Calories`. The selector SHALL remain reachable independently of page scrolling. The four bottom destinations and central Add action SHALL remain available.

#### Scenario: Reach Calories from a long plan

- **WHEN** the user has scrolled down a populated week and selects Calories
- **THEN** Calories displays its own content and scroll position
- **AND** no planner content precedes its calorie and nutrient summaries
- **AND** switching back preserves the planning draft and prior plan scroll position

### Requirement: Date context belongs to the active task

Each subpage SHALL display exactly one date navigator. Meal plan SHALL support future planning dates independently of Calories' historical date context. Every heading and action SHALL name the date actually displayed.

#### Scenario: Future planning does not change actual intake

- **WHEN** a user selects next Tuesday in Meal plan and switches to Calories
- **THEN** Calories retains its valid logged-date context
- **AND** its heading matches its displayed meals
- **AND** returning to Meal plan restores next Tuesday without permitting future meal logging

#### Scenario: Switch to Week

- **WHEN** the user changes Meal plan from Day to Week
- **THEN** only one planning date rail is displayed
- **AND** date selection and accessible move operations remain available

### Requirement: Task completion selects the correct subpage

Explicit navigation following a meal save, plan save, or onboarding handoff SHALL select the corresponding task and date. Transient navigation intent SHALL be consumed once. Existing meal-save and planner-week links SHALL remain compatible.

#### Scenario: A meal is logged from review

- **WHEN** the user confirms a logged meal
- **THEN** Today opens Calories on that meal's actual date and highlights the saved meal
- **AND** planned food is not added to consumed totals
- **AND** a later manual subpage switch is not overridden by a stale save parameter

#### Scenario: A recipe is scheduled

- **WHEN** the user confirms a recipe into a dated slot
- **THEN** Today opens Meal plan on that date
- **AND** the user is not returned to the recipe picker

### Requirement: Ordinary entry restores the selected task

With no explicit navigation intent, Today SHALL restore the last manually selected subpage. Without a stored preference, it SHALL open Meal plan. This presentation preference SHALL not replace date-following or reset behavior.

#### Scenario: A calorie-focused user returns

- **WHEN** a user selects Calories, leaves the app, and later opens Today without task-specific navigation
- **THEN** Calories is selected
- **AND** the existing logged-date following policy determines the displayed date

### Requirement: Calories gives priority to supported summaries

Calories SHALL place its energy summary and fibre, protein, carbohydrate, and fat summaries before meal history and setup banners. At normal text on the 411 dp acceptance phone, these summaries SHALL be visible without scrolling. Large text SHALL reflow without clipping values or hiding actions.

#### Scenario: Incomplete intake or missing target

- **WHEN** a selected day contains unknown nutrient values or lacks a target
- **THEN** the page retains explicit unknown or incomplete states
- **AND** it does not present unknown intake or a missing target as zero
- **AND** a partial subtotal is not presented as a complete daily result

### Requirement: Navigation preserves accessibility and optional planning

The active subpage SHALL expose selected tab semantics. Hidden page content SHALL not receive accessibility focus. Planning SHALL remain optional and errors loading a plan SHALL not block calorie tracking.

#### Scenario: Plan loading fails

- **WHEN** a plan fails to load and the user selects Calories
- **THEN** calorie tracking remains usable
- **AND** the plan's retry state and unsaved edits remain intact
