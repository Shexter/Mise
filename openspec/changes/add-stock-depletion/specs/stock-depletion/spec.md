## Purpose

Keeps the pantry roughly true without anyone maintaining it, by treating the
meal the user already logged as the record of what left the kitchen — and by
tracking how confident that record is, so the app can say less when it knows
less.

## ADDED Requirements

### Requirement: Only meals cooked at home decrement stock

The system SHALL record for each meal whether it was cooked at home or obtained
elsewhere, and SHALL decrement pantry stock only for meals cooked at home.

The venue SHALL be settable in one action at log time and SHALL default to the
value the user chose most recently.

#### Scenario: A restaurant meal leaves the pantry untouched

- **WHEN** a meal logged as eaten out is committed
- **THEN** no pantry item is decremented
- **AND** no consumption events are recorded against pantry items

#### Scenario: A home-cooked meal decrements

- **WHEN** a meal logged as cooked at home is committed
- **THEN** matched pantry items are decremented

### Requirement: Depletion runs on commit, not during editing

The system SHALL apply depletion when a meal is committed, and MUST NOT apply it
while the user is still correcting the estimate.

#### Scenario: Editing an estimate does not move stock

- **GIVEN** a user correcting item quantities on the review screen
- **WHEN** they change a quantity without committing
- **THEN** no pantry item changes

#### Scenario: Committing applies depletion once

- **WHEN** a meal is committed
- **THEN** depletion is applied exactly once for that meal

### Requirement: A servings multiplier scales depletion to what was cooked

The system SHALL let the user state how many servings a home-cooked meal
produced, and SHALL scale each decrement by that number, because the pantry
loses the whole batch while the meal log records one plate.

The control SHALL default to the number last used for the same dish where one is
known, and otherwise to one. Setting it MUST NOT be required to commit a meal.

#### Scenario: A batch debits the whole batch

- **GIVEN** a home-cooked meal recorded as making four servings
- **WHEN** it is committed
- **THEN** each matched pantry item is decremented by four times the logged
  amount

#### Scenario: The multiplier is optional

- **WHEN** the user commits a meal without touching the servings control
- **THEN** the meal commits
- **AND** a multiplier of one, or the remembered value for that dish, is applied

#### Scenario: A repeated dish remembers its yield

- **GIVEN** a dish previously recorded as making four servings
- **WHEN** the same dish is logged again
- **THEN** the servings control defaults to four

### Requirement: Leftovers never decrement

The system SHALL allow a meal to be logged as leftovers of a previously cooked
batch, and a meal so logged SHALL contribute its calories and macros while
decrementing no pantry stock.

#### Scenario: Eating leftovers does not debit twice

- **GIVEN** a batch of four servings already committed and decremented
- **WHEN** one of the remaining servings is logged as leftovers
- **THEN** its calories are recorded
- **AND** no pantry item is decremented

### Requirement: Depletion follows the food class

The system SHALL decrement each matched item according to its canonical
ingredient's food class: reducing remaining amount for mass-tracked staples,
incrementing a use count for items tracked by uses, and reducing remaining
amount or marking consumed for perishables.

#### Scenario: A staple loses mass

- **WHEN** a meal recording two hundred grams of rice is committed
- **THEN** the matched rice item's remaining amount is reduced by that amount

#### Scenario: A seasoning gains a use

- **WHEN** a meal referencing gochujang is committed
- **THEN** the matched gochujang item's use count increases
- **AND** its remaining mass is not estimated

#### Scenario: A use count scales with servings

- **GIVEN** a meal recorded as making four servings and referencing fish sauce
- **WHEN** it is committed
- **THEN** the fish sauce item's use count increases by four

### Requirement: Hidden-ingredient quick-picks decrement their item

The system SHALL treat a hidden-ingredient quick-pick added to a meal as
consumption of the corresponding pantry item, using the typical amount that
quick-pick already carries.

#### Scenario: Adding cooking oil debits the oil

- **GIVEN** the user has olive oil in the pantry
- **WHEN** they add the olive oil quick-pick to a home-cooked meal and commit
- **THEN** the olive oil item is decremented by the quick-pick's typical amount

### Requirement: Unit conversion never invents a factor

Where the unit a meal records differs from the unit an item is stocked in, the
system SHALL convert only when the required factor is known for that canonical
ingredient.

Where the factor is not known, the system MUST NOT estimate one. It SHALL record
the consumption without changing the item's remaining amount, and SHALL treat
the occurrence as a use.

#### Scenario: A known factor converts

- **GIVEN** a canonical ingredient with a known density
- **WHEN** a meal records a volume and the item is stocked by mass
- **THEN** the amount is converted and the item decremented

#### Scenario: An unknown factor does not guess

- **GIVEN** a canonical ingredient with no known weight per piece
- **WHEN** a meal records a count of pieces and the item is stocked by mass
- **THEN** the item's remaining amount is unchanged
- **AND** the consumption is still recorded

### Requirement: Every decrement is recorded and reversible

The system SHALL record each decrement as a consumption event carrying the meal
it came from, the canonical ingredient, the pantry item where one matched, the
amount, and the multiplier applied.

Deleting a meal SHALL reverse its consumption events. Editing a committed meal
SHALL reverse its events and reapply them from the edited meal.

#### Scenario: Deleting a meal restores stock

- **GIVEN** a committed meal that decremented three items
- **WHEN** the meal is deleted
- **THEN** all three items return to their prior amounts

#### Scenario: Editing a meal reapplies cleanly

- **GIVEN** a committed meal
- **WHEN** the user edits a quantity and re-commits
- **THEN** the original decrements are reversed
- **AND** decrements matching the edited meal are applied
- **AND** no decrement is applied twice

### Requirement: Stock never goes below empty

The system SHALL clamp a decrement that would take an item below empty, setting
its status to out rather than recording a negative amount.

Such an occurrence SHALL be recorded as evidence that the item's estimate had
drifted.

#### Scenario: An over-decrement clamps

- **WHEN** a decrement exceeds an item's remaining amount
- **THEN** the item's remaining amount becomes empty
- **AND** its status becomes out

### Requirement: Consuming an uncatalogued ingredient is recorded, not ignored

Where a consumed ingredient matches no pantry item, the system SHALL record the
consumption against the canonical ingredient with no pantry item attached, and
MUST NOT create a pantry item automatically.

The system MAY, after an ingredient has been consumed repeatedly with nothing in
the catalogue, offer once to add it. It MUST NOT prompt repeatedly.

#### Scenario: An uncatalogued ingredient still leaves a trace

- **GIVEN** the user has never catalogued rice
- **WHEN** a meal containing rice is committed
- **THEN** a consumption event is recorded for rice with no pantry item
- **AND** no pantry item is created

#### Scenario: A repeated absence may be surfaced once

- **GIVEN** an ingredient consumed many times with nothing in the catalogue
- **WHEN** the user is offered the chance to add it and declines
- **THEN** they are not asked again for that ingredient

### Requirement: Confidence decays with estimated decrements

The system SHALL track, per pantry item, how many estimated decrements have been
applied since its last ground-truth anchor, where an anchor is a receipt for
that item, a fullness setting, or a quantity the user entered.

Where that count is high, the system SHALL qualify what it claims about the item
rather than asserting it, and MAY ask the user to confirm the item's fullness.

#### Scenario: An anchor resets the count

- **GIVEN** an item with many estimated decrements since its last anchor
- **WHEN** the user sets its fullness
- **THEN** the count returns to zero

#### Scenario: High drift softens the claim

- **GIVEN** an item whose estimated decrements since its last anchor exceed the
  configured limit
- **WHEN** its status is displayed
- **THEN** the status is qualified rather than asserted

#### Scenario: A receipt re-anchors the item

- **WHEN** a receipt records a purchase of an ingredient already in the
  catalogue
- **THEN** the matching item's amount is reset to the purchased quantity
- **AND** its drift count returns to zero

### Requirement: Depletion is never retroactive

The system MUST NOT apply depletion for meals committed before a pantry item
existed.

#### Scenario: Adding an item does not replay history

- **GIVEN** a month of logged meals containing rice
- **WHEN** the user adds rice to the catalogue for the first time
- **THEN** the new item is at its entered amount
- **AND** no past meal decrements it
