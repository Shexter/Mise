## Purpose

The fast lane for packaged goods: point the camera at a barcode and the item is
in the pantry. Two seconds instead of fifteen, no model call, and free once the
same product has been seen before.

## ADDED Requirements

### Requirement: The camera scans product barcodes

The system SHALL recognise standard retail product barcodes through the device
camera, and SHALL indicate clearly when a code has been read.

#### Scenario: A barcode is recognised

- **WHEN** the user points the camera at a product barcode
- **THEN** the code is read
- **AND** the user is given immediate feedback that it was read

#### Scenario: The same code is not read twice in one pass

- **WHEN** the camera remains pointed at a code already read in this session
- **THEN** it is not counted a second time

### Requirement: A known barcode resolves offline and instantly

Where a barcode is already held locally, the system SHALL resolve it to its
canonical ingredient without any network request.

#### Scenario: A cached barcode needs no connection

- **GIVEN** a barcode previously looked up and stored
- **AND** no network connection
- **WHEN** it is scanned
- **THEN** it resolves to its canonical ingredient

#### Scenario: A cached barcode makes no request

- **GIVEN** a barcode already held locally
- **WHEN** it is scanned
- **THEN** no remote lookup is made

### Requirement: An unknown barcode is looked up and remembered

Where a scanned barcode is not held locally, the system SHALL attempt a remote
lookup, and on success SHALL store the resulting product — its identifier,
name, brand, package size, and nutrition where available — so the lookup is
never repeated.

#### Scenario: A successful lookup is cached

- **WHEN** an unknown barcode is looked up successfully
- **THEN** a product record is stored against that barcode
- **AND** a later scan of it makes no further request

#### Scenario: Nutrition is captured where the source has it

- **WHEN** a lookup returns per-quantity nutrition
- **THEN** it is stored on the product

### Requirement: A product maps to a canonical ingredient through the existing matcher

The system SHALL resolve a looked-up product's name to a canonical ingredient
using the established resolution cascade, and MUST NOT implement a separate
matching path.

Where resolution is uncertain, the system SHALL ask the user rather than
guessing, and the answer SHALL be remembered against that barcode.

#### Scenario: A product name resolves to a food

- **WHEN** a lookup returns a branded product name
- **THEN** it is resolved to a canonical ingredient through the standard cascade

#### Scenario: An uncertain mapping asks once

- **WHEN** a looked-up product name resolves only to the confirmation band
- **THEN** the user is asked which ingredient it is
- **AND** a later scan of the same barcode does not ask again

### Requirement: An unknown barcode never dead-ends

Where a barcode cannot be resolved — absent from the remote source, or the
source unreachable — the system SHALL offer the user a way to continue by
photograph or by manual entry, and SHALL remember the mapping they supply
against that barcode.

#### Scenario: A barcode missing from the source offers a fallback

- **WHEN** a lookup finds no product for a scanned barcode
- **THEN** the user is offered photograph or manual entry
- **AND** is not left with a failed scan and no next step

#### Scenario: An offline unknown barcode still proceeds

- **GIVEN** no network connection
- **WHEN** an uncached barcode is scanned
- **THEN** the user is offered a way to add the item without the lookup

#### Scenario: A user-supplied mapping is remembered

- **GIVEN** a barcode the remote source did not know
- **WHEN** the user identifies the ingredient by hand
- **THEN** a later scan of that barcode resolves to it without asking

### Requirement: Several items can be scanned before any review

The system SHALL support scanning multiple items in succession without leaving
the camera, collecting them for a single review at the end rather than
interrupting after each scan.

The user SHALL be able to see a running count of what has been scanned, and to
remove an item before the batch is applied.

#### Scenario: Scanning continues without interruption

- **WHEN** the user scans several items in succession
- **THEN** the camera remains active throughout
- **AND** no per-item confirmation interrupts the sequence

#### Scenario: The batch is reviewed once

- **WHEN** the user finishes scanning
- **THEN** every scanned item is presented together for review

#### Scenario: An item can be dropped before applying

- **WHEN** the user removes a scanned item during review
- **THEN** it creates no pantry item

### Requirement: Applying a scan creates stock

On accepting a scanned batch, the system SHALL create a pantry item for each
scanned product, using the product's package size as the quantity and the
canonical ingredient's default location, with no accumulated estimation drift.

#### Scenario: A scan becomes a pantry item

- **WHEN** a scanned batch is accepted
- **THEN** each item appears in the pantry with a predicted expiry

#### Scenario: Package size becomes the quantity

- **WHEN** a product with a known package size is applied
- **THEN** the created item's quantity is that package size

#### Scenario: Nothing is applied before acceptance

- **WHEN** a scanning session is abandoned
- **THEN** no pantry item is created

### Requirement: A malformed code is rejected before any lookup

The system SHALL validate a scanned code's structure and check digit before
looking it up, and SHALL treat a code failing validation as an unread scan
rather than as an unknown product.

A code failing validation MUST NOT be cached as a miss.

#### Scenario: A misread is not looked up

- **WHEN** a scanned code fails its check digit
- **THEN** no lookup request is made

#### Scenario: A misread is not remembered as absent

- **WHEN** a scanned code fails validation
- **THEN** it is not recorded as a known miss

#### Scenario: A misread invites another scan

- **WHEN** a code cannot be validated
- **THEN** the user is invited to scan again

### Requirement: Store-local codes are recognised as local, not as missing products

The system SHALL recognise codes reserved for restricted circulation — those a
retailer prints in-store for loose or variable-weight goods — and SHALL route
them to identification by photograph or by hand rather than to a remote lookup.

Such a code MUST NOT be cached as a miss, and MUST NOT be bound to a canonical
ingredient as though it identified a product globally.

#### Scenario: A store-local code is not looked up remotely

- **WHEN** a code in the restricted-circulation range is scanned
- **THEN** no remote lookup is made
- **AND** the user is offered identification by photograph or by hand

#### Scenario: A store-local code is not learned as a product

- **GIVEN** the user identifies an item behind a store-local code
- **WHEN** the same code range is scanned later
- **THEN** the earlier identification is not applied to it

#### Scenario: An embedded weight is not read as a product quantity

- **WHEN** a store-local code carries an embedded price or weight
- **THEN** it is not used as the created item's quantity

### Requirement: A multi-pack creates one pantry item per container

Where a scanned product is a multi-pack and the number of containers it holds is
known, the system SHALL create that many pantry items, each holding one
container's size.

Where the count is not known, the system SHALL create a single item and SHALL
NOT infer a count.

The system SHALL retain an explicit container count as nullable product
metadata. It MUST set that metadata only when the source or the user explicitly
states a positive count; a total package quantity alone MUST NOT imply one.

#### Scenario: A known multi-pack creates its containers

- **GIVEN** a scanned product known to hold several containers
- **WHEN** the batch is applied
- **THEN** one pantry item is created per container

#### Scenario: Each container carries a single container's size

- **WHEN** a multi-pack is applied
- **THEN** each created item's quantity is one container's size
- **AND** not the pack's total

#### Scenario: An unknown pack count creates one item

- **WHEN** a product's container count is not known
- **THEN** one pantry item is created

#### Scenario: The user can correct the pack count

- **WHEN** a multi-pack's container count is shown during review
- **THEN** the user can change it before the batch is applied

#### Scenario: A known pack count survives a later scan

- **GIVEN** a product whose explicit container count was stored
- **WHEN** it is scanned again from the local product cache
- **THEN** review shows that stored count
- **AND** applying it creates that many independent pantry items

#### Scenario: A total package quantity does not invent a count

- **GIVEN** a product labelled only with a total quantity such as `2.4 l`
- **WHEN** it is scanned
- **THEN** its container count remains unknown
- **AND** applying it creates one pantry item unless the user supplies a count

### Requirement: Remote data is attributed and its quality is not assumed

The system SHALL attribute the remote product source where its data is shown,
and SHALL let the user correct a name, brand, or package size that the lookup
returned wrongly.

#### Scenario: The source is credited

- **WHEN** product data from the remote source is displayed
- **THEN** the source is attributed

#### Scenario: Wrong looked-up data is correctable

- **WHEN** a lookup returns an incorrect package size
- **THEN** the user can correct it before the item is created
- **AND** the correction is kept

### Requirement: A scan result explains facts before asking for action

The system SHALL present a recognised product as a factual result before it can
create pantry stock. The result MUST show the product identity, source, package
and container information, available nutrition, and which expected fields are
unknown. It MUST NOT replace those facts with a health score or use colour as a
good/bad food verdict.

#### Scenario: A complete remote result is shown

- **WHEN** a barcode resolves from a remote product source
- **THEN** the result identifies that source
- **AND** shows the returned identity, package, container, and nutrition fields
- **AND** keeps the add-to-pantry action behind review

#### Scenario: A cached result is shown

- **WHEN** a barcode resolves from the local product cache
- **THEN** the result is available without a network request
- **AND** indicates that Mise recognised it locally

#### Scenario: Product data is incomplete

- **WHEN** one or more expected fields are absent from the product record
- **THEN** each absent field is presented as unknown or not provided
- **AND** the system does not derive, zero-fill, or visually imply the value

#### Scenario: A result is not a health verdict

- **WHEN** any barcode result is displayed
- **THEN** the system does not assign a good/bad colour, health grade, or
  proprietary numeric score to the product

### Requirement: Every displayed product fact remains correctable

The system SHALL allow a user to correct a looked-up product's name, brand,
package quantity, package unit, and explicit container count before creating
pantry stock. A correction MUST update the locally cached product used by later
offline scans.

#### Scenario: A package fact is corrected

- **WHEN** the displayed package quantity, unit, or container count is wrong
- **THEN** the user can correct it during review
- **AND** the pantry preview updates before confirmation

#### Scenario: A correction is reused offline

- **GIVEN** a user corrected a product fact and completed review
- **WHEN** that GTIN is scanned later without a connection
- **THEN** the corrected local product fact is shown

### Requirement: Guided fallback retains barcode identity

The system SHALL retain a globally meaningful GTIN while an unknown,
unresolved, or incomplete product is identified by package photographs or
manual entry. It MUST offer distinct capture prompts for the package front,
declared quantity, and nutrition label when photograph identification is used.
No submitted photograph or extracted field may create stock before review.

#### Scenario: An unknown product is photographed

- **WHEN** a global GTIN is absent from the remote source and the user chooses
  photograph identification
- **THEN** the GTIN remains attached to the recovery draft
- **AND** the app asks only for the package evidence needed to identify and
  review the product

#### Scenario: A photographed fallback is confirmed

- **WHEN** the user confirms the recovered product identity
- **THEN** the local product is bound to the retained GTIN
- **AND** a later scan can resolve it offline

#### Scenario: Provider analysis is unavailable

- **WHEN** package photographs cannot be analysed because no configured
  provider is available or the request fails
- **THEN** the retained GTIN and manual identification path remain available
- **AND** the photographs are not described as having stayed on-device if they
  were submitted to a configured provider

### Requirement: Scan history is local and non-mutating

The system SHALL provide a local history of recently recognised product scans.
Opening a history entry MUST show its current cached facts and MUST NOT create
or change pantry stock.

#### Scenario: A recent result is reopened

- **WHEN** a user opens a product from recent scans
- **THEN** its locally cached result is shown without a remote request
- **AND** no pantry item is created until the normal review is confirmed

#### Scenario: Scan history is cleared

- **WHEN** the user clears recent scan history
- **THEN** the history entries are removed locally
- **AND** existing pantry items and product corrections are not deleted

### Requirement: Shelf images cannot directly create stock

The system MUST NOT infer purchased products or quantities from a whole-shelf
image and write them to the pantry.

#### Scenario: A shelf contains several visible products

- **WHEN** a user photographs or presents a shelf containing several products
- **THEN** the system does not treat every visible product as purchased stock
- **AND** requires individual product selection and review before any pantry
  record can be created
