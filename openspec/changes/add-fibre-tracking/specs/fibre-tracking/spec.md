## Purpose

Records dietary fibre alongside the existing macros, and is honest about the
fact that it was not always recorded — so a day the app cannot total is never
presented as a day that totalled zero.

## ADDED Requirements

### Requirement: Fibre is recorded per meal item where it is known

The system SHALL record a fibre amount against a meal item where one is
available, and SHALL distinguish an item whose fibre is unknown from one whose
fibre is zero.

An item logged before fibre was recorded, or one whose estimate omitted it,
SHALL be unknown rather than zero.

#### Scenario: An estimated item carries fibre

- **WHEN** a meal is estimated and the estimate includes fibre
- **THEN** each item records its fibre amount

#### Scenario: An omitted figure is unknown, not zero

- **WHEN** an estimate returns no fibre for an item
- **THEN** that item's fibre is unknown
- **AND** it is distinguishable from an item recorded as containing none

#### Scenario: A genuinely fibre-free food records zero

- **WHEN** an item is known to contain no fibre
- **THEN** it records zero
- **AND** that is distinguishable from unknown

### Requirement: Fibre is derived after food resolution

The system SHALL identify foods and quantities during image estimation, then
derive fibre after canonical or barcode resolution. It SHALL prefer structured
product or catalogue nutrition, may use a text-only fallback based on the
resolved food name and quantity, and SHALL keep fibre unknown when no source can
defend a value. Legacy `fibre_g` responses MAY be parsed for compatibility but
the image model SHALL NOT be required to estimate fibre.

#### Scenario: Resolved mixed greens receive post-resolution fibre

- **WHEN** the image identifies mixed greens and a quantity
- **AND** the item resolves to a canonical or product nutrition record
- **THEN** Mise derives and stores fibre after resolution
- **AND** the image response is not the fibre authority

#### Scenario: No resolved source remains unknown

- **WHEN** an identified item has no structured fibre and the text-only fallback
  cannot produce a defensible value
- **THEN** its fibre remains unknown rather than zero

### Requirement: A daily fibre target is set independently of the calorie split

The system SHALL hold a daily fibre target as an absolute amount, and MUST NOT
derive it from a share of the calorie target.

The target SHALL have a sensible default and SHALL be editable by the user.

#### Scenario: Fibre is not a percentage of calories

- **WHEN** the calorie target changes
- **THEN** the fibre target does not change as a consequence

#### Scenario: A default exists without configuration

- **GIVEN** a user who has never set a fibre target
- **WHEN** the day is displayed
- **THEN** a default target is used

#### Scenario: The user can change it

- **WHEN** the user sets a different daily fibre target
- **THEN** subsequent days use it

### Requirement: A day with unknown fibre reports incompleteness, not a total

Where any meal contributing to a day has unknown fibre, the system SHALL report
that day's fibre as incomplete rather than presenting the sum of the known items
as the day's total.

The system MUST NOT display a fibre total that omits unknown contributions
without saying so.

#### Scenario: A pre-existing day does not read as zero

- **GIVEN** a day whose meals were all logged before fibre was recorded
- **WHEN** that day is displayed
- **THEN** its fibre is shown as unknown
- **AND** not as zero against the target

#### Scenario: A partially-known day is marked incomplete

- **GIVEN** a day with one meal carrying fibre and one without
- **WHEN** that day is displayed
- **THEN** the fibre figure is marked incomplete

#### Scenario: A fully-known day totals normally

- **GIVEN** a day where every meal carries fibre
- **WHEN** that day is displayed
- **THEN** its fibre total is shown against the target without qualification

### Requirement: An incomplete day yields no fibre shortfall

The system SHALL NOT compute, state, or act on a fibre shortfall for a day whose
fibre is incomplete.

Where a surface would otherwise offer to close a fibre gap, it SHALL instead
report that the day's fibre is not fully known.

#### Scenario: No gap is stated for an incomplete day

- **GIVEN** a day whose fibre is incomplete
- **WHEN** shortfalls are computed
- **THEN** no fibre shortfall is produced

#### Scenario: The reason is given rather than the surface going blank

- **GIVEN** a day whose fibre is incomplete
- **WHEN** the user asks what they are short of
- **THEN** they are told the day's fibre is not fully known

#### Scenario: A complete day produces a gap normally

- **GIVEN** a day where every meal carries fibre
- **WHEN** shortfalls are computed
- **THEN** a fibre shortfall is produced where one exists

### Requirement: Unknown fibre survives export as unknown

The system SHALL represent unrecorded fibre in exported data as unknown, and
MUST NOT export it as zero.

#### Scenario: Exported unknown fibre is distinguishable from zero

- **WHEN** data containing meals with unrecorded fibre is exported
- **THEN** those meals' fibre is exported as unknown
- **AND** not as a zero value

### Requirement: Fibre appears alongside the existing macros

The system SHALL display fibre with the other macros on the day view, using the
same presentation, and SHALL show its target.

#### Scenario: Fibre is shown with the others

- **WHEN** the day's macros are displayed
- **THEN** fibre appears alongside protein, carbohydrate, and fat

#### Scenario: An incomplete figure is visually distinct

- **WHEN** a day's fibre is incomplete
- **THEN** its presentation differs from a complete one
