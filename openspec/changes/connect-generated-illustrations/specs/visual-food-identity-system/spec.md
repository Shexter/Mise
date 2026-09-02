## MODIFIED Requirements

### Requirement: Art direction follows the implemented app

Mise SHALL defer production asset generation until the owner accepts the
implemented core UI through native visual review, and once accepted SHALL ship
generated art only through a promotion step that records provenance and copies
the file into the bundled asset tree.

The gate has been cleared: the owner accepted the implemented surfaces through
native review, so the tier-3 pack now ships reviewed art. What replaces the gate
is the promotion boundary — reviewed candidates live in the git-ignored
`.art-staging/` tree, and nothing renders from there.

#### Scenario: Core UI is not yet accepted

- **WHEN** the Pantry, capture, onboarding, and related Impeccable surfaces
  have not received owner acceptance through native review
- **THEN** Mise does not generate or commit a production food-art pack
- **AND THEN** exploratory local images remain outside the production asset pack

#### Scenario: Reviewed art is shipped after acceptance

- **WHEN** the owner has accepted the surrounding UI and a candidate passes review
- **THEN** the candidate is promoted into `assets/food/` with a manifest entry
  recording its prompt, seed, model, workflow version, reviewer, review date, and
  output checksum
- **AND THEN** the app renders it from a static registry entry, never from the
  staging tree

### Requirement: Unshipped ingredients have an intentional fallback

Mise SHALL provide a reviewed category fallback for canonical ingredients that
do not yet have exact illustration assets, and SHALL keep that fallback reachable
after the pack is populated.

#### Scenario: Canonical ingredient lacks exact art

- **WHEN** a Pantry row resolves to a canonical ingredient without a reviewed
  exact illustration
- **THEN** Mise renders its reviewed category fallback
- **AND THEN** the ingredient name remains visible and authoritative

#### Scenario: A shipped illustration fails to load

- **WHEN** a bundled ingredient illustration cannot be loaded on the device
- **THEN** the row falls through to its reviewed category fallback badge
- **AND THEN** no broken image placeholder is rendered

### Requirement: Physical pantry photos take precedence

Mise SHALL prefer a retained photo of a physical pantry item over product,
scan-derived, or canonical imagery when the surface represents that item, and
SHALL keep that precedence after the generated pack ships.

#### Scenario: Pantry item has a retained photo

- **WHEN** a pantry item has a retained `photoUri`
- **THEN** Pantry renders that photo as the item's visual
- **AND THEN** Mise does not replace it with generated or canonical food art

#### Scenario: Item has both a photograph and a shipped illustration

- **WHEN** a pantry item's canonical ingredient has a promoted illustration and the
  user has also photographed the item
- **THEN** Pantry renders the user's photograph
- **AND THEN** the generated illustration is used only if that photograph is absent
  or fails to load
