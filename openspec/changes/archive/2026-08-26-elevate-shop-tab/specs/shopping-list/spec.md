## MODIFIED Requirements

### Requirement: Pantry navigation stays uncrowded

The system SHALL expose Shop as a top-level dedicated tab in bottom navigation, providing direct access to items to buy, nearby shop detection, and receipt history without requiring multi-level nested controls inside Pantry.

#### Scenario: Shop subsection
- **WHEN** the user navigates to the shopping list
- **THEN** open items to buy, history toggle, and receipt shortcuts are immediately accessible
- **AND** header actions remain focused and intuitive

#### Scenario: Today remains focused
- **WHEN** the user opens Today
- **THEN** current-day nutrition, meals, and the primary dinner action remain the main content
- **AND** no redundant shopping lists crowd the daily dashboard
