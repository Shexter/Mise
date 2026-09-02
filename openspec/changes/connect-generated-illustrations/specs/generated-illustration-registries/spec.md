## ADDED Requirements

### Requirement: Bundled illustrations resolve through typed static registries

Mise SHALL resolve every bundled illustration through a typed registry of static
`require()` literals, and SHALL NOT construct an asset path at runtime.

#### Scenario: A screen renders a bundled illustration

- **WHEN** a screen needs an appliance, state, onboarding, or technique illustration
- **THEN** it reads the image from the registry module for that set
- **AND THEN** the screen contains no `require()` call and no computed asset path
  of its own

#### Scenario: An id has no bundled artwork

- **WHEN** a caller asks a registry for an id the registry does not hold
- **THEN** the registry returns nothing rather than a fabricated path
- **AND THEN** the calling surface renders its designed non-image state

### Requirement: Staging is never a runtime dependency

Mise SHALL bundle only promoted assets under `assets/`, and SHALL NOT reference
the `.art-staging/` review directory from application code, registries, or the
bundler configuration.

#### Scenario: Review scratch is absent

- **WHEN** the app is built on a machine with no `.art-staging/` directory
- **THEN** every bundled illustration still resolves
- **AND THEN** the build does not read from the staging tree

### Requirement: Every promoted non-ingredient asset records provenance

Mise SHALL record, for each promoted appliance, state, onboarding, and technique
illustration, the prompt, seed, model and model checksum, generator version,
workflow version, reviewer, review date, and the checksum of the promoted bytes.

#### Scenario: An asset is promoted

- **WHEN** a reviewed candidate is promoted out of staging
- **THEN** `assets/illustrations/manifest.json` gains an entry with all of those
  fields, taken from the sidecar written at generation time
- **AND THEN** the recorded output checksum matches the promoted file on disk

#### Scenario: An asset ships without an entry

- **WHEN** an image file exists under `assets/illustrations/` with no manifest
  entry, or a manifest entry names a file that is absent, or a registry key and
  the manifest disagree
- **THEN** the test suite fails
- **AND THEN** the half-shipped asset is reported rather than silently bundled

### Requirement: Promotion is a pipeline step, not a manual copy

Mise SHALL promote every set through `scripts/generate-illustrations.ts`, which
SHALL require a named reviewer and SHALL regenerate the registry block for the
set it promoted.

#### Scenario: An agent promotes a new set

- **WHEN** an agent promotes candidates for any of the five sets
- **THEN** the pipeline copies the file, writes the provenance entry, and rewrites
  that set's registry literals in one step
- **AND THEN** promotion without a named reviewer is refused

### Requirement: Generated artwork supports the interface rather than replacing its controls

Mise SHALL keep selection indicators, navigation glyphs, and functional micro-UI
as vector components, and SHALL use generated illustrations only as supporting
artwork.

#### Scenario: A selectable card carries an illustration

- **WHEN** an onboarding goal card or appliance row renders its illustration
- **THEN** the card's checkbox, tick, and pressed and selected states remain
  vector UI drawn from theme tokens
- **AND THEN** the illustration is decorative to assistive technology, because the
  card's own accessible label already names the option and its selected state

#### Scenario: A card is rendered at an increased system text size

- **WHEN** a goal card renders with enlarged system text
- **THEN** its title and detail remain fully visible without truncation or overflow
- **AND THEN** the illustration scales within its own band rather than pushing text
  out of the card

### Requirement: Illustrated paper is blended, not framed

Mise SHALL render the artwork's warm paper background as a surface in its own
right, and SHALL NOT nest the illustrated paper tile inside a visibly conflicting
bordered panel.

#### Scenario: A card illustration is laid out

- **WHEN** a goal card, appliance row, state panel, or technique step renders its
  artwork
- **THEN** the artwork is masked to the surrounding radius with no competing border
  or contrasting backing panel
- **AND THEN** the source artwork itself is neither cropped, trimmed, nor
  flood-filled to remove its paper or grounding shadow

### Requirement: Onboarding goal cards render the reviewed goal artwork

Mise SHALL render the two reviewed goal illustrations on the onboarding goal
cards, at equivalent visual scale, contained rather than cropped.

#### Scenario: The goal step is opened

- **WHEN** a user opens the onboarding goals step
- **THEN** the calorie card shows the reviewed calorie-goal artwork and the meal
  prep card shows the reviewed meal-prep artwork
- **AND THEN** both illustrations occupy bands of equal height and are fitted by
  containment, so neither artwork is cropped

#### Scenario: Goals are selected independently

- **WHEN** a user selects either goal, both goals, or neither
- **THEN** each card's selected state is reflected independently
- **AND THEN** the illustrations are unchanged by selection, which is carried by the
  card's border, title colour, and checkbox

### Requirement: Appliance cards render the illustration for their catalogue id

Mise SHALL render each appliance's reviewed illustration against its
`APPLIANCE_CATALOGUE` id, and SHALL keep the row tickable.

#### Scenario: The appliance step is opened

- **WHEN** a user opens the onboarding appliances step
- **THEN** each of the seven catalogue rows shows the illustration promoted for its
  own id
- **AND THEN** the row remains a checkbox with its tick, hit target, and accessible
  selected state intact

#### Scenario: Two appliances are visually distinct

- **WHEN** the rice cooker and slow cooker rows are shown together
- **THEN** each shows its own newest promoted artwork
- **AND THEN** the two are not the same image

### Requirement: State illustrations are wired only to semantically matching states

Mise SHALL render a named state illustration only on the state it depicts, and
SHALL NOT render one while data is loading or after an error.

#### Scenario: The pantry is genuinely empty

- **WHEN** the pantry has finished loading and holds nothing
- **THEN** the empty-pantry illustration is shown
- **AND THEN** it is not shown while the pantry is still loading, nor when loading
  failed

#### Scenario: A capture yields nothing to review

- **WHEN** a pantry photo produces no reviewable proposals
- **THEN** the needs-a-better-photo illustration is shown with a retake action
- **AND THEN** it is not shown for a provider, network, or authorisation failure,
  which are not photo-quality problems

#### Scenario: A bundled state image cannot resolve

- **WHEN** a state illustration's bundled image is missing or fails to load
- **THEN** the surface falls back to its reviewed vector illustration or to its
  text-only state
- **AND THEN** no broken image placeholder is rendered

### Requirement: Technique illustrations are matched deterministically and conservatively

Mise SHALL map a cooking step to a technique illustration from a bounded
vocabulary, by explicit stored id first and recognised step verbs second, and
SHALL render the step as text alone when no safe match exists.

#### Scenario: A step carries an explicit technique id

- **WHEN** a cooking-guide step stores a technique id in the bounded vocabulary
- **THEN** that technique's illustration is used
- **AND THEN** the step text is not consulted

#### Scenario: A step leads with a recognised verb

- **WHEN** a step's leading verb is a recognised technique verb
- **THEN** that technique's illustration is used
- **AND THEN** the same step text always resolves to the same technique

#### Scenario: A step mentions two techniques

- **WHEN** a step's text matches more than one technique and its leading verb
  matches none
- **THEN** no illustration is assigned
- **AND THEN** the step renders as the existing numbered text

#### Scenario: A step names no recognised technique

- **WHEN** a step matches no technique in the vocabulary
- **THEN** the step renders as the existing numbered text
- **AND THEN** no unrelated illustration is substituted to fill the slot
