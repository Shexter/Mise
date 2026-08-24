## Purpose

Establishes the accessibility floor for the swipe deck feature — minimum touch targets, contrast ratios, screen-reader labels, focus rings, and the alternative button bar presented when gesture interaction is unavailable.

## Requirements

### Requirement: All interactive elements meet minimum touch target sizes
The system SHALL ensure every tappable element in the swipe deck UI has a minimum hit area of 44 × 44 dp (iOS HIG) or 48 × 48 dp (Android Material), whichever is appropriate for the platform. This applies to action buttons, the undo affordance, and sheet footer buttons.

#### Scenario: Undo affordance hit area meets minimum size
- **WHEN** the undo button is visible in the deck control area
- **THEN** its tappable region is at least 44 × 44 dp regardless of how small its visual icon appears

#### Scenario: COOK and PASS action buttons meet minimum size
- **WHEN** the alternative button bar is rendered (reduced-motion or explicit button controls)
- **THEN** each button's touch target is at least 44 × 44 dp

### Requirement: Text and badge elements meet WCAG 2.1 AA contrast
The system SHALL ensure all text rendered in card components and the detail sheet meets WCAG 2.1 AA minimum contrast ratios: 4.5:1 for body text (< 18 sp) and 3:1 for large text (≥ 18 sp or bold ≥ 14 sp). Badge fill colours SHALL be chosen such that white text on the badge meets 4.5:1.

#### Scenario: Dish name contrast meets large-text threshold
- **WHEN** a `MealSwipeCard` renders the dish name at ≥ 22 sp
- **THEN** the contrast ratio between dish name colour and card background colour is at least 3:1

#### Scenario: Calorie fit badge text passes body-text contrast
- **WHEN** a calorie fit badge renders its label text on its fill colour
- **THEN** the white (or dark) badge text against the badge fill achieves at least 4.5:1

### Requirement: Screen-reader labels describe all card badges and interactive controls
The system SHALL provide `accessibilityLabel` props on all icon-only controls, and `accessibilityHint` on swipeable cards explaining the gesture. Badge icons SHALL not be read as "image" — their meaning SHALL be encoded in `accessibilityLabel`.

#### Scenario: Card explains swipe gestures to screen-reader users
- **WHEN** a `MealSwipeCard` is focused by a screen reader
- **THEN** the accessibility label reads the dish name and the accessibility hint reads "Swipe right to cook, swipe left to pass" (or equivalent in the user's locale)

#### Scenario: Calorie fit badge is read correctly
- **WHEN** a calorie fit badge icon is focused
- **THEN** the screen reader reads the badge's meaning (e.g. "Exact Fit", "Over Budget by 120 kcal") — not "image" or the icon's asset name

### Requirement: Focus ring is visible on all interactive elements
The system SHALL render a visible focus indicator on every tappable element when navigated via keyboard or switch access. The focus ring MUST be at least 2 dp thick and use a high-contrast colour that passes 3:1 against both the element and the page background.

#### Scenario: Action buttons show focus ring under keyboard navigation
- **WHEN** a user navigates to the COOK or PASS action button using keyboard/switch access
- **THEN** a visible focus ring at least 2 dp thick is rendered around the button

### Requirement: Gesture-free alternative button bar is shown for reduced-motion users
The system SHALL render an explicit three-button control bar (Pass | Info | Cook) when `useReducedMotion()` is active, positioned below the card stack. The buttons SHALL be large enough to be the primary interaction method — gesture-swipe is still available but not required.

#### Scenario: Button bar appears in reduced-motion mode
- **WHEN** the device has "Reduce Motion" enabled
- **THEN** a horizontal button bar with Pass, Info, and Cook buttons is visible below the meal card and each button is at least 48 dp tall

#### Scenario: Button bar buttons trigger the correct actions
- **WHEN** the user taps Pass in the button bar
- **THEN** the card exits (via crossfade, per motion spec) and the next card is shown — identical outcome to a left swipe
