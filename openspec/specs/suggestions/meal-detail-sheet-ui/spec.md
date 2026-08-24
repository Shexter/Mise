## Purpose

Defines the observable visual behaviour of the `MealDetailSheet` bottom sheet — ingredient list visual language, macro summary panel, step typography, and the action footer — as a user-facing design contract.

## Requirements

### Requirement: Sheet renders a macro summary panel at the top
The system SHALL render a compact horizontal macro summary panel immediately below the sheet handle, showing calorie total, protein, carbs, and fat. The panel SHALL use the same colour-coded dot scheme as the card's macro chips (blue protein, amber carbs, orange fat).

#### Scenario: Macro summary panel appears on sheet open
- **WHEN** the meal detail sheet opens for a selected card
- **THEN** the macro summary panel is the first visible content element below the handle, fully readable without scrolling

#### Scenario: Macro summary panel reflects servingsEaten value
- **WHEN** the user adjusts the servingsEaten stepper in the sheet
- **THEN** all four macro values in the summary panel update in real time to reflect the new portion size

### Requirement: Ingredient rows differentiate held from missing with colour and icon
The system SHALL render each required ingredient as a distinct list row with a leading indicator: a filled green circle for ingredients currently on hand, and a muted grey circle for ingredients not in the pantry. No ingredient SHALL be hidden or collapsed — all SHALL be visible on first sheet open.

#### Scenario: On-hand ingredient renders with green indicator
- **WHEN** the sheet is open and a required ingredient is present in the pantry
- **THEN** the ingredient row has a filled green dot to its left and the ingredient name is rendered in full-weight text

#### Scenario: Missing ingredient renders with muted indicator
- **WHEN** the sheet is open and a required ingredient is not in the pantry
- **THEN** the ingredient row has a muted grey dot and the ingredient name is rendered in slightly lighter text weight; the word "Missing" SHALL appear as a secondary inline label in rose text to the right of the ingredient name

#### Scenario: Ingredient list never hides rows
- **WHEN** a meal has 10 or more ingredients
- **THEN** all rows are scrollable within the sheet; no "show more" collapse is applied — the full list is always reachable

### Requirement: Recipe steps use a clear numbered typography treatment
The system SHALL render preparation steps as a numbered list with large, prominent step numbers (≥ 20 sp, font-weight 700) and body-weight step text at ≥ 15 sp. Adjacent steps SHALL be separated by visible spacing (≥ 16 dp between step blocks).

#### Scenario: Step numbers are visually dominant
- **WHEN** the sheet scrolls to the steps section
- **THEN** each step number stands out at a larger weight than the step body text; the number is left-aligned and the body text is indented to align with the number's right edge

#### Scenario: Final step does not have a separator below it
- **WHEN** the last preparation step is rendered
- **THEN** there is no divider or gap below it that creates a floating appearance before the sheet footer

### Requirement: Sheet footer renders the Cook action as the primary CTA
The system SHALL render a persistently visible footer at the bottom of the sheet with a "Cook it" primary button and a secondary "Pass" link. The primary button SHALL fill the footer width (minus horizontal margins) and use the theme's primary CTA style.

#### Scenario: Cook it button is always visible without scrolling
- **WHEN** the detail sheet is open at any scroll position
- **THEN** the "Cook it" button remains anchored to the sheet footer and does not scroll off screen

#### Scenario: Pass link uses secondary text style, not a button
- **WHEN** the sheet footer is rendered
- **THEN** the "Pass" affordance is a text link in muted colour, not a bordered or filled button — it is visually subordinate to "Cook it"
