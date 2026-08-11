## Purpose

Make Mise's repeated capture and logging interactions clear, recoverable, and
accessible without changing what the app can truthfully claim or store.

## ADDED Requirements

### Requirement: A completed action visibly confirms its own effect

The system SHALL confirm a user-initiated save with feedback that names the
changed record or the affected local state. It MUST make automatic pantry
effects visible without presenting an undefendable quantity.

#### Scenario: A photographed meal is saved
- **WHEN** a user saves a reviewed photographed meal
- **THEN** the app confirms the meal was saved and shows the refreshed Today
  view with its updated daily totals
- **AND** any pantry effect is described as an effect of that saved meal

#### Scenario: A meal has no pantry effect
- **WHEN** a user saves a meal that does not change pantry stock
- **THEN** the app confirms the meal without claiming that pantry stock moved

#### Scenario: A pantry review is accepted
- **WHEN** a user confirms one or more pantry items from review
- **THEN** the app confirms how many items were added and returns to a pantry
  view that includes them

### Requirement: Capture communicates its lifecycle

The system SHALL communicate the transition from capture through preparation,
analysis, review, and completion. It MUST keep the existing camera and library
routes available while an enhanced feedback treatment is used.

#### Scenario: A capture is being prepared or analysed
- **WHEN** a user submits a meal or pantry photo
- **THEN** the app shows that the submitted photo is being prepared or read
- **AND** prevents a duplicate submission

#### Scenario: Capture analysis reaches review
- **WHEN** an analysis produces a meal, pantry, barcode, or receipt result
- **THEN** the app transitions to the applicable review surface
- **AND** no inferred record is written before that review's existing
  confirmation action

#### Scenario: A capture cannot finish now
- **WHEN** a capture cannot be analysed because of a missing key, network
  failure, timeout, or provider failure
- **THEN** the app explains the current state and offers the applicable retry,
  manual-entry, settings, or saved-for-later path

### Requirement: Recovery states explain what remains possible

The system SHALL use a consistent recovery state for an empty, unavailable, or
recoverably failed capture or suggestion result. The state MUST name the
condition and provide an actionable next step when one exists.

#### Scenario: A suggestion request has no usable result
- **WHEN** a suggestion surface has no key, an error, insufficient data, or no
  eligible suggestion
- **THEN** the app explains that specific condition
- **AND** offers only an action that can address it

#### Scenario: A capture result is unusable
- **WHEN** a capture contains no usable food or receipt, or cannot be
  classified
- **THEN** the app preserves no unsupported inferred data
- **AND** offers a retry, manual path, or explicit route choice

### Requirement: Feedback is accessible and respects reduced motion

The system SHALL expose status feedback to assistive technology. It MUST reduce
nonessential motion when the operating system requests reduced motion.

#### Scenario: A status message appears
- **WHEN** the app announces a save, failure, pending state, or actionable
  recovery state
- **THEN** a screen reader can discover the message and its available action

#### Scenario: Reduced motion is enabled
- **WHEN** the operating system has reduced motion enabled
- **THEN** the same state transition remains understandable without a large
  movement or delayed action

### Requirement: Contextual polish remains local and correctable

The system SHALL use only existing on-device context to improve a default,
explanation, or recovery action. It MUST preserve a correction or review point
before an inferred result changes a durable meal or pantry record.

#### Scenario: Existing context improves a default
- **WHEN** the app uses known local context such as time, pantry stock, a saved
  preference, or an explicit venue selection
- **THEN** it improves a relevant default or explanation without requesting new
  sensitive data

#### Scenario: Context is uncertain
- **WHEN** the app cannot establish a contextual fact with confidence
- **THEN** it does not present that fact as known or use it to bypass user
  review

### Requirement: UI-facing changes receive a premium acceptance pass

The system SHALL record a premium acceptance pass for every UI-facing OpenSpec
change before it is accepted. The pass MUST cover feedback, error and
cancellation, return visits, reduced motion, screen readers, and real-device
review where applicable.

#### Scenario: A UI-facing change is ready for acceptance
- **WHEN** implementation tasks for a UI-facing OpenSpec change are complete
- **THEN** its task file or owner app-test checklist records the premium
  acceptance checks and their results
