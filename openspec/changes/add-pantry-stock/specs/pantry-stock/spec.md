## Purpose

Holds what is physically in the user's kitchen: which items, where each one is
stored, how much is left in terms the app can defend, and when each will go off.
This is the surface a user opens to answer "do I already have garlic?".

## ADDED Requirements

### Requirement: A pantry item is a physical thing, distinct from the food it is

The system SHALL represent each physical item in the kitchen as a pantry item
referencing exactly one canonical ingredient, and SHALL allow more than one
pantry item to reference the same canonical ingredient.

A pantry item SHALL record where it is stored, when it was acquired, and whether
it has been opened. It MAY reference a specific product where one is known.

#### Scenario: Two bottles of the same sauce are two items

- **WHEN** the user has two bottles of light soy sauce, one opened
- **THEN** the catalogue holds two pantry items
- **AND** both reference the same canonical ingredient
- **AND** only one is marked opened

#### Scenario: An item without a known product is normal

- **WHEN** loose ginger is added with no barcode and no product
- **THEN** a pantry item is created referencing the canonical ingredient alone

### Requirement: Storage locations are user-editable

The system SHALL ship a default set of storage locations covering at least a
fridge, a freezer, an ambient store, and a countertop, and SHALL allow the user
to rename them, add their own, and remove ones they do not have.

Removing a location that still holds items MUST NOT delete those items.

#### Scenario: Default locations exist on first launch

- **WHEN** the app is first launched
- **THEN** locations for fridge, freezer, ambient storage, and counter exist

#### Scenario: A user adds a location their kitchen has

- **WHEN** the user adds a location named "Chest freezer"
- **THEN** items can be assigned to it
- **AND** it behaves as a freezer for expiry purposes according to its type

#### Scenario: Removing a location preserves its items

- **GIVEN** a location holding three pantry items
- **WHEN** the user removes that location
- **THEN** the three items still exist
- **AND** the user is asked where they now live

### Requirement: Location and food class are independent

The system SHALL derive expiry from the item's storage location and derive
depletion behaviour from the canonical ingredient's food class, and MUST NOT
derive either one from the other.

#### Scenario: A staple stored in a cupboard is still mass-tracked

- **WHEN** dried pasta is stored in an ambient location
- **THEN** its depletion behaviour follows its staple class
- **AND** its expiry follows the ambient location

#### Scenario: The same food has different expiry in different locations

- **WHEN** identical chicken is stored in the fridge and in the freezer
- **THEN** the two items receive different predicted expiry dates

### Requirement: Expiry is predicted from shelf life, location, and date

The system SHALL compute a predicted expiry date from the canonical
ingredient's shelf life for the item's location, counted from the acquisition
date, without requiring the user to enter one.

Where an item is marked opened, the system SHALL use the opened shelf life
counted from the opening date where that yields an earlier date than the
unopened prediction.

A user-entered or label-read date SHALL take precedence over a prediction, and
the system SHALL record which of the two a date came from.

#### Scenario: Expiry is predicted without user input

- **WHEN** an item is added with an acquisition date and a location
- **THEN** a predicted expiry date is set
- **AND** the user is not required to enter one

#### Scenario: Opening an item shortens its life

- **GIVEN** an unopened sauce with a predicted expiry a year away
- **WHEN** the user marks it opened
- **THEN** its expiry is recomputed from the opened shelf life
- **AND** the resulting date is earlier

#### Scenario: A user-entered date wins

- **WHEN** the user enters an expiry date for an item that already has a
  predicted one
- **THEN** the entered date is used
- **AND** the item records that its date came from the user

### Requirement: Freezing an item extends its life

The system SHALL offer freezing as an action on an item that can be frozen, and
on freezing SHALL move the item to a freezer location and recompute its expiry
from the freezer shelf life.

#### Scenario: Freezing recomputes expiry

- **GIVEN** a portion of meat expiring in two days
- **WHEN** the user freezes it
- **THEN** its location becomes a freezer location
- **AND** its expiry is recomputed to the freezer shelf life

#### Scenario: Freezing is not offered where it makes no sense

- **WHEN** an item whose canonical ingredient is not freezable is viewed
- **THEN** freezing is not offered

### Requirement: Quantities are never displayed

The system MUST NOT display a computed remaining quantity for a pantry item.
Remaining stock SHALL be communicated as an advisory status — in stock, running
low, out — and never as a number or a percentage.

A quantity the user themselves entered MAY be shown back to them, attributed as
their own entry.

#### Scenario: A staple reports status, not mass

- **GIVEN** a bag of rice whose remaining mass has been estimated
- **WHEN** it is displayed
- **THEN** it shows an advisory status
- **AND** no gram figure or percentage appears

#### Scenario: A user's own figure may be echoed

- **GIVEN** the user entered a quantity when adding an item
- **WHEN** that item is displayed
- **THEN** their entered figure may be shown, marked as theirs

### Requirement: Uses-tracked items carry a four-state fullness

The system SHALL let the user set a fullness of full, half, low, or out on items
whose canonical ingredient depletes by uses rather than by mass, and SHALL treat
that setting as authoritative over any estimate at the moment it is given.

The system SHALL NOT prompt for fullness on a schedule. It MAY prompt when its
own estimate suggests the item is running low.

#### Scenario: A fullness tap overrides the estimate

- **GIVEN** an estimate suggesting a jar is nearly empty
- **WHEN** the user sets its fullness to half
- **THEN** the item's status reflects half
- **AND** the prior estimate no longer determines its status

#### Scenario: Fullness is not requested on a timer

- **WHEN** a week passes with no change to an item
- **THEN** the user is not prompted for its fullness

### Requirement: Items expiring soon are surfaced first

The system SHALL order the catalogue so that items closest to expiry appear
before items with more life left, and SHALL visually distinguish items that have
expired or expire within a few days.

#### Scenario: The soonest expiry leads

- **WHEN** the catalogue is opened
- **THEN** the item expiring soonest appears before items expiring later

#### Scenario: Urgent items are distinguishable

- **WHEN** an item expires within three days
- **THEN** it is visually distinguished from items with more life

### Requirement: Items can be added, adjusted, and removed by hand

The system SHALL let the user add a pantry item by hand, choosing its
ingredient, location, and acquisition date, without requiring a photograph, a
barcode, or a receipt.

The system SHALL offer one-tap actions to mark an item used up and to mark it
running low, and SHALL let the user discard an item, recording that it was
discarded rather than consumed.

#### Scenario: The catalogue works before any capture flow exists

- **WHEN** the user adds an item by hand
- **THEN** it appears in the catalogue with a predicted expiry

#### Scenario: Used up is one tap

- **WHEN** the user marks an item used up
- **THEN** its status becomes out

#### Scenario: Discarding is distinguished from consuming

- **WHEN** the user discards an item that went off
- **THEN** it is recorded as discarded
- **AND** not recorded as having been eaten

### Requirement: Advisory status is derived per food class

The system SHALL derive an item's status from different signals according to its
canonical ingredient's food class: remaining mass for staples, accumulated uses
or fullness for seasonings and condiments, and proximity to expiry for
perishables.

The thresholds at which status changes SHALL be defined as named, adjustable
values rather than scattered literals.

#### Scenario: A perishable's status follows its date

- **WHEN** a perishable approaches its expiry date
- **THEN** its status reflects that, regardless of any quantity

#### Scenario: A seasoning's status follows its use count

- **WHEN** a seasoning has been used enough times to approach a typical
  container's worth
- **THEN** its status becomes running low

### Requirement: Pantry data is covered by data deletion

The system SHALL remove all pantry item and user-defined location data when the
user deletes all application data.

#### Scenario: Delete all data clears the catalogue

- **WHEN** the user chooses to delete all data
- **THEN** no pantry items remain
- **AND** locations return to the shipped defaults
