## Purpose

Choosing which generated dishes to show. The model proposes more than are
displayed; the app decides which ones win, from facts it already holds, in an
order it can explain.

## ADDED Requirements

### Requirement: More suggestions are generated than are displayed

The system SHALL request more candidate suggestions than it displays, and SHALL
select the displayed set from that pool.

The pool size and the displayed count SHALL each be a named value, and the pool
SHALL be larger.

#### Scenario: A pool is generated

- **WHEN** suggestions are generated
- **THEN** more candidates are produced than are shown

#### Scenario: The displayed set is selected from the pool

- **WHEN** suggestions are displayed
- **THEN** they are the selected members of the pool

#### Scenario: A short pool still produces suggestions

- **GIVEN** fewer candidates are returned than requested
- **WHEN** they are selected from
- **THEN** the available candidates are shown

### Requirement: Constraints filter the pool before any scoring

The system SHALL apply every absolute constraint to the pool before scoring, and
MUST NOT express an absolute constraint as a ranking weight.

#### Scenario: A forbidden suggestion never reaches the scorer

- **GIVEN** a suggestion excluded by an absolute constraint
- **WHEN** the pool is scored
- **THEN** it is not scored

#### Scenario: No weight can outrank a constraint

- **GIVEN** a suggestion excluded by an absolute constraint
- **WHEN** it would otherwise score highest
- **THEN** it is not displayed

#### Scenario: Filtering a pool leaves candidates

- **GIVEN** a pool and a constraint that removes some of it
- **WHEN** the remainder is scored
- **THEN** the displayed count can still be met where enough candidates remain

### Requirement: Scoring is pure and reads only stated facts

The scorer SHALL be a pure function of a suggestion and the kitchen context, and
MUST NOT perform a request, read the database, or recompute a suggestion's
nutritional figures.

#### Scenario: The same inputs produce the same order

- **WHEN** the same pool and context are scored twice
- **THEN** the resulting order is identical

#### Scenario: Scoring makes no request

- **WHEN** a pool is scored
- **THEN** no network request is made

#### Scenario: Stated figures are used as given

- **WHEN** a suggestion states its calories
- **THEN** the scorer uses that figure rather than deriving another

### Requirement: The displayed set is varied

The system SHALL avoid displaying suggestions that are substantially alike, and
SHALL prefer a lower-scoring candidate that differs over a higher-scoring one
that repeats.

#### Scenario: Near-identical dishes are not all shown

- **GIVEN** a pool containing several substantially similar dishes
- **WHEN** the displayed set is selected
- **THEN** they do not all appear

#### Scenario: Variety outranks a small scoring gap

- **GIVEN** a higher-scoring candidate similar to one already selected
- **AND** a lower-scoring candidate that differs
- **WHEN** the next selection is made
- **THEN** the differing candidate is selected

#### Scenario: Variety never empties the set

- **GIVEN** every candidate is similar to every other
- **WHEN** the displayed set is selected
- **THEN** the displayed count is still met where candidates remain

### Requirement: A suggestion is never altered to improve its score

The system SHALL select and order suggestions, and MUST NOT modify a
suggestion's dish, ingredients, quantities, or method.

#### Scenario: A losing suggestion is dropped, not repaired

- **WHEN** a suggestion scores poorly
- **THEN** it is not shown
- **AND** it is not modified

#### Scenario: Ingredients are not substituted

- **WHEN** a suggestion would score better with a different ingredient
- **THEN** no substitution is made

### Requirement: The scored order replaces the generated order

The order in which suggestions are displayed SHALL be the order the scorer
produced.

#### Scenario: Display order follows the score

- **WHEN** suggestions are displayed
- **THEN** their order is the scored order

#### Scenario: The generated order is not preserved

- **GIVEN** a pool whose scored order differs from the order returned
- **WHEN** it is displayed
- **THEN** the scored order is used

### Requirement: A cached day can be re-ranked without regenerating

The system SHALL retain the pool alongside the displayed set, so that a change
affecting selection can be applied without a new request.

#### Scenario: Re-ranking spends nothing

- **GIVEN** a cached pool
- **WHEN** selection is recomputed
- **THEN** no request is made

#### Scenario: A newly recorded rule re-selects from the cache

- **GIVEN** a cached pool and a newly recorded exclusion
- **WHEN** suggestions are next shown
- **THEN** the excluded candidates are gone
- **AND** no request was made

### Requirement: Every weight is a named, evidenced value

Each scoring weight SHALL be a named constant, and its value SHALL be justified
by measurement against a fixture corpus rather than chosen by assertion.

#### Scenario: Weights are named

- **WHEN** the scorer is read
- **THEN** each weight is a named constant

#### Scenario: A weight change is detectable

- **WHEN** a weight is changed
- **THEN** a test reflecting the measured ordering fails
