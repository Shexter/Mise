## Purpose

Defines the observable visual behaviour of the COOK and PASS gesture overlay stamps — what appears when a user drags a card, when it appears, and how the background card responds.

## ADDED Requirements

### Requirement: COOK overlay renders on rightward drag
The system SHALL render a "COOK" overlay label on the card face when the user drags the card to the right. The overlay SHALL be invisible at rest and SHALL reach full opacity at the decision threshold distance.

#### Scenario: COOK label appears proportionally during rightward drag
- **WHEN** the user drags a card to the right
- **THEN** a green "COOK" stamp label fades in and becomes fully opaque when drag distance ≥ 35% of card width; the label is rotated counter-clockwise approximately 15 degrees and sits in the top-left quadrant of the card face

#### Scenario: COOK overlay disappears on release below threshold
- **WHEN** the user drags right but releases before reaching the decision threshold
- **THEN** the COOK overlay fades back to invisible as the card springs back to centre

### Requirement: PASS overlay renders on leftward drag
The system SHALL render a "PASS" overlay label on the card face when the user drags the card to the left. The overlay SHALL follow the same opacity curve as the COOK overlay but use a rose-muted red fill.

#### Scenario: PASS label appears proportionally during leftward drag
- **WHEN** the user drags a card to the left
- **THEN** a rose-muted "PASS" stamp label fades in at the top-right quadrant of the card, rotated clockwise approximately 15 degrees, reaching full opacity at the decision threshold

#### Scenario: PASS overlay does not bleed outside card bounds
- **WHEN** the PASS overlay is at full opacity
- **THEN** the stamp label is clipped to the card's border radius and does not render outside the card's visual boundary

### Requirement: Overlay stamp typography is bold and uppercase
The system SHALL render both COOK and PASS stamps in a heavy weight (font-weight ≥ 800), uppercase, with wide letter-spacing (≥ 0.12 em). The COOK stamp SHALL use the theme's success green. The PASS stamp SHALL use the theme's rose/muted-red.

#### Scenario: COOK stamp colour and weight
- **WHEN** the COOK overlay is at full opacity
- **THEN** the stamp text reads "COOK", is uppercase, uses success-green from the theme token, and uses weight 800 or higher

#### Scenario: PASS stamp colour and weight
- **WHEN** the PASS overlay is at full opacity
- **THEN** the stamp text reads "PASS", is uppercase, uses rose-muted-red from the theme token, and uses weight 800 or higher

### Requirement: Background card scales up as top card is dismissed
The system SHALL animate the second card in the stack from a slightly smaller scale to full scale as the top card exits past the decision threshold.

#### Scenario: Background card scale animates on threshold crossing
- **WHEN** the top card crosses the gesture decision threshold
- **THEN** the card behind it animates from scale 0.95 to scale 1.0 in synchrony with the top card's exit animation

#### Scenario: Background card scale resets when top card springs back
- **WHEN** the user releases the top card before the threshold and it springs back
- **THEN** the background card returns to scale 0.95 without any visible snap or jump
