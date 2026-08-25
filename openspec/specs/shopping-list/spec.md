# shopping-list Specification

## Purpose
The shopping-list capability turns Mise's pantry and recipe knowledge into an explainable grocery haul that remains local, resilient against corrupted or legacy records, and crash-proof.

## Requirements

### Requirement: Shopping list handles corrupt or legacy categories gracefully

The system SHALL sanitize category records retrieved from database or external state into known categories, falling back to 'other' whenever an unexpected or legacy category is encountered, without crashing or failing to render.

#### Scenario: Legacy or unknown category loaded
- **WHEN** a shopping list item has a category not present in the supported category labels map
- **THEN** the system treats the item's category as 'other'
- **AND** the shopping list view renders successfully without throwing an error

### Requirement: Shopping list load failure resilience

The system SHALL handle any unhandled exceptions during the asynchronous shopping list loading and reconciliation phase by safely resetting loading state and rendering an empty/fallback state rather than crashing the component or app.

#### Scenario: Exception during list refresh
- **WHEN** an error occurs during the shopping list load, refresh plan, or source reconciliation
- **THEN** the system catches the error, marks loading as complete, and displays an empty or fallback state gracefully
