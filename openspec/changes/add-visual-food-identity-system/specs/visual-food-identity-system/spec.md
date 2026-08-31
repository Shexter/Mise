## ADDED Requirements

### Requirement: Food visuals must resolve without runtime generation

Mise SHALL render food visuals from reviewed local assets and retained local
evidence. The base experience SHALL NOT require a cloud provider, a user API
key, or runtime image generation.

#### Scenario: User has no configured provider key

- **WHEN** a user opens Pantry without a configured provider key
- **THEN** each food row with a visual role resolves to a local photo,
  canonical illustration, or category fallback
- **AND THEN** the row does not show a broken image or an image-missing error

### Requirement: Physical pantry photos take precedence

Mise SHALL prefer a retained photo of a physical pantry item over product or
canonical imagery when the surface represents that item.

#### Scenario: Pantry item has a retained photo

- **WHEN** a pantry item has a retained `photoUri`
- **THEN** Pantry renders that photo as the item's visual
- **AND THEN** Mise does not replace it with generated or canonical food art

### Requirement: Unshipped ingredients have an intentional fallback

Mise SHALL provide a reviewed category fallback for canonical ingredients that
do not yet have exact illustration assets.

#### Scenario: Canonical ingredient lacks exact art

- **WHEN** a Pantry row resolves to a canonical ingredient without a reviewed
  exact illustration
- **THEN** Mise renders its reviewed category fallback
- **AND THEN** the ingredient name remains visible and authoritative

### Requirement: Generated shipped assets have provenance

Mise SHALL retain provenance for each approved locally generated canonical or
category illustration before it becomes a shipped or downloadable asset.

#### Scenario: Candidate image is approved

- **WHEN** a local generation candidate is approved for Mise distribution
- **THEN** its manifest records the asset key, source model, license, prompt
  recipe, seed, workflow version, review date, and output checksum
- **AND THEN** the candidate is not treated as a fact about any user's food

### Requirement: Art direction follows the implemented app

Mise SHALL defer production asset generation until the owner accepts the
implemented core UI through native visual review.

#### Scenario: Core UI is not yet accepted

- **WHEN** the Pantry, capture, onboarding, and related Impeccable surfaces
  have not received owner acceptance through native review
- **THEN** Mise does not generate or commit a production food-art pack
- **AND THEN** exploratory local images remain outside the production asset pack

### Requirement: A dish is represented as itself, never as one of its ingredients

Mise SHALL render a dish from properties of the dish, and SHALL NOT present any
single ingredient's imagery as if it depicted the dish.

#### Scenario: Suggestion has no photo of the finished dish

- **WHEN** a dinner suggestion, meal plan, or saved recipe has no retained photo
- **THEN** Mise renders a plate composed from the food classes the dish's own
  ingredients belong to
- **AND THEN** Mise does not render one ingredient's illustration, or a category
  badge for one ingredient's class, as the dish's visual

#### Scenario: Dish has no resolvable ingredients

- **WHEN** none of a dish's ingredients resolve to a known food class
- **THEN** Mise renders an empty plate
- **AND THEN** Mise does not infer a composition the data does not support
