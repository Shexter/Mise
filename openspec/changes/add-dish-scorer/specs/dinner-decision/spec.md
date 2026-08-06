## ADDED Requirements

### Requirement: The engine returns a candidate pool

The suggestion request SHALL ask for a pool of candidates rather than the exact
set to be displayed, and the response SHALL be treated as candidates.

#### Scenario: The request asks for a pool

- **WHEN** suggestions are requested in the nightly mode
- **THEN** the request asks for more candidates than are displayed

#### Scenario: Candidates are not shown unfiltered

- **WHEN** a pool is returned
- **THEN** it is filtered and selected from before display

### Requirement: Drop counts are reported against the pool

Where suggestions are removed by a constraint, the count reported SHALL describe
the constraint's effect, and the displayed set SHALL be filled from the
remaining pool where candidates allow.

#### Scenario: A constraint removing candidates need not shorten the display

- **GIVEN** a pool larger than the displayed count
- **WHEN** a constraint removes some candidates
- **THEN** the displayed count is still met where enough remain

#### Scenario: An exhausted pool is reported

- **WHEN** constraints leave fewer candidates than are displayed
- **THEN** the user is told the constraint was applied
