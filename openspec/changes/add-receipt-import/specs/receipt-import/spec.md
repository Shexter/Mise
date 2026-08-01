## Purpose

Turns a photographed receipt into stock the user did not have to type and
spending they did not have to track. This is how the pantry fills for most
people, and it is the only moment the app learns what food actually costs.

## ADDED Requirements

### Requirement: A photographed receipt yields structured lines

The system SHALL extract from a receipt photograph a set of line items, each
carrying the text as printed and its price where one is shown, together with the
store name and purchase date where the receipt shows them.

Where a line shows a quantity or a unit, the system SHALL capture those too.

#### Scenario: Lines and header are extracted

- **WHEN** a grocery receipt is photographed
- **THEN** its line items are returned with their printed text
- **AND** the store name and purchase date are returned where present

#### Scenario: A missing header does not fail the import

- **WHEN** a receipt shows no legible date
- **THEN** the lines are still extracted
- **AND** the purchase date falls back to the date of capture

#### Scenario: Quantity is captured where printed

- **WHEN** a line shows a multiple, such as two of one item
- **THEN** the captured quantity reflects it

### Requirement: Receipts are typed, and only grocery receipts create stock

The system SHALL record whether a receipt is a grocery purchase, a restaurant
purchase, or neither, defaulting to its best determination and letting the user
correct it.

A receipt that is not a grocery purchase SHALL record its spending and MUST NOT
create any pantry item.

#### Scenario: A restaurant receipt records spending only

- **WHEN** a receipt identified as a restaurant purchase is imported
- **THEN** its total is recorded as spending
- **AND** no pantry item is created

#### Scenario: The user can correct the type

- **GIVEN** a receipt the system typed as grocery
- **WHEN** the user marks it as a restaurant purchase
- **THEN** any pantry items it created are removed
- **AND** its spending record is retained

### Requirement: Non-food lines are recognised as such, not treated as unknown food

The system SHALL classify lines that are not food — household goods, carrier
bags, tax, subtotals, totals, discounts, and payment lines — and exclude them
from ingredient resolution.

A non-food line MUST NOT be added to the unresolved review queue.

#### Scenario: Household goods are excluded

- **WHEN** a receipt contains paper towels and batteries
- **THEN** neither line is resolved as an ingredient
- **AND** neither appears in the review queue

#### Scenario: Receipt arithmetic is excluded

- **WHEN** a receipt contains subtotal, tax, and total lines
- **THEN** none is treated as a purchasable item

#### Scenario: Unknown food is still queued

- **WHEN** a line is food but matches no canonical ingredient
- **THEN** it is added to the review queue
- **AND** is distinguishable from a line excluded as non-food

### Requirement: Lines resolve through the existing matcher

The system SHALL resolve food lines to canonical ingredients using the
established resolution cascade, passing the receipt as the reference source, and
SHALL NOT implement a separate matching path.

Resolution SHALL be requested for the receipt's lines together rather than one
line at a time.

#### Scenario: A whole receipt resolves in one pass

- **WHEN** a receipt with several unresolvable lines is imported
- **THEN** resolution for those lines is requested together

#### Scenario: Resolution outcomes are honoured

- **WHEN** a line resolves only to the confirmation band
- **THEN** it is presented for confirmation rather than applied silently

### Requirement: The store informs normalisation

The system SHALL make the identified store available to line normalisation, so
that store-specific prefixes and abbreviations are handled with knowledge of
their origin.

#### Scenario: A store-brand prefix is stripped knowingly

- **GIVEN** a receipt identified as being from a particular retailer
- **WHEN** its lines carry that retailer's own-brand prefix
- **THEN** the prefix is treated as a prefix rather than part of the food name

### Requirement: A purchase creates a pantry item and reconciles with existing stock

For each resolved food line on a grocery receipt, the system SHALL create a
pantry item at the purchased quantity, with the receipt's purchase date, and
with no accumulated estimation drift.

The system SHALL then reconcile against existing items of the same canonical
ingredient: items that are out SHALL be marked replaced; an item that is running
low SHALL prompt the user once to say whether it is finished; items in stock
SHALL be left alone.

#### Scenario: Buying a replacement clears the empty one

- **GIVEN** an existing soy sauce item whose status is out
- **WHEN** a receipt records a soy sauce purchase
- **THEN** a new pantry item is created
- **AND** the out item is marked replaced

#### Scenario: Buying a second bottle keeps both

- **GIVEN** an existing sesame oil item that is in stock
- **WHEN** a receipt records a sesame oil purchase
- **THEN** a new pantry item is created
- **AND** the existing item is unchanged

#### Scenario: A running-low item asks once

- **GIVEN** an existing item whose status is running low
- **WHEN** a receipt records a purchase of the same ingredient
- **THEN** the user is asked once whether the existing one is finished
- **AND** is not asked again for that item

#### Scenario: A purchase starts with no drift

- **WHEN** a pantry item is created from a receipt
- **THEN** its estimated-decrement count is zero
- **AND** its quantity is the purchased quantity

### Requirement: Prices are recorded per line and per receipt

The system SHALL record the total price of each line and the receipt total,
distinguishing a line's total from its per-unit price where a quantity greater
than one is shown.

Prices SHALL be stored against the pantry items created, so that value at risk
can be computed later.

#### Scenario: A multiple records both prices

- **WHEN** a line shows two units at a combined price
- **THEN** both the line total and the per-unit price are recoverable

#### Scenario: Price reaches the pantry item

- **WHEN** a pantry item is created from a priced receipt line
- **THEN** that item carries the price paid for it

### Requirement: The user reviews before anything is applied

The system SHALL present the extracted and resolved receipt for review, allowing
the user to correct a matched ingredient, change a quantity or price, exclude a
line, and change the receipt type, before any pantry item is created.

Corrections made during review SHALL teach the matcher, so the same line
resolves correctly next time.

#### Scenario: Nothing is applied before review is accepted

- **WHEN** a receipt has been extracted but not accepted
- **THEN** no pantry item exists for it

#### Scenario: A correction is learned

- **WHEN** the user corrects a line's matched ingredient during review
- **THEN** a later receipt carrying the same line text resolves to the
  corrected ingredient

#### Scenario: An excluded line applies nothing

- **WHEN** the user excludes a line during review
- **THEN** it creates no pantry item
- **AND** it is not queued as unresolved

### Requirement: Receipts import without a connection

Where extraction cannot run because there is no connection, the system SHALL
retain the captured receipt and complete the import when a connection returns,
without the user re-photographing it.

#### Scenario: A receipt captured offline is not lost

- **GIVEN** no network connection
- **WHEN** the user photographs a receipt
- **THEN** it is retained pending extraction
- **AND** the user is told it will be processed later

#### Scenario: A pending receipt completes later

- **GIVEN** a receipt retained while offline
- **WHEN** a connection returns
- **THEN** extraction runs and the receipt is presented for review

### Requirement: Receipt data is covered by data deletion

The system SHALL remove all receipts, receipt lines, and stored receipt images
when the user deletes all application data.

#### Scenario: Delete all data clears receipts

- **WHEN** the user chooses to delete all data
- **THEN** no receipt, line, or receipt image remains
