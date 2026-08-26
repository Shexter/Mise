## Purpose

Enables fast one-tap logging of previous meals and user-favorited dishes, cutting repetitive meal logging overhead while strictly respecting leftover and depletion rules.

## ADDED Requirements

### Requirement: Favorite meal toggle and frequent meal querying

The system SHALL allow users to mark any logged meal as a favorite and query the user's top frequent and pinned meals for quick selection.

#### Scenario: User favorites a meal
- **WHEN** the user views a meal in meal detail and taps the favorite star
- **THEN** the meal is marked as a favorite in SQLite
- **AND** it appears in the favorites quick-log list

### Requirement: Quick re-log modal / sheet

The system SHALL provide a "Recent & Favorite Meals" sheet accessible from Today and manual logging that displays meals with dish names, calories, and last logged dates.

#### Scenario: User re-logs a meal from sheet
- **WHEN** the user taps a previous meal card
- **THEN** the review flow opens with the meal's items and macros pre-populated for today
- **AND** the user can choose whether this is a fresh cook (`venue: 'home'`) or leftovers (`venue: 'leftovers'`) before saving

### Requirement: Leftovers re-log prevents duplicate depletions

When a past home-cooked meal is re-logged with `venue: 'leftovers'`, the system SHALL record the calories and macros while debiting 0 grams / 0 uses from pantry stock (per Decision 51).

#### Scenario: Leftovers re-logged
- **WHEN** user re-logs a meal as leftovers
- **THEN** calories and macros are attributed to today
- **AND** pantry stock is not decremented
