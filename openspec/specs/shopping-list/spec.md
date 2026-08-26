# shopping-list Specification

## Purpose
The shopping-list capability turns Mise's pantry and recipe knowledge into an explainable grocery haul that remains local, resilient against corrupted or legacy records, and crash-proof.

## Requirements

### Requirement: The list combines actionable sources

The system SHALL maintain one unified open shopping list whose entries may be sourced from out or running-low pantry items, explicitly missing recipe ingredients, explicitly missing dinner-suggestion ingredients, or manual additions.

#### Scenario: A low pantry item appears once
- **WHEN** a canonical pantry item becomes `out` or `running_low`
- **THEN** one open shopping entry exists for that canonical item
- **AND** its source explains the pantry status

#### Scenario: Multiple sources are deduplicated
- **WHEN** the same canonical ingredient is missing from two recipes and is also running low
- **THEN** the list shows one entry
- **AND** all active sources remain visible

### Requirement: Refresh is conservative and idempotent

The system SHALL refresh automatic sources without duplicating entries and SHALL NOT add an item solely because it is expiring or because a fuzzy match is uncertain.

#### Scenario: Refresh twice
- **WHEN** the same pantry and recipe inputs are refreshed twice
- **THEN** the list contains the same entries and source associations after both refreshes

#### Scenario: Expiry alone does not create a purchase
- **WHEN** an item is expiring but is not out, low, or explicitly required by a recipe or suggestion
- **THEN** no shopping entry is created

### Requirement: Quantities are defensible

The system SHALL present qualitative need states by default and SHALL show measurable quantities only when they are explicitly stated by the user, a recipe, or a confirmed receipt.

#### Scenario: Estimated stock is low
- **WHEN** a pantry item is running low without a stated replenishment amount
- **THEN** the shopping entry says it is running low or needed
- **AND** it does not invent grams, units, or packages

#### Scenario: Recipe states a quantity
- **WHEN** a missing recipe ingredient includes an explicit quantity and unit
- **THEN** the shopping entry may display that quantity and unit

### Requirement: Users can manage entries manually

The system SHALL allow users to add, edit, complete, snooze, dismiss, restore, and remove shopping entries, including unresolved free-text entries without a canonical ID.

#### Scenario: Unresolved manual item
- **WHEN** the user adds a name that cannot be resolved
- **THEN** the entry remains usable as a manual shopping item
- **AND** it is not silently discarded

#### Scenario: Completion is reversible
- **WHEN** the user marks an entry purchased
- **THEN** it leaves the open list or appears in purchased history
- **AND** the user can restore it without changing pantry stock

### Requirement: Recipe and suggestion gaps can be added

The system SHALL offer an action from saved recipe detail and dinner-suggestion review to add only ingredients not covered by current pantry identity and stock.

#### Scenario: Add recipe gaps
- **WHEN** the user chooses Add missing ingredients for a recipe
- **THEN** only uncovered ingredients are added
- **AND** the recipe remains a source of those entries

#### Scenario: Existing stock is covered
- **WHEN** a recipe ingredient is already covered by pantry stock
- **THEN** it is not added as a missing shopping entry

### Requirement: Entries are organized by category

The system SHALL group open entries using the existing food-class/category taxonomy and SHALL support a stable manual ordering without requiring store-specific aisle data.

#### Scenario: Grouped grocery haul
- **WHEN** the list contains produce, pantry, and frozen entries
- **THEN** each category has a distinct section
- **AND** every entry appears in exactly one section

### Requirement: Confirmed receipts reconcile exact matches

The system SHALL reconcile confirmed receipt lines against open shopping entries using exact canonical or barcode identity.

#### Scenario: Exact receipt match
- **WHEN** a confirmed receipt line resolves to the same canonical identity as an open shopping entry
- **THEN** the shopping entry is marked purchased
- **AND** the receipt and line are recorded as completion provenance

#### Scenario: Fuzzy receipt match
- **WHEN** a receipt line is unresolved or only fuzzily resembles an entry
- **THEN** it is not auto-completed
- **AND** the user may handle it manually

### Requirement: Receipt matching is reversible and isolated

The system SHALL provide an undo action for receipt-created shopping completions. Undo SHALL restore the previous shopping status and SHALL NOT reverse confirmed receipt data or pantry effects.

#### Scenario: Undo receipt matches
- **WHEN** the user undoes a receipt match
- **THEN** matched entries return to their prior open state
- **AND** receipt rows and pantry stock remain unchanged

#### Scenario: Receipt processing repeats
- **WHEN** the same receipt is processed again
- **THEN** no duplicate shopping completion is created

### Requirement: Shopping data is local and resettable

The system SHALL work for reading and manual editing without network access, SHALL store no shopping data remotely, and SHALL remove shopping data from Delete all data.

#### Scenario: Offline manual edit
- **WHEN** the device is offline
- **THEN** the user can view, add, edit, and complete shopping entries

#### Scenario: Delete all data
- **WHEN** the user deletes all data
- **THEN** shopping entries, source associations, and receipt-match records are removed

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

### Requirement: Pantry navigation stays uncrowded

The system SHALL expose Shop as a clearly accessible section within the app, providing direct access to items to buy and history without requiring multi-level nested controls.

#### Scenario: Shop subsection
- **WHEN** the user navigates to the shopping list
- **THEN** open items to buy and history toggle are readily accessible
- **AND** header actions remain focused and intuitive

#### Scenario: Today remains focused
- **WHEN** the user opens Today
- **THEN** current-day nutrition, meals, and the primary dinner action remain the main content
- **AND** no redundant shopping lists crowd the daily dashboard
