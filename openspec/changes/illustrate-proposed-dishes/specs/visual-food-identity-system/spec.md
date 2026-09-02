## MODIFIED Requirements

### Requirement: A dish is represented as itself, never as one of its ingredients

Mise SHALL render a dish from properties of the dish, and SHALL NOT present any
single ingredient's imagery as if it depicted the dish.

A dish the project itself authored — an entry in the meal-prep template list —
MAY be rendered from reviewed artwork drawn for that specific dish, because the
authored set is bounded and each entry's art depicts that entry. Every other
dish SHALL be composed procedurally, because its identity is not known in
advance and no drawn image could depict it truthfully.

#### Scenario: Suggestion has no photo of the finished dish

- **WHEN** a dinner suggestion, meal plan, or saved recipe has no retained photo
  and no authored template artwork
- **THEN** Mise renders a plate composed from the food classes the dish's own
  ingredients belong to
- **AND THEN** Mise does not render one ingredient's illustration, or a category
  badge for one ingredient's class, as the dish's visual

#### Scenario: Dish has no resolvable ingredients

- **WHEN** none of a dish's ingredients resolve to a known food class
- **THEN** Mise renders an empty plate
- **AND THEN** Mise does not infer a composition the data does not support

#### Scenario: The dish is an authored meal-prep template

- **WHEN** a plan was built from a meal-prep template that has reviewed artwork
- **THEN** Mise renders that template's own artwork
- **AND THEN** the artwork is addressed by the template's id, so a reworded title
  cannot silently detach it

#### Scenario: A proposed dish was not authored by the project

- **WHEN** a dish comes from a provider suggestion, a saved recipe, or any source
  outside the authored template list
- **THEN** Mise renders the procedural plate
- **AND THEN** Mise does not substitute the artwork of a different dish that
  happens to share ingredients, a title, or a food class
