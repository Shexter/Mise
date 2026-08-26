## Purpose

Allows users checking off purchased groceries to add distinct physical containers to pantry stock with one tap and undo the complete operation safely.

## ADDED Requirements

### Requirement: 1-Tap restock action on purchasing shopping items

When a user marks an item as `purchased` on the grocery list, the system SHALL surface a toast action allowing the user to restock or add that item to their pantry stock in one tap.

#### Scenario: User checks off grocery item and taps Restock
- **WHEN** user taps check-off on a shopping list item
- **THEN** a toast confirms the purchase with a "Restock" action button
- **AND** tapping "Restock" creates a new `in_stock` pantry row when the item has a resolved canonical identity

#### Scenario: Unresolved grocery item cannot be restocked automatically
- **WHEN** a purchased shopping item has no resolved canonical identity
- **THEN** the purchase remains undoable
- **AND** the system SHALL NOT offer automatic pantry creation for that item

### Requirement: One purchased container creates one pantry row

Restocking from a purchased grocery item SHALL create a new pantry row for the newly purchased physical container. The system SHALL use the canonical default storage location when available, SHALL derive predicted expiry from that location, and SHALL NOT copy the shopping list's requested quantity into pantry stock as a claimed purchased quantity.

#### Scenario: Existing pantry containers remain distinct
- **WHEN** the user restocks a shopping item whose canonical identity already exists in the pantry
- **THEN** the system creates one new `in_stock` pantry row
- **AND** matching `out` rows are marked `replaced`
- **AND** matching `running_low` and `in_stock` rows remain unchanged

### Requirement: Restock is fully undoable from its success toast

After a restock succeeds, the system SHALL offer an Undo action that atomically returns the shopping item to its previous status, removes the pantry row created by that restock, and restores every pantry row that restock changed from `out` to `replaced`.

#### Scenario: User undoes a completed restock
- **WHEN** the user taps Undo on the restock success toast
- **THEN** the shopping item returns to its pre-purchase status
- **AND** the newly created pantry row is removed
- **AND** each pantry row reconciled by that operation returns to `out`
