## Purpose

Defines the observable visual behaviour of the `MealSwipeCard` component — what layers it presents, what text hierarchy it maintains, what badges it renders, and how it responds to different data states.

## Requirements

### Requirement: Card displays cuisine category pill
The system SHALL render a small pill label in the top-left corner of each meal card that identifies the cuisine category (e.g. "Japanese", "Thai", "Italian"). The pill MUST be visually distinct from the card body — using an accent background colour from theme — and SHALL never truncate the cuisine name.

#### Scenario: Cuisine pill renders on a card
- **WHEN** a `MealSwipeCard` is mounted with a meal that has a cuisine category
- **THEN** the pill appears in the top-left with the cuisine name fully visible, on a themed accent background, in uppercase tracking-widened type

#### Scenario: Cuisine pill absent when category is unknown
- **WHEN** a meal has no cuisine category assigned
- **THEN** no pill is rendered and the card's top-left area remains empty without layout shift

### Requirement: Card uses a typography-led heading hierarchy
The system SHALL render the dish name as the dominant visual element on the card using a display-weight typeface (≥ 22 sp, font-weight 700). The font colour SHALL pass WCAG 2.1 AA contrast against the card background. Subtext (prep speed, cuisine description) SHALL be at least 4 sp smaller than the dish name.

#### Scenario: Dish name wraps gracefully
- **WHEN** a dish name exceeds one line at the card width
- **THEN** it wraps to at most 2 lines; any remainder is ellipsized at line 2 without overlapping other card content

#### Scenario: Short dish name does not leave a large gap
- **WHEN** a dish name is a single short word
- **THEN** the remaining card space is consumed by the calorie and macro chip row without a visible empty whitespace block

### Requirement: Card renders a calorie-fit badge in one of four visual states
The system SHALL badge each card with exactly one of four states — `Exact Fit`, `Fits Budget`, `Over Budget`, `Estimated` — using a distinct colour fill and label per state. No card SHALL render more than one badge simultaneously.

#### Scenario: Exact Fit badge appears for meals within ±75 kcal of remaining target
- **WHEN** a meal's calorie total is within ±75 kcal of the user's remaining daily allowance
- **THEN** the badge shows "Exact Fit" in a saturated green fill with a target-ring icon

#### Scenario: Fits Budget badge for meals under remaining calories
- **WHEN** a meal's calorie total is less than remaining allowance but not within ±75 kcal
- **THEN** the badge shows "Fits Budget" in a teal/mint fill with a checkmark icon

#### Scenario: Over Budget badge shows exact delta
- **WHEN** a meal's calorie total exceeds remaining allowance
- **THEN** the badge shows "+X kcal over" in a rose/muted-red fill with an upward-arrow icon, where X is the rounded calorie delta

#### Scenario: Estimated badge when nutrition data is incomplete
- **WHEN** any ingredient in the meal lacks confirmed catalogue nutrition data
- **THEN** the badge shows "Estimated" in a warm amber fill with a tilde (~) prefix on the calorie count

### Requirement: Card renders a macro chip row
The system SHALL render a horizontal row of three macro chips — Protein, Carbs, Fat — each displaying a rounded gram value and a coloured dot (blue for protein, amber for carbs, orange for fat). The chip row SHALL appear below the dish name and above the card's bottom badge area.

#### Scenario: Macro chips render with correct values
- **WHEN** a card mounts with a meal whose macros are known
- **THEN** protein, carbs, and fat gram values are each rendered in their respective chip, rounded to the nearest integer gram

#### Scenario: Macro chips show a dash when values are not available
- **WHEN** a meal has no macro data (all estimated or missing)
- **THEN** each chip renders "—" instead of a gram value; the Estimated calorie badge takes precedence

### Requirement: Card renders a pantry ingredient availability badge
The system SHALL render a badge in the bottom-right of the card indicating how many of the meal's required ingredients are currently on hand. The badge SHALL use a fraction format ("X/Y on hand") and change colour when fewer than half the ingredients are available.

#### Scenario: Full pantry coverage badge
- **WHEN** all required ingredients for a meal are in the pantry with positive estimated stock
- **THEN** the badge reads "X/X on hand" in a green-tinted colour

#### Scenario: Partial pantry coverage badge
- **WHEN** fewer than half the required ingredients are on hand
- **THEN** the badge reads "X/Y on hand" in a warm amber colour signalling shopping needed

### Requirement: Card displays a prep speed indicator
The system SHALL render a prep speed indicator using a clock icon + text label in one of three tiers: "Quick" (≤ 20 min), "Medium" (21–45 min), "Slow" (> 45 min). The indicator SHALL be placed in the card's top-right area.

#### Scenario: Quick prep speed renders correctly
- **WHEN** a meal's estimated prep time is 20 minutes or less
- **THEN** the indicator shows a clock icon + "Quick" label in a green-adjacent accent colour

#### Scenario: Slow prep speed renders correctly
- **WHEN** a meal's estimated prep time exceeds 45 minutes
- **THEN** the indicator shows a clock icon + "Slow" label in a muted neutral colour

### Requirement: Card background uses a depth-communicating shadow vocabulary
The system SHALL render each card with a layered shadow to communicate vertical depth in the stack. The shadow SHALL have at least two layers (ambient + key) using the theme's shadow tokens. No white-card-flat-on-white appearance is acceptable.

#### Scenario: Top card has stronger shadow than background cards
- **WHEN** two cards are visible (top + peek of second card)
- **THEN** the top card's shadow is visually stronger (higher elevation) than the partially visible card behind it
