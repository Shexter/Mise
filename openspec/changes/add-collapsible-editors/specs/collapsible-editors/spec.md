## ADDED Requirements

### Requirement: Repeated add/edit items are compact by default
The system MUST render repeated user-created or user-correctable items as
compact summary rows by default, with the primary identity visible and detail
fields hidden until disclosure.

#### Scenario: Pantry list opens compactly
- **WHEN** a pantry add/edit surface contains multiple ingredient records
- **THEN** each record shows its ingredient identity and an expand affordance
- **AND** quantity, unit, location, expiry, and secondary metadata are not
  shown in the collapsed body.

### Requirement: Detail disclosure is explicit and reversible
The system MUST expand an item only after the user activates its summary row,
and MUST restore the same draft values when the item is collapsed and reopened.

#### Scenario: User edits one ingredient
- **WHEN** the user taps an ingredient summary
- **THEN** its editable detail fields become visible
- **AND** tapping it again hides those fields without discarding edits.

### Requirement: Repeated lists avoid unnecessary simultaneous expansion
The system MUST keep at most one repeated editor expanded at a time unless the
surface declares a comparison exception.

#### Scenario: User moves to another item
- **WHEN** one item is expanded and the user opens a different item
- **THEN** the first item collapses and the second item expands
- **AND** the first item's draft remains available when reopened.

### Requirement: New entries support immediate entry
The system MUST initially expand a newly created item when the next action is
to enter its details, while existing items remain collapsed by default.

#### Scenario: Add a pantry item
- **WHEN** the user creates a new pantry row
- **THEN** the new row opens ready for entry
- **AND** previously saved rows remain compact.

### Requirement: Disclosure is accessible and motion-safe
Every summary row MUST expose its expanded state to assistive technology,
maintain a usable touch target, and support reduced-motion behavior.

#### Scenario: Screen reader and reduced motion
- **WHEN** a screen reader focuses a collapsed row
- **THEN** it announces the primary identity and that the row is collapsed
- **AND WHEN** reduced motion is enabled, disclosure changes without a required
  animation.

### Requirement: Validation and keyboard state survive disclosure
The system MUST NOT discard dirty or invalid edits when a row collapses, and
the active keyboard field MUST remain visible when its row expands.

#### Scenario: Invalid quantity is temporarily collapsed
- **WHEN** the user enters an invalid quantity and collapses the row
- **THEN** the draft and validation state remain intact
- **AND** reopening the row shows the same input and error.

### Requirement: Accepted receipts remain reviewable
The system MUST provide a receipt history entry point for accepted and
discarded receipt records, preserving the original receipt photo and extracted
lines for later inspection without reapplying pantry changes.

#### Scenario: User revisits a saved receipt
- **WHEN** the user opens a receipt from Receipt history
- **THEN** Mise shows the original receipt photo and extracted food, non-food,
  excluded, and money lines
- **AND** the screen clearly indicates that this is a saved review
- **AND** opening it does not create duplicate pantry items.

#### Scenario: User finds a missed food line
- **WHEN** a saved receipt omitted a food such as strip loin
- **THEN** the user can inspect the original image and extracted lines
- **AND** can use the existing correction/reclassification flow to identify it
  for follow-up without losing the receipt record.
