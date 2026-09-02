## ADDED Requirements

### Requirement: Authored dish artwork is addressed by template id

Mise SHALL resolve dish artwork through a registry keyed by meal-prep template
id, and SHALL return nothing rather than a near match when a dish has no artwork.

#### Scenario: A plan carries a template id with artwork

- **WHEN** a surface asks for the artwork of a plan built from an authored template
- **THEN** the registry returns that template's image
- **AND THEN** the surface renders it as the dish's visual

#### Scenario: A plan has no template id, or an unknown one

- **WHEN** a surface asks for artwork with no template id, or one the registry
  does not hold
- **THEN** the registry returns nothing
- **AND THEN** the surface falls back to the procedural dish plate rather than to
  a blank space or a different dish's picture

#### Scenario: The generable set is bounded

- **WHEN** an agent adds a subject to the dish set
- **THEN** that subject corresponds to an existing meal-prep template id
- **AND THEN** no artwork is generated for a dish title that has no template
