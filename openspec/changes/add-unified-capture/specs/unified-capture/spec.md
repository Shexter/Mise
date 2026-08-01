## Purpose

One action for putting anything into the pantry. The user points a camera at a
barcode, a receipt, or the food itself; the app works out which it is. Deciding
that is the app's job, not theirs.

## ADDED Requirements

### Requirement: There is one action for adding to the pantry

The system SHALL provide a single action for adding items to the pantry by
camera, and MUST NOT require the user to choose an input method before
capturing.

Specialised handling SHALL be selected by the system, never presented as a
choice.

#### Scenario: One action covers every camera input

- **WHEN** the user chooses to add to the pantry
- **THEN** a single capture surface opens
- **AND** they are not asked whether they have a barcode, a receipt, or an item

#### Scenario: The handler is not named as an option

- **WHEN** the capture surface is shown
- **THEN** no choice between scanning, receipt import, or photographing is
  offered

#### Scenario: Manual entry remains reachable

- **WHEN** the user cannot or does not want to use the camera
- **THEN** entering an item by hand is still available

### Requirement: A resolvable product barcode is handled without a model call

Where a product barcode is in frame and resolves to a known product, the system
SHALL handle it as a product and MUST NOT send the image for classification.

#### Scenario: A recognised barcode short-circuits

- **GIVEN** a product barcode that resolves
- **WHEN** it is in frame
- **THEN** it is handled as a product
- **AND** no image classification is performed

#### Scenario: A cached barcode needs no network at all

- **GIVEN** a barcode already held locally
- **WHEN** it is in frame
- **THEN** it resolves with no request of any kind

### Requirement: An unresolvable barcode does not capture the capture

Where a barcode is detected but does not resolve to a product, the system SHALL
continue to image classification rather than reporting a failed scan.

#### Scenario: A receipt's own barcode does not misroute it

- **GIVEN** a receipt carrying a barcode that resolves to no product
- **WHEN** it is captured
- **THEN** it is classified from its image
- **AND** is handled as a receipt

#### Scenario: An unknown product barcode still reaches a handler

- **GIVEN** a product barcode absent from every source
- **WHEN** it is captured
- **THEN** the image is classified and handled accordingly
- **AND** the user is not left with a failed scan and no next step

### Requirement: Classification and extraction happen in one request

Where an image must be interpreted, the system SHALL classify and extract in a
single request, returning a result that identifies which kind of thing was
found alongside the content extracted for that kind.

The system MUST NOT make a separate classification request before extracting.

#### Scenario: One request produces a typed result

- **WHEN** an image is interpreted
- **THEN** exactly one request is made
- **AND** the result states what kind of thing it found

#### Scenario: A receipt returns receipt content

- **WHEN** a receipt is interpreted
- **THEN** the result identifies it as a receipt
- **AND** carries its lines

#### Scenario: Groceries return item content

- **WHEN** a photograph of food items is interpreted
- **THEN** the result identifies it as items
- **AND** carries the items found

### Requirement: Photographed groceries become catalogue items

The system SHALL turn a photograph of one or more food items into pantry items,
resolving each to a canonical ingredient and proposing a storage location.

Multiple items in one photograph SHALL each be identified separately.

#### Scenario: A single item is catalogued

- **WHEN** one food item is photographed
- **THEN** it resolves to a canonical ingredient
- **AND** a pantry item is proposed for it

#### Scenario: Several items in one photograph are separated

- **WHEN** several food items are photographed together
- **THEN** each is identified separately

#### Scenario: A storage location is proposed

- **WHEN** an item is identified
- **THEN** a storage location is proposed for it
- **AND** the user can change it

### Requirement: Nothing is written before the user reviews it

Every route SHALL present what it found for review, and MUST NOT create pantry
items, receipts, or stock changes before the user accepts.

#### Scenario: A misrouted capture is visible before it is applied

- **GIVEN** a capture the system classified wrongly
- **WHEN** the result is presented
- **THEN** the mistake is visible
- **AND** nothing has been written

#### Scenario: Abandoning a capture leaves no trace

- **WHEN** the user abandons a capture without accepting
- **THEN** no pantry item, receipt, or stock change exists for it

### Requirement: Genuine ambiguity is resolved by asking once

Where the system cannot determine what it is looking at, it SHALL ask the user,
and SHALL NOT guess.

Asking SHALL be the exception, reached only when classification is
inconclusive.

#### Scenario: An unclear capture asks

- **WHEN** classification cannot determine what was captured
- **THEN** the user is asked what it is

#### Scenario: A clear capture never asks

- **WHEN** classification determines what was captured
- **THEN** the user is not asked to confirm the kind

#### Scenario: A non-food capture is reported, not forced

- **WHEN** a capture contains nothing the app can use
- **THEN** the user is told
- **AND** no items are invented from it

### Requirement: A receipt too long for one frame is captured in several

Where a receipt does not fit legibly in a single frame, the system SHALL allow
further captures to be added to the same receipt, and SHALL produce one receipt
from them.

The system SHALL show what has been captured so far, and SHALL allow a capture
to be retaken or removed before interpretation.

#### Scenario: Several frames make one receipt

- **WHEN** a receipt is captured across more than one frame
- **THEN** one receipt is produced
- **AND** its lines span the frames captured

#### Scenario: Overlapping frames do not duplicate lines

- **GIVEN** two captures of one receipt that overlap
- **WHEN** they are interpreted
- **THEN** a line appearing in both is not recorded twice

#### Scenario: A frame can be retaken

- **WHEN** the user retakes one of several captures
- **THEN** the others are retained

#### Scenario: A single-frame receipt asks for nothing extra

- **WHEN** a receipt fits in one frame
- **THEN** no additional capture is requested

### Requirement: Capture degrades without a provider or a connection

Where an image cannot be interpreted — no key configured, or no connection —
the system SHALL say so plainly, retain the capture where retrying later is
possible, and leave manual entry available.

#### Scenario: No key still allows adding by hand

- **GIVEN** no API key is configured
- **WHEN** the user opens capture
- **THEN** they are told interpretation needs a key
- **AND** manual entry remains available

#### Scenario: An offline capture is retained

- **GIVEN** no connection
- **WHEN** the user captures an image
- **THEN** it is retained for interpretation when a connection returns
- **AND** the user is told it is pending

### Requirement: A pending capture lands on review, never on the pantry

The system SHALL hold pending captures until they can be interpreted, SHALL
present each interpreted result for review, and MUST NOT apply a pending capture
without the user reviewing it.

Pending captures SHALL be visible, countable, and individually discardable.

#### Scenario: An interpreted pending capture waits for review

- **GIVEN** a pending capture
- **WHEN** it is interpreted after a connection returns
- **THEN** its result is presented for review
- **AND** nothing is written until the user accepts

#### Scenario: Pending captures are visible

- **WHEN** captures are pending
- **THEN** the user can see how many and what they are

#### Scenario: A pending capture can be discarded

- **WHEN** the user discards a pending capture
- **THEN** it is not interpreted
- **AND** its retained image is removed

#### Scenario: Interpretation that keeps failing is reported

- **GIVEN** a pending capture whose interpretation fails repeatedly
- **WHEN** the user views pending captures
- **THEN** they are told it is failing rather than told it is still waiting

#### Scenario: Adding a key releases the queue

- **GIVEN** captures pending because no key was configured
- **WHEN** a key is configured
- **THEN** they become interpretable
