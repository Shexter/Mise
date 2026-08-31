## Purpose

Lets a user describe many fridge, freezer, pantry, or counter items in one
explicit voice session and turn that description into a fast, uncertainty-aware
pantry draft without silently recording, uploading, or mutating stock.

## ADDED Requirements

### Requirement: Voice intake is explicit, bounded, and optional

The system SHALL provide a labelled voice pantry action with explicit Start,
Pause or Resume, Finish, and Cancel controls. It MUST NOT listen before Start,
after Finish or Cancel, in the background, or automatically after an
interruption.

The system SHALL provide a Type instead or manual-entry path that does not
require microphone permission, speech, or hearing.

#### Scenario: Nothing listens before the user starts

- **WHEN** the voice pantry surface opens
- **THEN** the microphone is inactive
- **AND** the user is told that Mise will create a draft for review

#### Scenario: Cancel ends the session

- **WHEN** the user selects Cancel while listening
- **THEN** microphone capture stops immediately
- **AND** no pantry item is created
- **AND** the active raw audio is deleted

#### Scenario: Voice is declined

- **WHEN** the user denies microphone permission or chooses Type instead
- **THEN** manual pantry entry remains usable

### Requirement: The active recording state is perceivable

While recording, the system SHALL communicate listening state, elapsed time,
current recognition language, live transcript, and available controls using text
as well as any visual or haptic treatment. A waveform MUST NOT be the only state
indicator.

State transitions SHALL be announced to assistive technology without
continuously announcing each live transcript update.

#### Scenario: Listening starts

- **WHEN** microphone capture begins
- **THEN** the interface visibly says Listening
- **AND** assistive technology announces that listening started

#### Scenario: A screen reader receives a useful finish summary

- **WHEN** transcription and parsing finish
- **THEN** assistive technology announces how many items were found
- **AND** how many need review

### Requirement: A session location provides editable context

The system SHALL let the user choose or inherit a storage location for the
session. Each proposal SHALL inherit that location unless the transcript states
another location, and the user SHALL be able to change it during review.

#### Scenario: A fridge sweep needs no repeated location entry

- **GIVEN** the session location is Fridge
- **WHEN** the user names eight foods without repeating Fridge
- **THEN** all eight proposals use Fridge as their proposed location

#### Scenario: Speech changes location for later items

- **GIVEN** the session location is Fridge
- **WHEN** the user says “in the freezer I also have two salmon fillets”
- **THEN** the salmon proposals use a freezer location
- **AND** earlier proposals remain in Fridge

### Requirement: Speech produces an editable transcript before stock

The system SHALL produce and display an editable transcript for the active
session before any pantry mutation. Filler and pauses SHALL NOT create pantry
items, and explicit self-corrections SHALL supersede the corrected value while
remaining visible in the source evidence.

#### Scenario: Hesitant speech remains usable

- **WHEN** the user says “uh, eggs, six—actually seven left”
- **THEN** the proposal is Eggs with seven pieces remaining
- **AND** the transcript remains available for review

#### Scenario: No food is found

- **WHEN** the transcript contains no usable food reference
- **THEN** no item is invented
- **AND** the user can continue speaking, edit the transcript, type, or cancel

### Requirement: Proposals preserve distinct evidence and uncertainty

Each proposal SHALL preserve the original transcript span and independently
represent ingredient identity, physical-container count, per-container amount
and unit, storage location, approximate fullness, opened state, and acquisition
age where those facts were supplied.

Missing evidence SHALL remain unknown. Approximate speech MUST NOT be converted
to exact precision. The system MUST NOT infer a package size, weight, purchase
date, opened state, or expiry that the user did not provide.

#### Scenario: Unknown quantity stays unknown

- **WHEN** the user says “some butter”
- **THEN** Butter is proposed with quantity unknown
- **AND** no default stick, gram amount, or fullness is invented

#### Scenario: An approximate container remains approximate

- **WHEN** the user says “half a carton of milk”
- **THEN** Milk is proposed as about half of one carton
- **AND** the original carton volume is unknown

#### Scenario: First inventory does not mean purchased today

- **WHEN** an existing item is first described without an acquisition date
- **THEN** its acquisition date remains unknown
- **AND** the system does not present an expiry calculated as though it were
  purchased on the capture date

### Requirement: Container count and item amount are not conflated

The system SHALL distinguish the number of physical containers from the amount
inside each container and SHALL materialize accepted proposals according to the
existing one-physical-container pantry rule.

#### Scenario: Two cans have a per-can amount

- **WHEN** the user says “two 400 gram cans of tomatoes”
- **THEN** the draft represents two physical cans
- **AND** each can carries a user-stated amount of 400 grams

#### Scenario: One package can contain several pieces

- **WHEN** the user says “a pack of six chicken breasts”
- **THEN** the draft represents one physical package
- **AND** six pieces within that package

### Requirement: Canonical resolution reuses the identity layer

Every voice food reference SHALL pass through the existing canonical resolution
cascade with source provenance `voice`. Original-script names SHALL be preserved.
Uncertain or unresolved identities SHALL be shown for confirmation or correction
and MUST NOT silently create a canonical item.

#### Scenario: A known alias resolves locally

- **WHEN** a spoken ingredient matches a local alias confidently
- **THEN** it resolves without a provider request

#### Scenario: A code-switched ingredient remains in script

- **WHEN** the user names an ingredient in another language or script
- **THEN** its original text is retained for matching and review
- **AND** the system does not require romanization

#### Scenario: An ambiguous identity asks rather than guesses

- **WHEN** speech or canonical matching could mean more than one ingredient
- **THEN** the proposal explains the ambiguity in plain language
- **AND** it remains unconfirmed until the user chooses, edits, or skips it

### Requirement: Review is batch-efficient and precedes every mutation

The system SHALL present all proposals in a compact review before creating stock.
Clear and needs-review items SHALL be distinguishable; every item SHALL be
independently editable, selectable, or skippable; and the final action SHALL
state the number of items and destination being changed.

Unknown quantity alone SHALL NOT prevent a present item from being accepted.

#### Scenario: Clear items can be accepted together

- **GIVEN** eight clear proposals and two ambiguous proposals
- **WHEN** review opens
- **THEN** the eight clear proposals can be accepted as one batch
- **AND** the two ambiguous proposals are separately identified for review

#### Scenario: Partial acceptance is explicit

- **WHEN** the user skips an unresolved watermelon proposal and accepts the rest
- **THEN** only the selected proposals are included in the final confirmation
- **AND** the skipped phrase remains visible in the result summary

#### Scenario: Abandoning review creates no stock

- **WHEN** the user leaves or discards review without confirming
- **THEN** no pantry item, expiry, shopping change, or recipe signal is created

### Requirement: Batch application is atomic, idempotent, and reversible

The system SHALL apply all accepted proposals in one transaction, SHALL prevent
the same confirmed draft from being applied twice, and SHALL offer a bounded Undo
that removes only pantry rows created by that batch.

Downstream pantry-dependent suggestions SHALL be invalidated once after commit or
Undo and MUST NOT read unconfirmed drafts.

#### Scenario: One invalid item prevents partial stock

- **GIVEN** a reviewed batch with an item that cannot be materialized
- **WHEN** confirmation is attempted
- **THEN** no item in the batch is written
- **AND** review identifies the item that must be resolved

#### Scenario: A repeated confirmation does not duplicate stock

- **WHEN** confirmation is retried with the same completed draft id
- **THEN** no duplicate pantry rows are created

#### Scenario: Undo removes exactly the voice batch

- **WHEN** the user invokes Undo after a successful voice batch
- **THEN** only the pantry rows created by that batch are removed
- **AND** pre-existing stock is unchanged

### Requirement: Local-first processing and cloud use are explicit

The system SHALL prefer on-device speech recognition where supported. Before any
audio or transcript is sent to a provider, the system SHALL name the provider,
state what data leaves the device, state why it is needed, and require explicit
consent for that session.

Consent or credentials for image analysis MUST NOT be treated as consent or
capability for speech transcription. A provider-assisted canonical resolution
request SHALL send only the minimum relevant text and SHALL be disclosed
separately from transcription.

#### Scenario: Local-only mode makes no provider call

- **GIVEN** on-device transcription and local alias resolution succeed
- **WHEN** the voice batch is reviewed
- **THEN** no audio, transcript, or pantry data is sent to a provider

#### Scenario: Cloud transcription asks first

- **GIVEN** local transcription is unavailable
- **WHEN** cloud transcription is offered
- **THEN** the provider and payload are explained before recording or upload
- **AND** declining returns to typing or manual entry

#### Scenario: A vision key is not speech consent

- **GIVEN** the user configured a provider for food photographs
- **WHEN** voice intake needs remote transcription
- **THEN** the system still requires explicit voice-session consent

### Requirement: Audio and drafts have bounded retention

Raw audio SHALL be deleted after successful transcription, cancellation, or a
terminal failure and MUST NOT enter the image pending-capture queue, logs, data
export, or analytics.

By default, transcript and proposal drafts SHALL be deleted after confirmation
or discard. If interruption recovery is enabled, the system SHALL retain only
the local transcript and proposals for a disclosed bounded period and SHALL let
the user delete that draft.

#### Scenario: Successful transcription removes audio

- **WHEN** audio has been transcribed successfully
- **THEN** its temporary file is deleted

#### Scenario: An interrupted draft can be understood

- **WHEN** an interruption leaves a recoverable transcript draft
- **THEN** the user is told what was retained and for how long
- **AND** can resume review or delete it

### Requirement: Interruptions and failures preserve user control

Calls, audio-route changes, app backgrounding, permission changes, and microphone
contention SHALL pause or stop capture and MUST NOT resume it automatically.
Permission denial, microphone unavailability, no speech, heavy noise, offline
speech service, provider failure, and food-resolution failure SHALL have distinct
recovery guidance while preserving any safe partial transcript.

#### Scenario: A call interrupts a fridge sweep

- **WHEN** an incoming call interrupts active capture
- **THEN** recording stops or pauses immediately
- **AND** it does not resume when the call ends
- **AND** the user can review the safe partial transcript or discard it

#### Scenario: Processing fails after speech was captured

- **WHEN** transcription or parsing fails
- **THEN** no pantry mutation occurs
- **AND** the user can retry where privacy and retained evidence permit, edit or
  type the content, or cancel

### Requirement: Voice-created stock enters existing downstream contracts

After explicit confirmation, voice-created pantry items SHALL use the existing
editing, status, expiry, deletion, export, and Delete all data contracts. They
MAY invalidate and improve existing pantry-based dinner suggestions, but
unconfirmed voice drafts MUST NOT influence recipes, shopping, analytics, or
depletion.

#### Scenario: Confirmed stock can improve dinner suggestions

- **WHEN** a voice batch is confirmed successfully
- **THEN** the pantry refreshes
- **AND** the existing suggestion engine may regenerate from the confirmed stock

#### Scenario: A draft is not recipe evidence

- **WHEN** voice proposals are still under review
- **THEN** no recommendation treats those proposals as owned ingredients

