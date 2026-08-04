## ADDED Requirements

### Requirement: The suggestion engine accepts an objective

The suggestion engine SHALL accept the objective it is being asked to serve, so
that the same payload, prompt discipline, model call, and caching support more
than one question.

Adding an objective MUST NOT require a second engine, a second prompt module, or
a second cache.

#### Scenario: Different objectives share one engine

- **WHEN** suggestions are requested for a different objective
- **THEN** the same engine produces them

#### Scenario: The objective changes what is optimised

- **GIVEN** the same kitchen
- **WHEN** suggestions are requested for two different objectives
- **THEN** the results differ according to the objective

#### Scenario: Cached suggestions are not reused across objectives

- **GIVEN** suggestions cached for one objective
- **WHEN** suggestions are requested for another
- **THEN** the cached set is not reused
