## Context

The existing pantry flow already has the important downstream pieces: canonical
resolution, location defaults, expiry calculation, match confirmation, pantry
review, and local SQLite persistence. Its image-oriented proposal/store types,
however, assume a photo URI and do not represent the ambiguity found in speech.

Voice also introduces two distinct interpretation stages:

1. audio to transcript;
2. transcript to structured pantry candidates.

Each may be local or provider-assisted, and each has different evidence and
privacy properties. A certain transcription can still name an ambiguous food;
a correct food identity can still have an unclear quantity. The design therefore
keeps transcription confidence, identity confidence, quantity confidence, and
location confidence separate.

## Goals / Non-Goals

**Goals:** make a first fridge or pantry inventory materially faster; accept
natural, hesitant, code-switched speech; preserve uncertainty; reuse canonical
matching and pantry rules; require one review before mutation; keep audio
ephemeral; support an equally capable non-voice path; and make success reversible.

**Non-Goals:** an open-ended assistant, voice commands against existing stock,
recipe generation, background capture, automatic mutation, or a voice-specific
identity/persistence system.

## Decisions

### Voice is a bounded inventory sweep, not an assistant

The session has explicit Start listening, Pause/Resume, Finish, and Cancel
states. After Finish, the product moves to structured review. It may ask a small
number of item-specific clarification questions, but it does not continue an
unbounded chat or execute pantry commands from speech.

*Why:* the lower friction comes from describing many items in one pass. A general
assistant adds authority, privacy, state, and error modes that are unrelated to
that job.

### Voice is a sibling of camera capture

Pantry exposes a labelled **Speak items** action alongside its camera add and
manual fallback. The camera surface still automatically routes barcode, receipt,
or food images without asking the user which camera handler they want.

*Why:* overloading the camera action or hiding voice behind a long press harms
discoverability and conflicts with the camera-specific unified-capture contract.

### Session location supplies cheap context

The user starts from a location section or selects a visible session default
before recording. Every candidate inherits that location unless the transcript
explicitly changes it: “in the freezer there are two salmon fillets.” Location
remains editable per item.

*Why:* a kitchen sweep normally happens one shelf at a time. Asking for location
on every line would give back the friction voice removes.

### Parsing is evidence-preserving and source-neutral

A transient `PantryIntakeProposal` carries:

- raw transcript span and normalized display name;
- canonical match or unresolved alternatives;
- physical-container count;
- per-container amount, unit, and whether it is exact or approximate;
- session/proposed location;
- fullness/opened/acquisition-age evidence when spoken;
- independent confidence/review reasons for identity, amount, and location;
- source `voice`, transcription mode, and a stable draft/item id.

It does not require a photo URI. The same proposal model should later be usable
by image, barcode, receipt, and manual intake where their evidence overlaps.

*Why:* forcing voice through `CaptureItemProposal` would create fake image data
and still fail to distinguish “three cans” from “three grams.” A source-neutral
draft avoids parallel review systems.

### Container count and amount are different

“Two 400 g cans of tomatoes” means two physical containers with 400 g each.
“400 g tomatoes” means an amount with no stated container count. “A pack of six
chicken breasts” means one physical package containing six pieces. The parser
must preserve those distinctions and materialization must follow the existing
one-physical-container pantry rule.

*Why:* flattening every number into `qty_remaining` corrupts expiry, opened state,
and stock provenance.

### Self-correction beats first mention

Within one item phrase, an explicit correction such as “six eggs—actually seven”
supersedes the earlier value while retaining the source span for review. Filler,
pauses, and conjunctions are not treated as ingredients.

*Why:* hesitant correction is normal speech. Treating every numeral as a new
item would erase the speed advantage.

### Unknown is a valid value

“Some butter” creates a present-item proposal with quantity unknown. “Half a
carton” remains an approximate fullness unless the original carton size is
known. First inventory does not imply purchased today, and an unknown
acquisition date must not produce a precise expiry prediction.

*Why:* decisions 15 and 24 require a useful partial catalogue without fabricated
precision. The review can add detail later; the system cannot recover trust from
a confidently false date or amount.

### Phone speech and guaranteed-offline speech are separate modes

The default Android path uses the system-default `SpeechRecognizer` without an
explicit service package and without claiming guaranteed-offline processing. A
one-time, revocable disclosure explains that the phone's speech provider may
process audio off-device. This is the reliable, YouTube-like integration Android
documents; it must not be labelled Samsung speech merely because the hardware is
Samsung.

**Offline only** is a separate user choice. On Android it tries the platform's
generic on-device recognizer and, when the selected locale is missing, invokes
Android's official offline-language download flow. Only if that remains
unavailable does Mise offer an explicitly chosen Sherpa model: Parakeet for
European-language specialization or SenseVoice for the smaller multilingual
English/CJK path. Keyboard dictation and typing remain the final floor. An
engine failure never switches microphones mid-session: Mise preserves any safe
partial transcript and asks the user which recovery path to take.

Targeting `com.samsung.android.bixby.agent` is rejected. The installed Expo
module gives `requiresOnDeviceRecognition` precedence over an explicit package
on Android 13+, while Bixby's capability query is not a reliable public contract.
The app reports the engine mode it can prove, not the vendor it hopes Android
selected.

### One provider request structures the finished transcript

After Finish, speech recognition, keyboard dictation, and typing converge on one
editable transcript. With remembered **AI transcript parsing** consent and a
configured key, Mise sends one compact text request through the existing selected
provider/model. The payload contains only the transcript as untrusted JSON data,
the locale, visible location names/ids, and a strict output schema. It excludes
audio, pantry contents, the food catalogue, credentials, and provider-irrelevant
household context.

The response supplies source spans and nullable structured fields. Local
validation rejects any item, number, quantity, location, or state not supported
by an exact transcript span. The provider cannot create a canonical or alias,
merge stock, choose an existing container, or call a Pantry writer. The existing
local resolver and review remain authoritative.

One logical parse may use the shared transport's single provider-directed
rate-limit retry. It does not retry malformed output, authentication failure,
timeout, or a generic provider error. Valid evidence-backed candidates are kept;
the deterministic parser handles rejected and unused spans. With no key,
disabled consent, offline state, an eight-second foreground timeout, or provider
failure, the entire transcript goes directly to the deterministic parser and the
UI truthfully labels that fallback.

### Downloaded-model state comes from local evidence

The remote registry is used to discover and begin a download, never to decide
whether an existing local model is installed. Startup and Settings enumerate the
download manager's local manifests and `.ready` markers, reconcile old and
partial installations, and retain the real registry id/local path returned by
the download. A model becomes **Ready** only after checksum/file validation,
local path resolution, native model detection, and a bounded STT engine
initialize/destroy smoke test all succeed.

Large downloads use Android's persistent background downloader with a visible
system notification. Pause, resume, cancel, process restart, incomplete
extraction, corrupt-model repair, and insufficient-memory initialization are
durable states. A progress bar reaching 100% is never itself success. The model
preference is persisted in `expo-sqlite/kv-store`; no model downloads or switches
without the user choosing it.

### Parsing work is revision-bound and diagnosable

Each parse operation captures a transcript hash plus provider/model identity.
Editing, changing provider/model, navigating away, or cancelling aborts the work
and prevents a late response from overwriting a newer draft. Duplicate Finish is
disabled. Editing a parsed transcript requires an explicit **Parse corrected
transcript** action so it cannot create an unexpected second charge.

`src/components/settings/SpeechDiagnosticsSheet.tsx` exposes a restrained local
report: selected recognition mode, discoverable services, native error code,
installed registry id, ready/manifest/runtime state, parser path, provider/model
name, app version, and source commit. It never includes transcript text, API
keys, pantry data, or raw provider responses. Diagnostic events are local,
bounded, copyable by explicit action, and removed by Delete all data.

### Review optimizes the batch, not each line

After Finish, review shows a batch summary and two groups: clear proposals and
**Needs a look**. Each row can expand, edit, change location, choose an identity,
or be skipped. High-confidence candidates may be preselected but are never
auto-saved. Unknown quantity alone does not block adding a present item. A
blocking identity ambiguity stays unselected until resolved or explicitly kept
as user text under existing canonical-creation rules.

*Why:* eight separate wizard loops would be slower than photography. A compact
review preserves the benefit while keeping uncertain items honest.

### Confirmation is atomic, idempotent, and reversible

One confirmation writes every accepted proposal in an exclusive transaction,
records source provenance, returns the created ids, and schedules downstream
invalidation once. Repeated confirmation with the same draft id cannot create
duplicates. If any item cannot be materialized, the transaction writes none and
review identifies the problem. Success provides one bounded Undo action.

*Why:* the current photo path's independent inserts can partially commit. A
voice batch may be large enough that partial success and replay would be hard to
detect and repair.

### Audio is ephemeral; transcript retention is explicit

Raw audio exists only for the active transcription attempt and is deleted after
successful transcription, failure abandonment, or Cancel. It is never added to
the image pending-capture queue. By default, a transcript draft is also deleted
after confirmation or discard. If interruption recovery is included, only the
transcript and structured proposals persist locally; the UI says so and offers
Delete draft.

*Why:* pantry speech may incidentally capture names, conversations, or household
details. Retaining audio creates risk without product value.

### Voice intake does not own recommendations

After a confirmed batch, existing pantry-dependent suggestion caches are
invalidated once. A post-success action may open the existing dinner decision.
Future appliance-aware meal-prep onboarding may consume the same confirmed
stock, but this capability neither ranks nor generates recipes.

*Why:* inventory evidence and recommendation quality have different correctness
and safety contracts. Keeping them separate prevents a draft ingredient from
influencing a meal plan.

## Components and data flow

```text
Pantry / optional first-inventory invitation
  -> explicit microphone session + visible transcript
  -> phone speech OR explicit offline recognition OR keyboard/type
  -> editable transcript
  -> one consented provider parse OR deterministic local parser
  -> transcript-evidence validator
  -> source-neutral PantryIntakeProposal[]
  -> existing local canonical resolver
  -> compact batch review + existing match confirmation
  -> atomic pantry batch writer
  -> pantry refresh + one downstream invalidation + Undo
```

Expected touch points for a later implementation:

- `app/(tabs)/pantry.tsx` and/or a dedicated route under `app/` — labelled entry,
  recording, transcript, review, and recovery states.
- `src/types.ts` — source-neutral draft/proposal, field evidence, transcription
  mode, and review-reason types.
- `src/media/speech/adapters/native.ts` and `src/media/speech/routing.ts` —
  distinct system-default and offline recognizer modes with explicit recovery.
- `src/media/speech/modelStore.ts` and
  `src/media/speech/adapters/localModel.ts` — local-manifest reconciliation,
  background transfer state, runtime smoke validation, and chosen-model routing.
- `src/api/transport.ts` plus a voice-intake prompt/parser facade under
  `src/api/` — one consented transcript-only structured request with bounded
  retry, timeout, defensive parsing, and provider attribution.
- `src/logic/voicePantryParser.ts` and `src/logic/voiceIntakeService.ts` — local
  fallback, evidence validation, span reconciliation, and provider/local merge.
- `src/logic/captureItems.ts` — extract/generalize source-neutral proposal
  planning rather than adding a parallel voice-only resolver.
- `src/logic/resolution.ts` and alias types — add `voice` provenance.
- `src/logic/voicePantryParser.ts` — deterministic segmentation, correction,
  count-versus-amount, locale-aware unit, and storage-context parsing.
- `src/store/` — transient intake draft state without required photo evidence.
- `src/components/` — reuse canonical match confirmation and compact editors.
- `src/db/queries/pantry.ts` — atomic reviewed batch insert, idempotency, created-id
  return, and Undo.
- `src/db/schema.ts` — only a new forward-only migration if durable transcript
  recovery, idempotency metadata, or unknown acquisition dates require it.
- `src/api/keyStore.ts` — unchanged boundary; credentials never enter draft,
  database, logs, or export.

## Accessibility and interruption contract

- Voice is optional; Type instead and manual Pantry add have equal status.
- Start, Pause, Resume, Finish, and Cancel have text labels, stable positions,
  48dp Android / 44pt iOS targets, and screen-reader announcements.
- The waveform is decorative. Text always communicates listening, paused,
  processing, and error states. Live transcript changes are not continuously
  announced.
- Review exposes one logical candidate at a time with name, amount, location,
  selection, and reason. Rows stack at large text sizes and every action works by
  touch, keyboard, switch control, VoiceOver, and TalkBack.
- Calls, audio-route changes, microphone loss, or app backgrounding pause or stop
  capture immediately and never resume automatically. A retained transcript
  draft is explained on return.
- Permission denied, microphone in use, speech service unavailable, offline
  model unavailable, provider rejection, and food-resolution failure are
  distinct states with distinct recovery actions.

## Language and unit handling

- Recognition language is visible and independently selectable from app UI
  language. Silent language switching is not allowed.
- Original-script and code-switched ingredient names are preserved and passed to
  the existing alias layer without forced romanization.
- Decimal and unit parsing is locale-aware. Normalization shows the spoken phrase
  when conversion occurs and never invents precision.
- Count/container terms include at least pack, carton, can/tin, bag, bottle,
  bunch, head, clove, stalk, slice, and piece. Ambiguous terms remain literal
  until review.
- A user may re-transcribe in another language without rerecording only while the
  audio still exists in the active session and the privacy mode permits it.

## Risks / Trade-offs

- **Speech recognition quality varies by platform, accent, noise, and language.**
  Mitigation: editable transcript, typed fallback, separate confidence, fixture
  corpus, and no mutation before review.
- **Review could erase the speed benefit.** Mitigation: session location,
  preselected clear items, grouped ambiguity, batch confirmation, and unknown
  quantity as non-blocking.
- **A provider path weakens the privacy promise.** Mitigation: on-device first,
  remembered but revocable transcript-only consent, provider/payload disclosure,
  no app-directed audio upload, minimal text, and ephemeral active drafts.
- **The system-default speech service may process audio off-device.** Mitigation:
  disclose that boundary once before use, keep Offline only equally available,
  and never label an unverified vendor or processing location.
- **Provider output can hallucinate or obey spoken prompt injection.** Mitigation:
  treat the transcript as untrusted JSON data, expose no tools, require a strict
  schema and exact source spans, reject unsupported fields, and retain review.
- **Large local models may download but fail on limited hardware.** Mitigation:
  run detection and bounded initialization before Ready, retain repair/delete
  controls, and offer the phone service or the other model.
- **Existing pantry dates may require false purchase timestamps.** Mitigation:
  treat unknown acquisition time as a release-blocking domain gap; do not ship
  voice first-inventory until the schema and expiry logic can preserve unknown.
- **Container materialization can explode row counts.** Mitigation: preserve
  count separately in the draft, use existing physical-container semantics, and
  group confirmed rows in the Pantry UI.
- **Atomic Undo crosses expiry and suggestion invalidation.** Mitigation: return
  exact created ids, delete only that batch, and rerun downstream invalidation
  once.

## Migration Plan

1. Preserve the existing parser, proposal, review, and atomic-write implementation
   as the rollback floor.
2. Correct the product decision ledger before code so system speech, remembered
   transcript consent, provider parsing, and model readiness have one truth.
3. Split system-default and Offline-only recognition and add Android's official
   offline-language installation/recheck flow.
4. Reconcile local/partial Sherpa installs without a registry fetch, add runtime
   smoke validation, and persist the real chosen model identity.
5. Add the transcript-only provider parser, evidence validator, local fallback,
   revision binding, consent preference, and redacted diagnostics.
6. Run static/provider-contract tests, build from a committed source revision,
   then prove speech through Pantry review on the target Samsung before another
   prerelease is described as fixed.

Rollback is additive. Older builds ignore any new draft/idempotency metadata and
continue to use camera, barcode, receipt, and manual Pantry intake. No migration
may weaken existing pantry rows or alter stored API keys.

## Open Questions

No implementation-shaping questions remain after the owner grilling session.
Provider-specific live success and device performance are acceptance evidence to
collect, not decisions an implementation may silently answer differently.
