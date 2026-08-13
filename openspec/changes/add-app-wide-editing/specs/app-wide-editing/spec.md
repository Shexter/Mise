## Purpose

Gives users a predictable way to correct any persisted fact they supplied, while keeping derived nutrition, pantry, shopping, and analytics state consistent with the corrected source.

## ADDED Requirements

### Requirement: Every user-created record has an edit path

Any persisted record created or materially configured by the user SHALL expose an edit affordance from its detail, row, or review surface. The affordance SHALL be available for pantry entries, logged meals and meal items, saved recipes and ingredients, shopping-list items, barcode/receipt capture results, and user-supplied profile/preferences. Derived-only records MAY omit editing when no user-owned source exists.

#### Scenario: Pantry item can be edited after adding
- **WHEN** a user opens a pantry item they previously added
- **THEN** the item presents an Edit action that opens a form populated with its current values

#### Scenario: User-created meal can be edited
- **WHEN** a user opens a logged meal or its detail row
- **THEN** the user can edit the fields they supplied, including meal identity, portions, venue, date, and item corrections where applicable

#### Scenario: Derived analytics are not falsely editable
- **WHEN** a user views a chart total or a calculated expiry/status label
- **THEN** the UI identifies it as derived and routes the user to its owning source record instead of offering a misleading direct edit

### Requirement: Edit forms preserve correction safety

An edit form SHALL load the persisted value, validate required fields and ranges, support Cancel without mutation, and require an explicit Save to commit. Invalid input SHALL remain visible with an actionable message and SHALL NOT partially update the record.

#### Scenario: Cancel leaves the record unchanged
- **WHEN** a user changes a field and taps Cancel
- **THEN** the form closes and the original persisted value remains unchanged

#### Scenario: Invalid edit is rejected
- **WHEN** a user submits a missing required identity or an out-of-range quantity
- **THEN** the form stays open, identifies the invalid field, and performs no database or derived-state update

#### Scenario: Save confirms the edit
- **WHEN** a user submits a valid edit
- **THEN** the app persists the complete edited record atomically and returns to the detail/list surface showing the new value

### Requirement: Edits update dependent state through domain rules

Saving an edit SHALL recompute or invalidate all dependent state owned by the edited fields. Nutrition totals, pantry depletion, expiry/status, dinner suggestions, shopping-list matching, recipe gaps, and analytics SHALL never continue to display values calculated from the superseded source. The app SHALL preserve canonical identity, provenance, confidence, and audit fields unless the user explicitly edits the field that owns that value.

#### Scenario: Pantry quantity edit updates downstream views
- **WHEN** a user edits a pantry quantity or stock status and saves
- **THEN** Pantry, dinner suggestions, shopping-list status, and analytics use the new value without creating a duplicate pantry item

#### Scenario: Meal correction updates totals and depletion
- **WHEN** a user edits a meal item, servings, date, or home/away venue
- **THEN** the meal totals and any applicable pantry depletion are recalculated using the existing reversible meal rules

#### Scenario: Identity correction preserves provenance
- **WHEN** a user changes the canonical identity selected for a captured or pantry item
- **THEN** the correction is stored as an explicit user choice, the original capture/source remains inspectable, and future matching uses the corrected identity

### Requirement: Edit behavior is consistent across entry points

All edit surfaces SHALL use the same labels, Save/Cancel semantics, validation conventions, loading/error feedback, and theme tokens. A newly added user-owned record SHALL not be considered complete unless its add flow, detail/list surface, edit form, persistence path, and dependent recalculation are covered by the same contract.

#### Scenario: Edit works from every supported row or detail surface
- **WHEN** the same record is reached from Pantry, Today, Recipes, Capture review, or Shopping List
- **THEN** each surface offers the same edit action and opens the same current-value form or an equivalent field-complete form

#### Scenario: Save failure does not lose edits
- **WHEN** persistence fails during Save
- **THEN** the user sees an error, the form remains recoverable with their entered values, and no success state or stale dependent refresh is shown

### Requirement: Editing remains local-first and exportable

Edits SHALL be persisted on-device using the existing database and state pathways. Export SHALL contain the corrected user-owned values and required provenance; the API key SHALL never be included. Reset and migration tests SHALL cover any newly edited persisted fields.

#### Scenario: Corrected data survives restart
- **WHEN** a user saves an edit, closes/reopens Mise, and revisits the record
- **THEN** the corrected value is still present and dependent views agree with it

#### Scenario: Export reflects the correction
- **WHEN** a user exports their data after editing a record
- **THEN** the export contains the corrected record and its source/provenance fields without secrets
