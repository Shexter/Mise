## MODIFIED Requirements

### Requirement: The list combines actionable sources
The system SHALL maintain one unified open shopping list whose entries may be sourced from out or running-low pantry items, explicitly missing recipe ingredients, explicitly missing dinner-suggestion ingredients, confirmed scheduled cooking demand, or manual additions.

#### Scenario: A low pantry item appears once
- **WHEN** a canonical pantry item becomes `out` or `running_low`
- **THEN** one open shopping entry exists for that canonical item
- **AND** its source explains the pantry status

#### Scenario: Multiple sources are deduplicated
- **WHEN** the same canonical ingredient is missing from two recipes and is also running low
- **THEN** the list shows one entry
- **AND** all active sources remain visible

#### Scenario: Plan contributes to an existing entry
- **WHEN** confirmed scheduled demand shares an ingredient with a manual or pantry source
- **THEN** its batch/date provenance joins the same ingredient entry without losing the other sources
- **AND** independent quantities are retained as explained contributions rather than silently replaced

### Requirement: Pantry navigation stays uncrowded
The system SHALL expose Shop as a top-level dedicated tab in bottom navigation, providing direct access to items to buy, nearby shop detection, and receipt history without requiring multi-level nested controls inside Pantry.

#### Scenario: Shop subsection
- **WHEN** the user navigates to the shopping list
- **THEN** open items to buy, history toggle, receipt shortcuts, and pending plan grocery review are immediately accessible
- **AND** header actions remain focused and intuitive

#### Scenario: Today remains focused
- **WHEN** the user opens Today
- **THEN** the scheduled meal agenda leads with access to actual nutrition, meals and the secondary dinner action
- **AND** grocery review opens Shop rather than adding a redundant shopping checklist to Today

### Requirement: Confirmed receipts reconcile exact matches

The system SHALL reconcile confirmed receipt lines against open shopping entries using exact canonical or barcode identity. Entries without scheduled demand SHALL retain existing completion behavior. Entries with scheduled demand SHALL retain purchase provenance while leaving partial or unknown remaining coverage reviewable.

#### Scenario: Exact receipt match
- **WHEN** a confirmed receipt line resolves to the same canonical identity as an open shopping entry
- **THEN** the matched purchase is recorded with receipt and line provenance
- **AND** the entry is marked purchased when it has no scheduled demand or the purchase defensibly covers that demand
- **AND** partial or unknown scheduled coverage remains reviewable instead of being treated as fully supplied

#### Scenario: Fuzzy receipt match
- **WHEN** a receipt line is unresolved or only fuzzily resembles an entry
- **THEN** it is not auto-completed
- **AND** the user may handle it manually

## ADDED Requirements

### Requirement: Grocery demand reflects cooking batches and reviewed coverage
The system SHALL compute grocery demand for the selected scheduled cooking range from accepted recipe quantities, counting each batch once. It SHALL combine only compatible units and retain unresolved or unknown amounts. Pantry presence SHALL be marked for checking, not treated as proof of sufficient weekly quantity. Confirmed coverage SHALL be allocated once across the selected demand.

#### Scenario: Compatible quantities across batches
- **WHEN** two independent batches require 200 g and 0.3 kg of the same canonical ingredient
- **THEN** the preview shows a total requirement of 500 g with both batch sources

#### Scenario: Incompatible or unknown quantities
- **WHEN** one batch requires two pieces and another requires 300 g without a defensible conversion, or a source has an unknown quantity
- **THEN** separate quantity contributions and the unknown need remain visible under the ingredient
- **AND** the app does not invent a combined exact total

#### Scenario: Pantry stock is uncertain
- **WHEN** a matching ingredient is present or running low in Pantry
- **THEN** the recipe requirement is shown with Check pantry until the person confirms coverage
- **AND** a coverage amount is not subtracted repeatedly for each meal using that ingredient

#### Scenario: Grocery haul without pantry checks
- **WHEN** a person schedules meals and skips pantry setup or all Check pantry actions
- **THEN** the system lets them apply the full recipe-derived grocery list for their selected cooking range
- **AND** no pantry entry, stock confirmation or ingredient-by-ingredient coverage review is required
- **AND** optional confirmation of already-owned ingredients can reduce the list later

### Requirement: Plan grocery changes are reviewed and reversible
The system SHALL generate a grocery preview on schedule save and apply it through explicit confirmation into Shop. Later plan changes SHALL stage a revision diff, preserve manual edits and closed history, and reconcile only affected plan sources. Identical application SHALL be idempotent; failed application SHALL preserve the previous list. Undo SHALL restore prior plan contributions without reversing receipts or stock.

#### Scenario: Schedule changes after list creation
- **WHEN** a person removes a meal or changes a batch quantity after using its grocery list
- **THEN** Shop identifies pending plan changes and previews source/quantity differences
- **AND** saved manual items, purchases, and other plan sources remain intact until the relevant reviewed changes apply

#### Scenario: Coverage or purchase is stale
- **WHEN** demand increases after Have enough, purchase, snooze or dismissal
- **THEN** the additional demand requires review and old coverage is not treated as sufficient
- **AND** closed history is not silently reopened or erased

#### Scenario: Repeated or failed apply
- **WHEN** the same revision is applied twice or an apply fails mid-operation
- **THEN** repeated success produces no duplicate quantities or sources and failure preserves the prior complete list

#### Scenario: Undo an applied revision
- **WHEN** the person undoes a plan grocery revision
- **THEN** its prior plan contributions return without removing independent manual sources or reversing confirmed receipt/pantry effects

#### Scenario: Previously added recipe becomes scheduled
- **WHEN** the same identified recipe occurrence already contributes an explicitly added shopping source
- **THEN** the system offers to transfer that source to the scheduled occurrence rather than silently counting it twice
- **AND** unrelated occurrences retain their independent demand

### Requirement: Receipts do not prove full weekly coverage by identity alone
The system SHALL retain exact-identity receipt matching and completion history while distinguishing purchased amounts from outstanding scheduled demand. Unknown or partial purchase quantities SHALL require coverage review instead of claiming the whole plan is supplied.

#### Scenario: Receipt covers part of a plan requirement
- **WHEN** a confirmed exact-match receipt supplies 200 g toward a stated 500 g plan requirement with compatible units
- **THEN** purchase provenance is retained and the remaining 300 g remains reviewable as outstanding demand

#### Scenario: Receipt quantity cannot be compared
- **WHEN** an exact-identity purchase has no defensible conversion to the plan requirement
- **THEN** the purchase is recorded but complete plan coverage is not inferred
- **AND** the person can confirm coverage manually
