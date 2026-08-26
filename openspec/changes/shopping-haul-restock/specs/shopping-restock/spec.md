## Purpose

Allows users checking off purchased grocery items to restock or create matching pantry items with one tap.

## ADDED Requirements

### Requirement: 1-Tap restock action on purchasing shopping items

When a user marks an item as `purchased` on the grocery list, the system SHALL surface a toast action allowing the user to restock or add that item to their pantry stock in one tap.

#### Scenario: User checks off grocery item and taps Restock
- **WHEN** user taps check-off on a shopping list item
- **THEN** a toast confirms the purchase with a "Restock" action button
- **AND** tapping "Restock" marks the matching pantry item as `in_stock` with updated expiry or creates a new `in_stock` pantry row if none exists

### Requirement: Idempotent pantry restock mapping

Restocking from a purchased grocery item SHALL match by `canonicalId` first, updating any existing `running_low` or `out` pantry items to `in_stock` before creating a duplicate pantry record.

#### Scenario: Existing pantry item restocked
- **WHEN** the user restocks a shopping item whose canonicalId already exists in the pantry
- **THEN** the existing pantry item's status is updated to `in_stock` without creating a duplicate row
