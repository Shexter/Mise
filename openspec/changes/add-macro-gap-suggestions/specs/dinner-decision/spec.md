## ADDED Requirements

### Requirement: The shipped suggestion engine accepts a macro-gap request

The shipped suggestion engine SHALL accept a macro-gap request, including the
targeted macro, while preserving its existing tonight and stretch requests. The
same payload discipline, model call, dietary constraints, canonical-id
validation, and cooking path SHALL apply.

Adding an objective MUST NOT require a second engine, a second prompt module, or
a second cache.

#### Scenario: Different request modes share one engine

- **WHEN** suggestions are requested for a different request mode
- **THEN** the same engine produces them

#### Scenario: The request changes what is optimised

- **GIVEN** the same kitchen
- **WHEN** suggestions are requested for two different request modes
- **THEN** the results differ according to the request

#### Scenario: Cached suggestions are not reused across request identities

- **GIVEN** suggestions cached for tonight, stretch, or a different targeted macro
- **WHEN** suggestions are requested for a macro-gap target
- **THEN** the cached set is not reused
