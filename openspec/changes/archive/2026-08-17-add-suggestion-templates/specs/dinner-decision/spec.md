## ADDED Requirements

### Requirement: Tonight preferences are distinct from request modes

The dinner decision system SHALL retain `tonight`, stretch planning, and
macro-gap as distinct request modes. Only a tonight request SHALL carry a
resolved suggestion-template preference.

#### Scenario: A tonight request carries a resolved preference

- **WHEN** dinner ideas for tonight are requested
- **THEN** the request uses one resolved base intent and one prep-speed value

#### Scenario: A stretch plan remains a plan

- **WHEN** the user requests dinners through a date
- **THEN** the request does not apply a tonight template or prep-speed modifier
- **AND** it retains its no-shopping plan behaviour

#### Scenario: A macro-gap request remains macro-first

- **WHEN** the user requests help with a named macro gap
- **THEN** the request does not apply a tonight template or prep-speed modifier
- **AND** it retains its targeted macro identity and partial-coverage behaviour

### Requirement: Tonight selection uses the resolved preference safely

The system SHALL apply the resolved tonight preference to provider framing and
local selection without bypassing dietary exclusion, use-first eligibility, or
the calorie non-filter rule.

#### Scenario: Preference changes the surviving ordering

- **GIVEN** the same eligible candidate pool
- **WHEN** two resolved tonight preferences are selected
- **THEN** the system may order the candidates differently
- **AND** it uses the same underlying candidate facts for both

#### Scenario: A preference cannot restore an excluded dish

- **GIVEN** a candidate excluded by a dietary rule or the use-first constraint
- **WHEN** any tonight preference is selected
- **THEN** the candidate is not displayed

#### Scenario: Unknown nutrition stays neutral

- **GIVEN** a candidate with unknown nutrition evidence for a template-specific signal
- **WHEN** the candidate is selected under that template
- **THEN** the unknown value is not converted to zero or a negative score
- **AND** the candidate is not hidden for that reason

### Requirement: Cached tonight results are isolated by preference

The system SHALL not reuse a cached tonight result for a different resolved
base intent or prep-speed value. Stretch and macro-gap cache identities SHALL
remain independent of tonight preferences.

#### Scenario: Changing a base intent does not reuse a result

- **GIVEN** a cached tonight result under one base intent
- **WHEN** a different base intent is resolved
- **THEN** that cached result is not shown as the result for the new intent

#### Scenario: Changing prep speed does not reuse a result

- **GIVEN** a cached tonight result under standard preparation speed
- **WHEN** quick preparation speed is resolved
- **THEN** that cached result is not shown as the result for quick speed
