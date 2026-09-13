## Purpose

Supply cuisine filter illustrations and authored planner dish artwork through the existing reproducible, reviewed, bundled illustration workflow.

## ADDED Requirements

### Requirement: Cuisine candidates preserve the approved illustration recipe

Cuisine candidates SHALL use the locked Draw Things model, sampler, render dimensions, and existing hand-painted food style. Generation SHALL preserve the approved paper background and grounding shadow and record the actual prompt, seed, recipe version, and output checksum.

#### Scenario: Generate a cuisine candidate

- **WHEN** the approved recipe passes its gold-master reproduction check and a cuisine candidate is generated
- **THEN** a 1024-square raw PNG, 512-square review WebP, and provenance sidecar are staged
- **AND** existing shipped artwork and runtime manifests remain unchanged

### Requirement: Candidate generation and shipping remain distinct

An unwired cuisine set SHALL remain blocked from normal batch generation. An explicit staging pilot SHALL not imply promotion approval. Shipping SHALL require a working consumer, valid schema and registry support, named human review, and native visual acceptance.

#### Scenario: Staged asset is not yet accepted

- **WHEN** a cuisine candidate exists in staging but has not passed promotion requirements
- **THEN** the production app does not reference its staging path
- **AND** it is not recorded as shipped or human-approved

### Requirement: Authored recipe artwork uses stable identity

Planner dish artwork SHALL resolve only from a stable ID in the bounded authored template or planner catalogue sets. User photos SHALL retain precedence. Saved or provider recipes SHALL not borrow artwork by title similarity. Missing or failed artwork SHALL preserve an appropriate fallback.

#### Scenario: Catalogue recipe is renamed

- **WHEN** an authored recipe title changes while its stable ID remains the same
- **THEN** its approved artwork continues to resolve
- **AND** an unrelated saved recipe with the same title does not inherit that artwork

#### Scenario: A photo or bundled image fails

- **WHEN** a planner recipe's preferred image cannot load
- **THEN** another eligible visual tier or its procedural fallback renders
- **AND** the recipe label and scheduling action remain usable

### Requirement: Shipped illustrations have complete parity

Every shipped cuisine and planner dish illustration SHALL have matching bundled bytes, manifest provenance, and static registry references. Review SHALL include the intended small control size and supported light/dark themes. Functional glyphs SHALL not be embedded in generated artwork.

#### Scenario: Review a promoted pack

- **WHEN** a pack is prepared for release
- **THEN** the inventory and verification checks agree on all shipped IDs and checksums
- **AND** native captures show labelled cuisine controls and actual authored dish artwork across the planner surfaces
- **AND** unavailable native coverage remains explicitly unverified
