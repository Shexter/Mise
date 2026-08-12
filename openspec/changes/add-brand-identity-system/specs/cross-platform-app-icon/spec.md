## Purpose

Provide a supplied, recognisable Mise PNG app icon that renders safely in Expo,
iOS, and Android launcher shapes.

## ADDED Requirements

### Requirement: Mise has a source-controlled supplied PNG collection
The product SHALL retain the supplied PNG icon collection with descriptive,
stable names. `2.png` SHALL be recorded as the lighter-dark iOS icon variant
and `7.png` as the pure-dark iOS icon variant. The product MUST NOT require
Figma, generated layers, vectors, or Icon Composer source to deliver them.

#### Scenario: The icon is prepared for export
- **WHEN** a developer prepares a new app build
- **THEN** the selected source filenames and destination asset paths are recorded
- **AND** all unselected supplied PNGs remain unchanged as named alternatives
- **AND** the foreground remains within the documented Android safe area

#### Scenario: The icon is viewed at small launcher size
- **WHEN** the system displays the icon in a launcher, settings, notification, or share surface
- **THEN** the Mise mark remains identifiable without relying on small text or fine detail

### Requirement: Expo/iOS delivers the two approved PNG variants
The product SHALL configure `ios.icon.light` with the supplied `2.png` asset
and `ios.icon.dark` with the supplied `7.png` asset. It SHALL omit a tinted
variant in this change.

#### Scenario: An iOS appearance changes
- **WHEN** a supported iOS device switches between light and dark app-icon appearances
- **THEN** the matching approved PNG is displayed
- **AND** the core Mise mark remains recognisable

#### Scenario: Tinted icon mode is used
- **WHEN** a person uses iOS tinted icon appearance
- **THEN** this change does not provide a bespoke Mise tinted asset
- **AND** the build retains a legible fallback icon

### Requirement: Android launcher icons support safe raster rendering
The product SHALL configure original `1.png` as Android's regular and adaptive
foreground raster asset. The foreground MUST remain inside the documented
adaptive-icon safe area. The existing monochrome PNG is used only if themed-icon
testing accepts it.

#### Scenario: An Android launcher uses a different mask
- **WHEN** an Android launcher applies a circular or squircle mask
- **THEN** the foreground mark is not clipped
- **AND** the background fills the enclosure

#### Scenario: A person enables themed icons
- **WHEN** an Android launcher supports themed icons and the person enables them
- **THEN** the app uses the approved supplied monochrome asset if one passed review
- **AND** it remains recognisable
