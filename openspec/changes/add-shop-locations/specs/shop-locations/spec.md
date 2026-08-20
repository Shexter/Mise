## Purpose

Recognising a shop the user is checking in with, so the app can be useful at
the one moment it currently cannot reach them — and doing it without learning
where they have been, and without watching in the background.

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

- **WHEN** a position read is matched to a known shop
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

#### Scenario: Checks are not recorded

- **WHEN** the user checks a known shop, at receipt import or on demand
- **THEN** no record of that check — or when it happened — is stored

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
- **WHEN** the user checks it
- **THEN** nothing is surfaced

#### Scenario: A learned shop is editable

- **WHEN** the user views their known shops
- **THEN** they can rename or remove any of them

### Requirement: Checking a known shop surfaces what is needed

Where the user checks a known shop, the system SHALL make available the
ingredients currently running low or out. The system MUST NOT determine this
automatically from arrival or departure — checking is a user-initiated action,
using a one-shot foreground position read.

#### Scenario: Checking surfaces low stock

- **GIVEN** a known shop and stock that is running low or out
- **WHEN** the user checks that shop
- **THEN** those ingredients are made available to them

#### Scenario: Nothing needed surfaces nothing

- **GIVEN** no stock is running low or out
- **WHEN** the user checks a known shop
- **THEN** nothing is surfaced

#### Scenario: No quantity is claimed

- **WHEN** an ingredient is surfaced as needed
- **THEN** it is described by its status
- **AND** no estimated remaining amount is shown

#### Scenario: Checking never changes anything

- **WHEN** the user checks a shop, with or without results
- **THEN** no pantry item, receipt, or stock change is created

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
