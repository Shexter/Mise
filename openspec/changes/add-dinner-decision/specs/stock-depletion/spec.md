## ADDED Requirements

### Requirement: A known canonical identity is used directly, not re-derived

Where a consumed meal item already carries the canonical ingredient it refers
to, the system SHALL debit that ingredient directly and MUST NOT re-derive the
identity from the item's name.

Where no canonical identity is carried — a meal logged from a photograph or
entered by hand — the system SHALL continue to resolve by name through the
established cascade.

#### Scenario: A recipe-sourced item debits by identity

- **GIVEN** a meal item carrying the canonical ingredient it came from
- **WHEN** depletion runs
- **THEN** that ingredient is debited
- **AND** no name matching is performed for it

#### Scenario: A photographed item still resolves by name

- **GIVEN** a meal item with no canonical identity carried
- **WHEN** depletion runs
- **THEN** its ingredient is resolved from its name as before

#### Scenario: A carried identity survives an ambiguous name

- **GIVEN** a meal item named ambiguously but carrying a specific canonical
  ingredient
- **WHEN** depletion runs
- **THEN** the carried ingredient is debited
- **AND** the ambiguity of the name has no effect
