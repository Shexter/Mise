## Purpose

Defines the observable visual behaviour of the empty deck state, undo affordance, and deck pagination indicator so the user always knows how many cards remain and can recover from mistakes.

## Requirements

### Requirement: Empty deck state is visually informative and non-blocking
The system SHALL render a distinct empty deck view when all cards have been swiped, including a headline, a brief explanation, and at least two recovery CTAs: "Refresh suggestions" and "Log manually".

#### Scenario: Empty deck shows after all cards are swiped
- **WHEN** the user passes the last card in the suggestion deck
- **THEN** the deck area transitions to an empty-state view; the view displays a heading (e.g. "That's everything for now"), a one-line sub-label, and two clearly-labelled action buttons

#### Scenario: Empty deck does not render a card placeholder outline
- **WHEN** the deck is empty
- **THEN** no ghost card outline or empty card frame is visible; the space is filled entirely by the empty-state illustration and CTA layout

### Requirement: Deck shows a card count indicator
The system SHALL render a subtle card count indicator below the swipe deck (e.g. "3 meals remaining") that updates after each swipe. The indicator SHALL not draw significant visual attention — it is informational only.

#### Scenario: Card count decrements after each pass
- **WHEN** the user passes a card
- **THEN** the card count indicator decrements by one within the same render cycle; it never shows a stale value

#### Scenario: Card count reads "1 meal remaining" with correct singular
- **WHEN** exactly one card remains in the deck
- **THEN** the count reads "1 meal remaining" using singular form, not "1 meals remaining"

### Requirement: Undo affordance is always visible when an undo is available
The system SHALL render an undo button or icon that is visible and tappable whenever at least one card has been passed in the current session. The undo affordance SHALL be hidden (not merely disabled) when no undo state exists.

#### Scenario: Undo button appears after first pass
- **WHEN** the user passes the first card
- **THEN** an undo affordance becomes visible in the deck control area; it was not visible before the first pass

#### Scenario: Undo button disappears when undo stack is exhausted
- **WHEN** the user undoes all passed cards (undo stack is empty)
- **THEN** the undo affordance is hidden, not disabled — it has no visible presence on screen
