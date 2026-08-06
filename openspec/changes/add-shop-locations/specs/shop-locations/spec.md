## Purpose

Knowing when the user is at a shop they use, so the app can be useful at the one
moment it currently cannot reach them — and doing it without learning where they
have been.

## ADDED Requirements

### Requirement: Location is optional and the app is whole without it

The system SHALL function fully without location permission, and every feature
depending on it SHALL have an equivalent the user can reach manually.

The system SHALL NOT request the permission before explaining what it is for.

#### Scenario: Everything works without the permission

- **GIVEN** location permission has not been granted
- **WHEN** the app is used
- **THEN** every existing feature behaves as before

#### Scenario: The request explains itself

- **WHEN** location permission is requested
- **THEN** the user is told what it is used for before the request

#### Scenario: Declining is not punished

- **GIVEN** the user declines the permission
- **WHEN** they use the app
- **THEN** they are not asked again unprompted
- **AND** manual equivalents remain available

#### Scenario: The permission can be withdrawn

- **WHEN** the user revokes location permission
- **THEN** the app continues to work
- **AND** stored shop positions can be deleted

### Requirement: Position never leaves the device

The system MUST NOT transmit a position, a shop location, or any derivative of
either.

#### Scenario: No position is sent

- **WHEN** the app determines it is at a shop
- **THEN** no request carrying a position is made

#### Scenario: Extraction requests carry no position

- **WHEN** a receipt or image is sent for extraction
- **THEN** the request carries no location data

### Requirement: Shop positions are stored; visits are not

The system SHALL store the position of a shop, and MUST NOT store a history of
the user's presence at it or anywhere else.

#### Scenario: A shop's position is retained

- **WHEN** a shop is learned
- **THEN** its position is stored

#### Scenario: Arrivals are not recorded

- **WHEN** the user arrives at and leaves a known shop
- **THEN** no record of that visit is stored

#### Scenario: The stored data cannot reconstruct movement

- **WHEN** stored location data is inspected
- **THEN** it contains shop positions only
- **AND** no timestamps of presence

### Requirement: Shops are learned from receipts, not downloaded

The system SHALL learn a shop's position when a receipt from it is imported with
permission granted, and MUST NOT fetch a list of nearby shops from a remote
source.

#### Scenario: Importing a receipt learns the shop

- **GIVEN** location permission is granted
- **WHEN** a receipt naming a store is imported at that store
- **THEN** the shop and its position are remembered

#### Scenario: No remote lookup is made

- **WHEN** shops are determined
- **THEN** no request for nearby places is made

#### Scenario: An unknown shop is simply unknown

- **GIVEN** a shop no receipt has been imported from
- **WHEN** the user is there
- **THEN** nothing is surfaced

#### Scenario: A learned shop is editable

- **WHEN** the user views their known shops
- **THEN** they can rename or remove any of them

### Requirement: Arriving at a known shop surfaces what is needed

Where the user arrives at a known shop, the system SHALL make available the
ingredients currently running low or out.

#### Scenario: Arrival surfaces low stock

- **GIVEN** a known shop and stock that is running low or out
- **WHEN** the user arrives
- **THEN** those ingredients are made available to them

#### Scenario: Nothing needed surfaces nothing

- **GIVEN** no stock is running low or out
- **WHEN** the user arrives at a known shop
- **THEN** nothing is surfaced

#### Scenario: No quantity is claimed

- **WHEN** an ingredient is surfaced as needed
- **THEN** it is described by its status
- **AND** no estimated remaining amount is shown

### Requirement: Leaving a known shop offers capture

Where the user leaves a known shop, the system SHALL offer to capture what was
bought, and MUST NOT capture, import, or alter stock on its own.

#### Scenario: Departure offers capture

- **WHEN** the user leaves a known shop
- **THEN** they are offered to capture what they bought

#### Scenario: Nothing happens without the user

- **WHEN** the user ignores the offer
- **THEN** no pantry item, receipt, or stock change is created

#### Scenario: The offer reaches the existing capture surface

- **WHEN** the user accepts the offer
- **THEN** the existing capture surface opens

### Requirement: A recognised shop informs receipt matching

Where a receipt is imported at or shortly after being at a known shop, the
system SHALL make that shop's identity available to line normalisation.

A shop identity SHALL NOT override a store name the receipt itself states.

#### Scenario: A recognised shop supplies the store

- **GIVEN** a receipt whose own store name is not legible
- **AND** it was captured at a known shop
- **THEN** that shop's store name informs normalisation

#### Scenario: The receipt's own header wins

- **GIVEN** a receipt stating its store name
- **WHEN** it was captured at a different known shop
- **THEN** the receipt's own store name is used
