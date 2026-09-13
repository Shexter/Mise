## Purpose

Provide a contextual meal and cuisine chooser that follows the selected visual concept while keeping recipe availability and scheduling actions truthful.

## ADDED Requirements

### Requirement: The chooser identifies the current destination

The chooser SHALL present a dated meal heading, search, meal-type controls, labelled cuisine illustrations, and recipe results in that order. Heading, preview actions, and final scheduling context SHALL agree on the selected date and meal type.

#### Scenario: Change lunch to dinner

- **WHEN** the user changes the chooser's selected meal type from Lunch to Dinner
- **THEN** the heading, results, preview context, and final scheduling target use Dinner
- **AND** the selected date remains unchanged

#### Scenario: Replace an occupied slot

- **WHEN** the chooser opens to replace an existing lunch slot
- **THEN** the replacement target remains that lunch slot
- **AND** changing its date or meal type uses the explicit move workflow rather than silently replacing another slot

### Requirement: Cuisine artwork does not define recipe availability

Cuisine filters SHALL use recorded recipe labels. The initial release SHALL support the cuisines present in its reviewed collection. An illustration SHALL not imply unsupported recipes or establish a saved recipe's cuisine.

#### Scenario: Cuisine has no meals of the selected type

- **WHEN** a selected cuisine and meal type have no matching recipes
- **THEN** the chooser explains the empty combination
- **AND** offers filter recovery without losing the target date or meal slot

#### Scenario: Saved recipe has no cuisine metadata

- **WHEN** a saved recipe has no recorded cuisine and a specific cuisine is selected
- **THEN** it is excluded from that cuisine's matching results
- **AND** a clearly labelled action can return to saved recipes while preserving search and date

### Requirement: Illustrated controls remain native and accessible

Cuisine controls SHALL display readable labels outside the artwork and expose selection through accessible state and a visible non-color cue. All and functional navigation controls SHALL remain vector or native elements. Horizontal overflow SHALL remain discoverable and operable without precision gestures.

#### Scenario: Image unavailable or screen reader active

- **WHEN** a cuisine image fails to load or a screen reader explores the rail
- **THEN** the cuisine label, selected state, and selection action remain usable
- **AND** decorative artwork does not duplicate the label announcement

### Requirement: A recipe is reviewed before scheduling

Recipe rows SHALL offer an explicitly labelled preview action. Scheduling SHALL require confirmation after applicable portion, eligibility, and occupied-slot checks. Browsing SHALL not log food, deduct stock, or modify grocery records.

#### Scenario: Preview is cancelled

- **WHEN** the user previews a recipe and presses Back or Cancel
- **THEN** the chooser restores its query, filters, target date, meal type, and scroll position
- **AND** no schedule, meal, pantry, or grocery record is changed

### Requirement: Results and recovery copy describe real behavior

The chooser SHALL not claim personalized recommendations without a ranking mechanism. Loading, read failure, and zero matches SHALL be distinct states. Local authored recipes SHALL remain usable without pantry setup or an API key.

#### Scenario: Saved recipe read fails

- **WHEN** saved recipes cannot be read
- **THEN** the chooser shows a recoverable error with Retry for that section
- **AND** available local authored recipes remain selectable
- **AND** the error is not described as an empty saved collection
