## Purpose

Give Mise a recognisable, calm visual identity that makes the local-first food
workflow feel coherent without hiding uncertainty or adding decorative friction.

## ADDED Requirements

### Requirement: Mise presents one coherent brand identity
The product SHALL use one documented visual and verbal identity across its
launcher assets, onboarding, primary tabs, capture, pantry, recipes, settings,
empty states, and recovery states.

The identity MUST express Mise as a calm, practical kitchen companion. It MUST
retain the name Mise and its *mise en place* meaning. It MUST NOT use body
evaluation, health claims, mascots, or generic food imagery that conflicts with
the Asian-pantry differentiator.

#### Scenario: A person encounters a primary app surface
- **WHEN** a person opens any primary app surface
- **THEN** typography, colour roles, iconography, spacing, and feedback use the documented Mise system
- **AND** no screen introduces a conflicting visual treatment

#### Scenario: The app communicates uncertainty
- **WHEN** a value, capture result, or pantry state is uncertain
- **THEN** its visual treatment supports the existing honest wording
- **AND** it does not use confidence, decoration, or motion to imply certainty

### Requirement: Mise offers three coherent colour themes
The product SHALL offer Organic, Utility, and Cool Organic themes. Organic SHALL
be the default when no valid preference exists. A person's selection SHALL stay
on the device and apply on the next application load.

Each theme MUST provide the same semantic colour roles. Screens MUST NOT fork
their behavior, layout, or data contract by theme. Semantic food, status,
destructive, and action roles MUST remain distinguishable and MUST NOT rely on
colour alone.

#### Scenario: Mise starts without a theme preference
- **WHEN** the app cannot read a valid saved theme
- **THEN** it uses Organic
- **AND** Organic retains cream, sand, terracotta, and sage with reduced yellow warmth

#### Scenario: A person changes theme
- **WHEN** the person selects Utility or Cool Organic in Settings
- **THEN** the preference is stored only on the device
- **AND** the complete shared interface uses that palette after the application reloads

#### Scenario: A primary action is displayed
- **WHEN** any theme displays a primary action
- **THEN** it uses that theme's semantic action and on-action roles
- **AND** remains distinguishable from destructive, status, and macro meanings

#### Scenario: a screen is rendered under another theme
- **WHEN** the same Today, Pantry, capture, Recipes, or Settings surface is rendered under each theme
- **THEN** its content, order, controls, and uncertainty wording remain the same
- **AND** only governed semantic visual values differ

### Requirement: Brand positioning distinguishes promise from proof
The product SHALL introduce Mise with a concise promise connecting what a
person has, cooks, and tracks. Local-first trust copy MUST state the actual
storage and provider boundary and MUST NOT imply that provider-backed photo or
receipt analysis never sends selected content off the device.

#### Scenario: A person sees the brand introduced
- **WHEN** onboarding or another approved introductory surface presents the
  full Mise identity
- **THEN** it may use “Cook from what you have, tracked as you go.” as the
  product promise
- **AND** supporting copy explains local storage and provider behavior in plain
  language

#### Scenario: A compact privacy claim is displayed
- **WHEN** the product uses a compact trust line such as “On your phone.
  Nowhere else.”
- **THEN** nearby content states that Mise has no account or server and that
  local data is removed with the app
- **AND** it does not conceal provider requests initiated for analysis

### Requirement: Exploratory designs cannot regress current behavior
The product SHALL treat checked-in brand prototypes as visual and copy
references. Current product decisions, accepted requirements, and app behavior
MUST remain authoritative when a prototype contains an older flow or technical
assumption.

#### Scenario: A prototype conflicts with the current app
- **WHEN** an exploratory screen uses an obsolete provider, calculation,
  navigation path, field, or state transition
- **THEN** implementation preserves the current accepted behavior
- **AND** it applies only the approved visual or verbal treatment

### Requirement: Processing treatments communicate real work
The product MAY use the three macro colours as a shared processing signature
only while food analysis is active. A processing treatment MUST include a
plain-language status, accessible busy state, reduced-motion presentation, and
the operation's applicable recovery path.

#### Scenario: Mise analyzes a meal or receipt
- **WHEN** an active analysis uses the three-dot treatment
- **THEN** the dots correspond to a real pending operation
- **AND** a person can understand the state without relying on colour or motion

#### Scenario: Reduced motion is enabled
- **WHEN** an active analysis is shown with reduced motion enabled
- **THEN** the state uses a static or minimally changing treatment
- **AND** the status label and recovery behavior remain available

### Requirement: Brand assets have governed, reusable roles
The product SHALL use illustrations only from a documented Mise asset family and
only for defined empty, recovery, or milestone states.

Each approved asset MUST define its subject, palette, line weight, framing, and
accessibility description before it is used in the app.

#### Scenario: An empty state uses an illustration
- **WHEN** an approved empty state displays an illustration
- **THEN** the artwork supports a specific next action
- **AND** the same visual language can be reused without creating a new style

#### Scenario: A screen has no approved asset role
- **WHEN** a screen has no defined visual-asset role
- **THEN** it uses the shared component and token system without an ornamental image

#### Scenario: A photograph is evidence for analysis
- **WHEN** a camera, receipt, or meal photograph is being captured or reviewed
- **THEN** the image retains faithful colour and sufficient contrast for
  verification
- **AND** editorial washing or desaturation is not applied

### Requirement: Brand updates remain accessible and cross-platform
The product SHALL preserve readable contrast, screen-reader labels, reduced-motion
behavior, and platform-appropriate controls while applying the identity system.

#### Scenario: A person uses an accessibility setting
- **WHEN** the system uses increased contrast, larger text, a screen reader, or reduced motion
- **THEN** brand treatments remain legible and usable
- **AND** the identity does not depend on colour, animation, or an unlabeled image alone

#### Scenario: The app runs on Android or iOS
- **WHEN** a person uses Mise on Android or iOS
- **THEN** the app feels like the same brand
- **AND** it retains the platform's expected controls and interaction conventions

### Requirement: Text entry remains visible above the keyboard
The product SHALL use shared keyboard-safe layout behavior for screens and
sheets that collect text or numeric input. A focused field, its label, and its
current value MUST remain visible when the Android or iOS keyboard is open.

#### Scenario: A person enters a custom hidden ingredient
- **WHEN** the person focuses a text or numeric field in the hidden-ingredient sheet
- **THEN** the sheet resizes or repositions above the keyboard
- **AND** the active field remains visible without requiring the person to guess its value

#### Scenario: A person edits a long manual or photographed-meal item
- **WHEN** the keyboard opens in a scrollable entry form
- **THEN** the form retains a usable scroll area above the keyboard
- **AND** responsive controls do not wrap labels into unreadable fragments
