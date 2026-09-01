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

The system SHALL distinguish the phone's normal speech service from guaranteed
offline recognition. Before first use of the phone speech service, the system
SHALL disclose that the phone's speech provider may process audio off-device and
SHALL offer an equally reachable Offline-only choice. It MUST NOT name Samsung,
Google, Apple, or another vendor as the active recognizer unless runtime evidence
identifies that vendor.

Before a transcript is sent to the configured AI provider, the system SHALL name
the provider, state that only transcript text and the minimum parsing context
leave the device, and require explicit consent. Transcript-parsing consent MAY be
remembered, MUST be visible and revocable in Settings, and MUST NOT be inferred
solely from a credential or consent for photographs. Turning it off SHALL restore
local-only parsing immediately.

#### Scenario: Phone speech service is disclosed honestly

- **GIVEN** the user has not accepted the phone speech disclosure
- **WHEN** voice intake first offers the normal phone speech service
- **THEN** the system states that the phone provider may process audio off-device
- **AND** offers Offline only without claiming a specific vendor

#### Scenario: Offline-only mode makes no provider call

- **GIVEN** Offline only and local transcript parsing are enabled
- **WHEN** the voice batch is reviewed
- **THEN** no audio, transcript, or pantry data is sent to a provider

#### Scenario: Transcript parsing asks once and remains revocable

- **GIVEN** a configured API key and no remembered transcript consent
- **WHEN** AI transcript parsing is offered
- **THEN** the selected provider and transcript-only payload are explained
- **AND** declining uses the local parser without losing the transcript
- **AND** accepting may be remembered until revoked in Settings

#### Scenario: A vision key is not speech consent

- **GIVEN** the user configured a provider for food photographs
- **WHEN** voice intake has a transcript to parse
- **THEN** the system still requires transcript-parsing consent

### Requirement: Transcript parsing is evidence-bound and provider-optional

Speech recognition, keyboard dictation, and typed input SHALL converge on one
editable transcript. With consent and a configured key, the system SHALL perform
at most one logical structured parsing operation for a transcript revision using
the user's selected provider and model. It SHALL send no audio, pantry contents,
food catalogue, credentials, or raw household data.

Every provider-derived item and field SHALL cite source text present in the
transcript. The system MUST reject unsupported ingredients, numbers, quantities,
locations, opened states, or dates. Provider output MUST NOT create canonical
foods or aliases, merge or alter existing stock, or bypass the existing review
and atomic confirmation boundary.

No key, revoked consent, offline state, timeout, provider/model unavailability,
authentication failure, or malformed output SHALL preserve the transcript and
fall back to deterministic local parsing. One provider-directed rate-limit retry
MAY occur within the same logical operation; other errors and malformed output
MUST NOT trigger a repair request. Valid evidence-backed provider candidates MAY
be combined with local parsing of rejected or unused spans.

#### Scenario: One consented request structures a transcript

- **GIVEN** transcript parsing consent and a configured provider/model
- **WHEN** the user finishes or explicitly reparses an edited transcript
- **THEN** one logical transcript-only parsing operation is started
- **AND** resulting candidates are locally validated before review

#### Scenario: Spoken instructions cannot grant authority

- **GIVEN** the transcript contains instructions to ignore rules or modify stock
- **WHEN** the provider response is validated
- **THEN** the transcript is treated only as untrusted source data
- **AND** no unsupported candidate or Pantry mutation is accepted

#### Scenario: Provider failure falls back without losing work

- **WHEN** the configured provider times out, rejects the request, or returns
  malformed output
- **THEN** the editable transcript remains intact
- **AND** the deterministic local parser handles the remaining transcript
- **AND** the UI states that parsing occurred locally

#### Scenario: Late parsing results cannot replace newer work

- **GIVEN** a parse operation is active
- **WHEN** the transcript, provider, or model changes, or the user cancels or
  leaves the flow
- **THEN** the active operation is aborted or its result is discarded
- **AND** it cannot overwrite a newer draft

### Requirement: Offline speech models have durable truthful state

The system SHALL offer Android's official offline-language installation before a
third-party local model when the selected locale lacks platform offline support.
Parakeet and SenseVoice downloads SHALL be explicit user choices, resumable, and
recoverable across backgrounding, screen lock, process restart, interrupted
download, and interrupted extraction. Changing language or model MUST NOT start
a download or switch models automatically.

A local model MUST NOT be shown as Ready until its checksum and required files,
local manifest and ready marker, resolved path, native model detection, and
bounded STT engine initialization have all succeeded. Installed-state checks
MUST use local evidence and MUST NOT require a provider or remote registry call.
Existing completed, partial, and corrupt installations SHALL be reconciled into
Ready, Resume, Repair, or Delete states without silently redownloading bytes.

#### Scenario: Completed progress is not yet Ready

- **WHEN** a model download reaches 100 percent
- **THEN** the system continues through extraction and runtime validation
- **AND** shows Ready only after every local readiness check succeeds

#### Scenario: A previous download survives reopening

- **GIVEN** a valid model manifest and ready marker exist locally
- **WHEN** Mise starts without network access
- **THEN** the model is discovered without a registry request
- **AND** the persisted compatible model choice can be used

#### Scenario: An incompatible model has a repair path

- **WHEN** downloaded files are corrupt or the STT engine cannot initialize
- **THEN** the system does not label the model Ready
- **AND** explains whether the user can Resume, Repair, Delete, choose another
  model, or use the phone speech service

### Requirement: Audio and drafts have bounded retention

Raw audio SHALL be deleted after successful transcription, cancellation, or a
terminal failure and MUST NOT enter the image pending-capture queue, logs, data
export, or analytics.

By default, transcript and proposal drafts SHALL be deleted after confirmation
or discard. If interruption recovery is enabled, the system SHALL retain only
the local transcript and proposals for a disclosed bounded period and SHALL let
the user delete that draft. Raw provider responses MUST NOT be retained after
validated proposals are produced. Delete all data SHALL additionally remove
downloaded speech models, partial archives, extraction state, model and consent
preferences, recoverable voice drafts, redacted diagnostics, and pending parsing
state.

#### Scenario: Successful transcription removes audio

- **WHEN** audio has been transcribed successfully
- **THEN** its temporary file is deleted

#### Scenario: An interrupted draft can be understood

- **WHEN** an interruption leaves a recoverable transcript draft
- **THEN** the user is told what was retained and for how long
- **AND** can resume review or delete it

#### Scenario: Delete all data clears the voice feature

- **WHEN** the user invokes Delete all data
- **THEN** no downloaded or partial speech model, voice preference, recoverable
  transcript draft, provider response, diagnostic event, or pending parse remains

### Requirement: Interruptions and failures preserve user control

Calls, audio-route changes, app backgrounding, permission changes, and microphone
contention SHALL pause or stop capture and MUST NOT resume it automatically.
Permission denial, microphone unavailability, no speech, heavy noise, offline
speech service, provider failure, and food-resolution failure SHALL have distinct
recovery guidance while preserving any safe partial transcript. The system MUST
NOT switch recognition engines during an active session. Duplicate Finish actions
MUST NOT start concurrent transcription or parsing work.

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

#### Scenario: Engine failure preserves the boundary

- **WHEN** the active recognition engine fails after producing partial text
- **THEN** the safe partial transcript remains editable
- **AND** the system offers explicit retry, offline model, keyboard, or typing
  choices without switching microphones automatically

### Requirement: Speech failures are locally diagnosable without exposing content

The system SHALL expose a bounded local speech diagnostic report containing the
recognition mode, discoverable service state, native error code, local model
identity/readiness, parser path, selected provider/model name, app version, and
source revision. It MUST NOT contain transcript text, audio, API keys, pantry
data, or raw provider responses. Sharing the redacted report SHALL require an
explicit user action and no diagnostic telemetry SHALL upload automatically.

#### Scenario: A user copies a safe diagnostic report

- **WHEN** the user opens Speech diagnostics and chooses Copy report
- **THEN** the report identifies the failed boundary and source revision
- **AND** contains no credential, transcript, audio, pantry, or provider-response
  content

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
