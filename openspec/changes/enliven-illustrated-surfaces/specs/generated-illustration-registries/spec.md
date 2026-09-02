## MODIFIED Requirements

### Requirement: Appliance cards render the illustration for their catalogue id

Mise SHALL present the appliance step as a grid of illustrated tiles, one per
`APPLIANCE_CATALOGUE` id, and SHALL keep each tile tickable.

The artwork carries recognition; the tick carries selection. A tile shows the
appliance's illustration and its short name and nothing else — an appliance
someone owns is identified by sight, so a line explaining what it is for is
reading work in place of looking.

#### Scenario: The appliance step is opened

- **WHEN** a user opens the onboarding appliances step
- **THEN** the seven catalogue appliances are laid out as a grid of tiles, each
  showing the illustration promoted for its own id and its short name
- **AND THEN** no tile carries an explanatory detail line

#### Scenario: An appliance is chosen

- **WHEN** a user taps a tile
- **THEN** its tick fills and its border takes the action colour
- **AND THEN** the tick remains a vector control, never a painted mark, so
  selection stays legible in every theme and at every state

#### Scenario: Two appliances are visually distinct

- **WHEN** the rice cooker and slow cooker tiles are shown together
- **THEN** each shows its own promoted artwork
- **AND THEN** the two are not the same image

#### Scenario: The user owns no appliances

- **WHEN** a user chooses the no-appliances option
- **THEN** it is presented as a full-width row with its explanatory line intact,
  outside the grid
- **AND THEN** choosing it clears any appliance tiles already ticked

### Requirement: Generated artwork supports the interface rather than replacing its controls

Mise SHALL keep selection indicators, navigation glyphs, viewfinder framing, and
functional micro-UI as vector components, and SHALL use generated illustrations
only as supporting artwork.

#### Scenario: A selectable card carries an illustration

- **WHEN** an onboarding goal card or appliance tile renders its illustration
- **THEN** the card's checkbox, tick, and pressed and selected states remain
  vector UI drawn from theme tokens
- **AND THEN** the illustration is decorative to assistive technology, because the
  card's own accessible label already names the option and its selected state

#### Scenario: A card is rendered at an increased system text size

- **WHEN** a goal card or appliance tile renders with enlarged system text
- **THEN** its labels remain fully visible without truncation or overflow
- **AND THEN** the illustration scales within its own band rather than pushing text
  out of the card

#### Scenario: Artwork is framed as a viewfinder

- **WHEN** a surface frames an illustration with scan-framing corners
- **THEN** the corners are drawn in vector by the component
- **AND THEN** they are not painted into the artwork, so they stay crisp at any
  size and retint with the theme

## ADDED Requirements

### Requirement: Every way into Mise is illustrated

Mise SHALL render an illustration for each capture method on the centre add
sheet, resolved from a typed registry.

#### Scenario: The add sheet is opened

- **WHEN** a user opens the centre add sheet
- **THEN** each illustrated method shows its own promoted artwork in place of a
  generic glyph
- **AND THEN** the method's label, order, route, tint, and whichever row the
  sheet leads with are unchanged

#### Scenario: A method has no promoted artwork

- **WHEN** a method on the sheet has no entry in the action registry
- **THEN** it falls back to its existing vector glyph
- **AND THEN** the row remains tappable and correctly labelled
