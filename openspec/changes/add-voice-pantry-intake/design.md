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

### Interpretation is tiered and local-first

The preferred pipeline is:

1. on-device/OS speech recognition produces an editable transcript;
2. deterministic local segmentation and quantity/unit parsing creates candidates;
3. the existing local canonical resolver handles known aliases;
4. only unresolved text may use the configured text provider, after explicit
   disclosure and consent for that session.

Cloud audio transcription is a separate adapter and is unavailable unless its
provider explicitly supports it. A vision-provider key does not imply consent or
capability for audio. If a second text request is proposed for unresolved
identity, the product states that separately and sends only the minimum relevant
text, not the audio or full pantry.

*Why:* it minimizes sensitive payloads, works better offline, and distinguishes
speech service availability from food-resolution availability.

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
  -> transcription adapter (on-device preferred; cloud explicitly consented)
  -> local segmentation and quantity parser
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
- `src/media/` — microphone lifecycle and on-device transcription adapter.
- `src/api/` — optional capability-gated cloud transcription; existing text
  transport only for explicitly approved unresolved text.
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
  per-session consent, provider/payload disclosure, minimal text-only second
  requests, and ephemeral audio.
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

1. Research platform transcription and settle on-device/cloud capability gates.
2. Introduce the source-neutral proposal and deterministic parser without any
   microphone, provider, schema, or pantry write.
3. Generalize existing capture proposal planning and canonical review behind the
   neutral type.
4. Add atomic batch materialization, idempotency, and Undo behind repository
   tests.
5. Add explicit recording/transcription adapters and transient draft state.
6. Add the Pantry/optional first-inventory UI and interruption/accessibility
   behavior.
7. Verify local-only, cloud-consented, offline, multilingual, noisy, interrupted,
   large-text, screen-reader, and process-restart scenarios on real devices.

Rollback is additive. Older builds ignore any new draft/idempotency metadata and
continue to use camera, barcode, receipt, and manual Pantry intake. No migration
may weaken existing pantry rows or alter stored API keys.

## Open Questions

1. Which platform speech APIs meet Mise's offline, language, APK-size, and Expo
   development-build constraints? This requires a measured spike before choosing
   a dependency.
2. Should interrupted drafts survive process death? Recommendation: retain only
   transcript/proposals locally for a short, user-visible recovery window; never
   retain raw audio.
3. How should legacy `purchased_at NOT NULL` represent stock already present when
   its acquisition date is unknown? Recommendation: add explicit unknown/precision
   semantics before this feature ships rather than pretending the capture date is
   the purchase date.
4. When speech states several loose units such as “three carrots,” does the
   existing pantry domain materialize one lot with three pieces or three physical
   rows? The answer must be shared by receipt, barcode, manual, and voice intake,
   not decided in a voice-only parser.
5. May a fully local deterministic parser preselect clear proposals without a
   model call? Recommendation: yes, while still requiring the batch review.
6. Which recognition languages and container vocabulary define v1, given Mise's
   Asian pantry differentiation? Recommendation: choose from a real mixed-language
   fixture corpus, not presumed market coverage.

