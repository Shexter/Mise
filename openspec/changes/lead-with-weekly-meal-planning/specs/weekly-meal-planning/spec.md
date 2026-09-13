## Purpose

Let people maintain a durable weekly meal schedule and reusable routines while keeping planning separate from food consumption and batch production.

## ADDED Requirements

### Requirement: Dated meal slots persist locally
The system SHALL support breakfast, lunch, and dinner slots on explicit local dates, partial weeks, and offline create, read, move, copy, replace, skip, and remove operations. Saved state SHALL survive restart without creating consumed meals or changing stock.

#### Scenario: Save and reopen a partial week
- **WHEN** a person schedules Monday breakfast and Wednesday dinner and restarts offline
- **THEN** those meals retain their dates, recipes, portions, and status with other slots empty
- **AND** eaten nutrition and pantry stock remain unchanged

#### Scenario: Move across date boundaries
- **WHEN** a meal moves into another week across a daylight-saving boundary or the device timezone changes
- **THEN** its explicitly selected local date is retained without an accidental one-day shift

#### Scenario: Occupied destination or stale edit
- **WHEN** a move targets an occupied slot or a save uses an outdated plan revision
- **THEN** the system preserves the committed schedule and asks the person to resolve the conflict
- **AND** it never silently overwrites the other meal

#### Scenario: Save fails
- **WHEN** local persistence fails during an edit
- **THEN** the last saved schedule remains usable, the editable draft is preserved, and retry is offered
- **AND** success is not displayed before persistence completes

### Requirement: Reusable weeks copy intentions only
The system SHALL allow saving a week as a template and applying it to another week with a review of occupied slots. Copies SHALL have independent portions and states, with no inherited logs, purchased flags, or pantry-coverage confirmations.

#### Scenario: Repeat a routine
- **WHEN** a person applies a template containing repeated lunches to next week
- **THEN** relative weekdays and explicit batch relationships are reproduced with new identities
- **AND** last week's consumed and shopping states are not copied

### Requirement: Batch production and consumption are distinct
The system SHALL support explicit allocation of portions from one cooking batch to multiple meal slots and SHALL count that batch once for ingredient demand. Allocation SHALL not exceed confirmed production and consumption dates SHALL not precede the cooking date.

#### Scenario: Four lunches share one batch
- **WHEN** a four-portion batch with a stated 600 g ingredient requirement is allocated to four one-portion lunches
- **THEN** grocery demand is 600 g and each lunch projects one portion's nutrition
- **AND** independent copies of the recipe are treated as separate batches unless explicitly linked

#### Scenario: Allocation exceeds production
- **WHEN** a portion edit requires five portions from a four-portion batch
- **THEN** the system requires increased production or reduced allocations before committing
- **AND** it previews resulting grocery changes

### Requirement: Planned meals enter ordinary meal review
The system SHALL require explicit meal review/save to log planned food, with actual eating date, consumed portion, and production servings visible. Scheduling, shopping, cooking-guide navigation, or skipping SHALL NOT log food or deplete pantry stock. Log links SHALL prevent duplicate saves and duplicate batch depletion.

#### Scenario: Confirm cooking then log leftovers
- **WHEN** a person reviews and saves the first home-cooked portion from a batch, then logs another portion later
- **THEN** ordinary batch depletion applies once and both eaten portions appear on their confirmed dates
- **AND** the later portion uses leftover behavior without another ingredient decrement

#### Scenario: Cancel or retry meal review
- **WHEN** a person cancels meal review or retries an already completed save
- **THEN** cancellation creates no meal and retry creates no duplicate meal or depletion

#### Scenario: Restaurant fallback
- **WHEN** the person logs an actual restaurant meal instead of the planned recipe
- **THEN** the restaurant meal never consumes pantry stock and the planned slot changes only by explicit skip, replacement, or linking

#### Scenario: Edit or delete linked data
- **WHEN** a linked meal is edited or deleted
- **THEN** actual nutrition and slot links reconcile with existing meal reversal behavior
- **AND** deleting the schedule itself never deletes historical meals or reverses consumption

### Requirement: Planner data has a complete local lifecycle
The system SHALL preserve existing user data on upgrade, include schedules/templates/snapshots and relevant links in export, and remove planner records and drafts through Delete all data.

#### Scenario: Existing installation upgrades
- **WHEN** an installation with meals, recipes, and completed onboarding receives the planner
- **THEN** all existing records and setup completion remain intact and no historical schedules are fabricated

#### Scenario: Export and reset
- **WHEN** the person exports and then deletes all data
- **THEN** the export contains their planner records without credentials and reset removes all local planner data
