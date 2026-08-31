## Why

Mise's first pantry inventory is valuable but expensive to create. Photographing
items, scanning barcodes, and reviewing receipts remain useful evidence-rich
paths, yet a user looking into a full fridge can name its contents much faster
than they can capture each item: “six chicken breasts, half a broccoli, half a
carton of milk, three carrots, some butter, seven eggs, blueberries, and
watermelon.”

Voice can turn that kitchen sweep into a reviewed pantry draft in one short
session. It must not turn uncertain speech into confident stock. The transcript
is user-provided evidence; identity, count, amount, location, age, and opened
state remain independently reviewable. Nothing enters the pantry until the user
explicitly confirms the batch.

This change affects decisions 5 and 8 (local-first data with explicit network
limits), 15 (never expose quantities Mise cannot defend), 16 and 18 (editable
locations and proposed location), 23 and 24 (fast progressive first-run capture
without gating the app), and 25 through 28 (all food references pass through the
identity layer). It complements decisions 33 through 40: confirmed stock may
improve the existing dinner decision, but voice intake does not generate recipes
itself.

## What Changes

- Add **Speak your pantry**, a distinct push-to-talk action available from Pantry
  and as an optional first-inventory invitation after onboarding. It is a sibling
  to camera capture and manual entry, not a replacement or a background listener.
- Let the user set a session location such as Fridge, or inherit it by launching
  from that location. Spoken location changes override the session default for
  the affected items.
- Show an unmistakable listening state, live transcript, elapsed time, Pause,
  Finish, Cancel, and an equal-status Type instead path.
- Convert the finished transcript into source-neutral pantry item proposals with
  separate fields for ingredient identity, physical-container count,
  per-container amount and unit, location, approximate fullness, opened state,
  and acquisition-age evidence.
- Preserve ordinary speech rather than inventing precision. “Some butter” has
  unknown quantity; “half a carton” remains approximate; “seven eggs left” is a
  user-attested current amount; a missing purchase date remains unknown.
- Reuse the existing local canonical resolver first. Uncertain identities,
  quantities, locations, and duplicates are surfaced with plain-language reasons
  and remain independently editable or skippable.
- Present one compact multi-item review with clear items preselected and uncertain
  items separated under **Needs a look**. A precise final action such as **Add 8
  items to Fridge** is the only mutation boundary.
- Commit accepted items atomically, prevent replay from creating duplicates, and
  provide a batch Undo action. Cancelled or abandoned drafts create no stock.
- Prefer on-device speech recognition. Any cloud transcription or text extraction
  requires explicit per-session disclosure of the provider and payload. Raw audio
  is ephemeral and deleted after transcription or cancellation.
- Invalidate pantry-dependent suggestions once after a successful batch. The
  existing dinner decision may then offer a meal based on confirmed stock and the
  user's owned appliances when that separate meal-prep capability exists.

### Example interpretation

| Spoken phrase | Review proposal | What Mise must not infer |
| --- | --- | --- |
| “a pack of 6 chicken breasts” | Chicken breast; one package; 6 pieces; Fridge | Package weight, purchase date, or expiry |
| “half a broccoli head” | Broccoli; about half a head; Fridge | A gram weight |
| “half a carton of milk” | Milk; one carton; about half full; Fridge | The carton's original size |
| “3 carrots” | Carrots; 3 pieces; Fridge | Whether they were bought together |
| “some butter” | Butter; quantity unknown; Fridge | A default stick or gram amount |
| “7 eggs left” | Eggs; 7 pieces remaining; Fridge | Original carton size |
| “blueberries, watermelon” | Two present items; quantity unknown; Fridge | Package size, cut state, or purchase date |

## Capabilities

### New Capabilities

- `voice-pantry-intake`: Explicit microphone capture, transcript lifecycle,
  source-neutral pantry proposals, uncertainty-aware review, privacy boundaries,
  and atomic handoff into the existing pantry domain.

### Modified Capabilities

None. Camera routing remains owned by `unified-capture`; canonical matching,
pantry persistence, expiry, editing, and dinner ranking remain their existing
capabilities. This change feeds them reviewed evidence rather than redefining
them.

## Impact

**User experience.** Pantry gains a labelled voice action and an optional
first-inventory invitation. Camera capture remains one camera action without an
input-method chooser. Manual entry remains available at every failure or
permission boundary.

**Domain.** A transient, source-neutral intake proposal distinguishes container
count from amount and records provenance per field. Unknown values stay nullable.
The current rule that one pantry row represents one physical container remains
authoritative when accepted proposals are materialized.

**Architecture.** The likely seams are `src/logic/captureItems.ts`,
`src/logic/resolution.ts`, `src/db/queries/pantry.ts`, `src/types.ts`, a new
speech/transcription adapter under `src/media/` or `src/api/`, a source-neutral
intake draft store, Pantry entry surfaces under `app/`, and the existing match
and review components. Provider keys remain confined to
`src/api/keyStore.ts`.

**Data.** Raw audio is not pantry data and is never retained after the active
session. Transcript drafts are local and temporary. A forward-only migration is
needed only if interrupted transcript drafts must survive process death or if
the pantry model cannot represent an unknown acquisition date without inventing
one; both are explicit design gates before implementation.

**Dependencies.** Expo SDK 54 does not currently provide an installed,
cross-platform speech-to-text path in this repository. Native/on-device speech
options, development-build requirements, permission strings, language support,
artifact impact, and provider retention contracts must be researched before a
dependency is selected.

## Non-goals

- Always-on listening, a wake word, background recording, or resuming the
  microphone automatically after an interruption.
- Applying stock from live or partial speech without review.
- Conversational stock editing or deletion such as “remove the milk.”
- Meal logging, recipe dictation, shopping-list commands, or a general-purpose
  voice assistant.
- Replacing camera, barcode, receipt, or manual intake.
- Inferring weights, package sizes, purchase dates, opened state, or expiry from
  typical values when the user did not provide them.
- Storing raw audio, training on user speech, or silently sending audio,
  transcripts, pantry history, or profile data to a provider.
- Making voice intake mandatory during onboarding or requiring speech/hearing to
  use Pantry.

