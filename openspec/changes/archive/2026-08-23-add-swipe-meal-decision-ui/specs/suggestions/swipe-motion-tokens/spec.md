## Purpose

Establishes the motion dictionary that all swipe deck animations MUST draw from, ensuring consistent timing, easing, and reduced-motion fallback behaviour across the feature.

## ADDED Requirements

### Requirement: Card exit animations use arc trajectories not linear slides
The system SHALL animate exiting cards along an arc path (combined translation + rotation) rather than a horizontal slide. Exit-right cards SHALL rotate to approximately +15° at full exit; exit-left cards SHALL rotate to approximately −15° at full exit.

#### Scenario: Right-swipe exit arc is observable
- **WHEN** a card commits to a right-swipe exit
- **THEN** the card's rotation increases from its current drag angle to +15° as it translates off the right edge; the motion feels natural, not mechanical

#### Scenario: Left-swipe exit arc is observable
- **WHEN** a card commits to a left-swipe exit
- **THEN** the card's rotation decreases from its current drag angle to −15° as it translates off the left edge

### Requirement: Card exit duration is 280–320 ms
The system SHALL complete card exit animations (translation + rotation to off-screen) within 280–320 ms from threshold commit. Animations outside this range feel either too slow (laborious) or too fast (jarring).

#### Scenario: Exit animation completes within timing window
- **WHEN** a card crosses the decision threshold
- **THEN** the exit animation finishes — card is fully off-screen — within 280–320 ms

### Requirement: Background card scale-up uses an ease-out curve
The system SHALL animate the background card's scale from 0.95 to 1.0 using an ease-out easing curve. Linear scale-ups look mechanical and must not be used.

#### Scenario: Background card scale-up uses ease-out
- **WHEN** the top card exits
- **THEN** the background card's scale animation decelerates toward 1.0, not a constant rate

### Requirement: Card spring-back uses a natural spring easing
The system SHALL animate a released-before-threshold card back to centre using a spring easing (stiffness ≥ 200, damping ≈ 20) rather than a tween. The card MUST NOT overshoot its rest position.

#### Scenario: Card springs back without overshoot
- **WHEN** the user releases a card below the decision threshold
- **THEN** the card animates back to its original position using spring physics; it does not oscillate past the rest point

### Requirement: Undo animation reverses the exit arc
The system SHALL animate the undo card back into position by reversing the exit arc: the card enters from off-screen at a rotation of ±15° and rotates back to 0° as it reaches the deck centre.

#### Scenario: Undo card enters from the correct edge
- **WHEN** the user taps Undo after a left-swipe pass
- **THEN** the card enters from the left edge with a −15° initial rotation, settling to 0° at deck centre

### Requirement: All animations have a reduced-motion variant
The system SHALL detect `useReducedMotion()` and replace all translation+rotation animations with immediate crossfades (opacity 0 → 1 or 1 → 0) of ≤ 150 ms. No translation or rotation SHALL occur in reduced-motion mode.

#### Scenario: Card exit becomes a crossfade in reduced motion
- **WHEN** the device accessibility setting "Reduce Motion" is enabled AND a card is committed to exit
- **THEN** the card fades out in ≤ 150 ms with zero translation or rotation

#### Scenario: Background card reveal becomes immediate in reduced motion
- **WHEN** reduced motion is active AND the top card exits
- **THEN** the background card appears at full scale immediately — no scale animation
