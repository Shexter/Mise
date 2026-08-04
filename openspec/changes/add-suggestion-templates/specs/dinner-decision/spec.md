## ADDED Requirements

### Requirement: The engine's objective is one of a named set

The objective the suggestion engine accepts SHALL be one of the named templates,
rather than an open parameter constructed by each caller.

Adding a template MUST NOT require a second engine, a second prompt module, or a
second cache.

#### Scenario: Callers name a template rather than describing an objective

- **WHEN** suggestions are requested
- **THEN** the request names one of the templates

#### Scenario: A new template needs no new engine

- **WHEN** a template is added to the set
- **THEN** the engine, prompt module, and cache are unchanged in structure

### Requirement: Scoring weights come from the active template

The ranking weights the engine applies SHALL be read from the active template
rather than fixed in the scorer.

The facts being weighted — urgency, value at risk, familiarity, effort, macro
fit — SHALL be the same under every template.

#### Scenario: Weights vary, facts do not

- **GIVEN** two templates
- **WHEN** the same kitchen is scored under each
- **THEN** the same facts are used
- **AND** they are weighted differently

#### Scenario: No template introduces a private fact

- **WHEN** a template is applied
- **THEN** it uses no ranking input unavailable to the others

### Requirement: Planning to a date is a template

The mode that produces enough dinners to last until a date SHALL be one of the
templates rather than a separate surface with its own control.

#### Scenario: Stretching to a date is selected like any other objective

- **WHEN** the user wants dinners lasting until a date
- **THEN** they select it as a template

#### Scenario: It behaves as the mode already specifies

- **WHEN** that template is active
- **THEN** it produces a set of dinners requiring no shopping
- **AND** states the gap honestly where one exists
