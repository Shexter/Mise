## Purpose

Allow a user to correct an existing meal from the Today screen while keeping calorie totals, meal metadata, and pantry depletion consistent with the corrected record.

## ADDED Requirements

### Requirement: Logged meals open for editing
The system SHALL open the selected logged meal when the user activates its row under Today’s meals.

#### Scenario: Open a meal from Today
- **WHEN** the user taps a meal row under Today’s meals
- **THEN** the system opens an editor populated with that meal’s stored details and items

#### Scenario: Meal no longer exists
- **WHEN** the user attempts to open a meal that has been deleted
- **THEN** the system explains that the meal is no longer available and returns to the previous screen without creating a replacement

#### Scenario: Accessible row action
- **WHEN** assistive technology focuses a meal row
- **THEN** the row identifies itself as an actionable control and communicates that activation opens meal details for editing while preserving the separate swipe-to-delete action

### Requirement: Editable meal details
The system SHALL allow the user to edit the meal name, meal type, venue, servings made for a home-cooked meal, and the logged meal items. For each item the system SHALL allow editing its name, quantity, unit, calories, protein, carbohydrate, fat, and catalogue ingredient identity, and SHALL allow items to be added or removed.

#### Scenario: Edit meal metadata
- **WHEN** the user changes a meal’s name, meal type, or venue
- **THEN** the editor displays the changed values without committing them until Save is activated

#### Scenario: Edit an item
- **WHEN** the user changes an item quantity, unit, calories, macros, name, or catalogue ingredient
- **THEN** the editor recalculates and displays the meal total from the current draft items

#### Scenario: Add and remove items
- **WHEN** the user adds an item or removes an existing item
- **THEN** the draft and its displayed totals reflect the resulting ordered item list

#### Scenario: Non-home servings
- **WHEN** the user selects Ate out or Leftovers
- **THEN** the stored servings multiplier is one and the editor does not imply that additional servings will deplete pantry stock

### Requirement: Invalid edits cannot be saved
The system SHALL reject a draft with a blank meal name, no items, a blank item name, a non-finite or negative nutrient value, or a non-finite or non-positive quantity. Unknown optional macros SHALL remain distinguishable from an entered zero wherever the stored data model supports unknown values.

#### Scenario: Invalid draft
- **WHEN** the draft violates any save validation rule
- **THEN** Save is unavailable or the system identifies the invalid field and no stored meal or pantry state changes

#### Scenario: Valid zero nutrient
- **WHEN** an item contains a valid nutrient value of zero
- **THEN** the system accepts zero as data rather than treating it as a missing value

### Requirement: Save replaces the meal atomically
The system SHALL persist the edited meal, its complete ordered item set, and its corrected pantry-depletion events as one atomic operation while preserving the meal id, original logged time, local date, source, creation time, and existing photo.

#### Scenario: Successful save
- **WHEN** the user saves a valid changed meal
- **THEN** the stored meal and items exactly represent the draft and the old item set no longer contributes to totals or depletion

#### Scenario: Save fails
- **WHEN** any meal, item, consumption-event, or pantry update fails during Save
- **THEN** the old meal, old items, old consumption events, and old pantry state remain intact and the user can retry or cancel

#### Scenario: No-op save
- **WHEN** the user saves without changing any value
- **THEN** the meal remains unchanged and the system does not accumulate additional depletion events or drift

### Requirement: Pantry depletion follows the corrected meal
The system SHALL reverse the depletion actually recorded for the old meal and apply depletion for the corrected meal using the same rules as a newly logged meal.

#### Scenario: Correct a home meal quantity
- **WHEN** a home-cooked meal item quantity or servings multiplier changes and the user saves
- **THEN** the pantry reflects only the corrected quantity and servings multiplier and the old depletion does not remain

#### Scenario: Change home meal to ate out
- **WHEN** a home-cooked meal is changed to Ate out and saved
- **THEN** the old home depletion is restored and the corrected meal creates no pantry depletion

#### Scenario: Change ate out to home
- **WHEN** an Ate out meal is changed to Cooked in and saved
- **THEN** the corrected meal applies pantry depletion using its current items, catalogue identities, quantities, and servings multiplier

#### Scenario: Change meal to leftovers
- **WHEN** a meal is changed to Leftovers and saved
- **THEN** the old depletion is restored and the corrected meal creates no pantry depletion

### Requirement: Cancel discards the draft
The system SHALL leave the stored meal and pantry state unchanged when the user cancels editing or navigates back without saving.

#### Scenario: Cancel changed draft
- **WHEN** the user changes one or more fields and activates Cancel or confirms leaving without saving
- **THEN** the system returns without persisting any draft value or changing pantry depletion

#### Scenario: Protect unsaved changes
- **WHEN** the user attempts to leave an editor containing unsaved changes
- **THEN** the system asks whether to discard the changes before leaving

### Requirement: Saved edits are immediately visible
After a successful save, the system SHALL return to the meal’s date and refresh all locally derived views that depend on the meal or its depletion before showing success feedback.

#### Scenario: Today totals refresh
- **WHEN** a user saves changed calories or macros
- **THEN** the Today meal row, daily calorie total, remaining or over-target value, and macro bars show the corrected values

#### Scenario: Pantry and suggestions refresh
- **WHEN** a saved edit changes pantry depletion
- **THEN** pantry state and any cached suggestion inputs invalidated by meal or pantry changes are refreshed or invalidated consistently with a newly logged meal

#### Scenario: Edit a meal from a selected past day
- **WHEN** the user edits a meal shown on a selected past date and saves it
- **THEN** the system returns to that same date and shows the corrected meal there
