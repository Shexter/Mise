## Context

See `proposal.md` for motivation and
`specs/onboarding-intake/spec.md` for the observable contract.

`add-energy-sources` is active and already defines the authoritative persisted
model: `TargetSource`, one `BodyMeasurement` per DEXA/InBody provider, the
provider-specific derivations in `src/logic/bodyComposition.ts`, the stated
resting-figure path, non-destructive source switching, and warning-without-
clamping behaviour. This change adds an intake aid before that boundary. It
does not add another target source, measurement record, or calculation.

The current vision facade is `src/api/vision.ts`; there is no
`src/api/transport.ts`. It already owns an exhaustive provider map for
Anthropic, Gemini, and OpenAI, caller-supplied multimodal prompts, rate-limit
retry, API-key selection, and `VisionError` attribution. Report intake must
reuse that dispatch rather than duplicate provider selection.

The measured onboarding and Settings paths both converge on
`app/onboarding/energy.tsx`. `src/store/onboardingStore.ts` is in-memory only,
which is the correct lifetime for a selected report and unconfirmed candidates.
Images can be selected with the installed `expo-image-picker` and encoded by
`src/media/photos.ts`.

The visual and copy authority is `docs/brand-system.md`,
`src/constants/theme.ts`, and the shared components in `src/components/`.
Report photos are verification evidence and must not receive decorative image
treatment.

## Goals / Non-Goals

**Goals:**

- Establish one provider-neutral request path from image URI to reviewed,
  source-specific candidate fields.
- Keep syntactic response parsing separate from semantic sanitation and from
  the existing calorie calculation.
- Make unconfirmed candidates transient and make confirmation the only write
  boundary.
- Serve the same review flow from first-run onboarding and Settings without
  forking provider logic or persistence.
- Preserve the estimated path's routes, inputs, calculations, and output while
  replacing its welcome explanation with one coherent information hierarchy.

**Non-Goals:**

- A new database migration or an expanded `BodyMeasurement` shape.
- Persisting report images, confidence, raw responses, parser issues, or unused
  report metrics.
- Inferring a missing measurement, measurement date, provider, or unit.
- Treating extraction bounds as a medical assessment or preventing manual
  confirmation under the existing warning contract.
- A PDF renderer or OCR pipeline. This design consumes image URIs that the
  existing media path can encode.
- A new global design system, screen-local palette, or decorative health-data
  dashboard.

## Decisions

### Extraction is a transient adapter over `add-energy-sources`

The data path is:

```text
image picker
  -> transient photo URI
  -> image encoder
  -> provider-neutral multimodal transport
  -> prompt response parser
  -> pure semantic normaliser
  -> transient review draft
  -> explicit confirmation
  -> existing BodyMeasurement or stated-resting save path
```

The extraction result can contain every declared candidate because the report
may be ambiguous, but confirmation projects it into exactly one existing path:

- DEXA: confirmed weight plus body-fat percentage, or confirmed weight plus
  lean tissue and bone mineral content. The existing DEXA derivation produces
  fat-free mass.
- InBody: confirmed weight plus the printed Fat Free Mass, used as given.
- InBody printed BMR: only if explicitly chosen, map it to the existing
  `stated` + `resting` contract instead of storing it on `BodyMeasurement`.

All other candidates are discarded at confirmation. The existing
`saveBodyMeasurement`, `resolveTarget`, source-switching, and warning functions
remain the only persistence/calculation path.

**Alternative considered:** extend `BodyMeasurement` with confidence, image,
BMR, and every extracted metric. Rejected because it conflicts with decisions
170 and 174, creates health-history storage, and turns extraction metadata into
product data.

### Extract the existing provider dispatch into `src/api/transport.ts`

Create `src/api/transport.ts` by moving the provider-neutral `Transport`,
`TRANSPORTS`, retry helpers, and caller-supplied `completeVision` operation out
of `src/api/vision.ts`. `src/api/vision.ts` imports those primitives for meal
estimation and re-exports compatibility symbols used by current callers. There
must still be one exhaustive `Record<Provider, Transport>` and one API-key
selection path.

`src/api/bodyComposition.ts` implements:

```ts
extractBodyComposition(photoUri: string, signal?: AbortSignal)
```

It encodes the URI through `src/media/photos.ts`, builds the prompt, calls
`completeVision`, parses the response, runs the pure normaliser, and returns the
normalised transient extraction. Known `VisionError` instances are rethrown so
provider attribution, cancellation, rate limiting, billing, and recovery copy
remain intact. Unexpected unreadable media or response failures become
`VisionError('malformed', ...)` without logging the response or URI.

**Alternative considered:** import `completeVision` directly from
`src/api/vision.ts` and leave the requested transport module absent. That is
smaller, but keeps provider transport ownership inside a meal-named facade and
does not satisfy the intended provider-facade boundary. A parallel new facade
was also rejected because two provider maps would drift.

### The prompt has one canonical schema and no completion arithmetic

`src/api/bodyCompositionPrompt.ts` exports a prompt builder returning `system`
and `user` strings and a defensive response parser. The prompt requests one
JSON object with exactly these keys:

```ts
interface BodyCompositionPromptResponse {
  provider: 'dexa' | 'inbody' | 'unknown';
  weightKg: number | null;
  bodyFatPct: number | null;
  leanTissueKg: number | null;
  boneMineralContentKg: number | null;
  fatFreeMassKg: number | null;
  bmrKcal: number | null;
  confidence: 'high' | 'medium' | 'low';
}
```

The system prompt gives provider vocabulary, tells the model to return masses
in kilograms, and forbids deriving missing values. In particular, it must not
substitute skeletal muscle mass for InBody Fat Free Mass, add lean tissue and
bone to fill a missing DEXA value, derive fat-free mass from body fat, infer a
provider from a user-selected route, or invent a date. Existing domain logic
may derive DEXA fat-free mass only after human confirmation.

The response parser removes an optional Markdown fence, locates one JSON
object, and requires an object root. A missing/invalid provider becomes
`unknown`; a missing/invalid confidence becomes `low`; each absent candidate
becomes `null`; unknown keys are ignored. Empty content, invalid JSON, arrays,
and non-object roots throw the shared malformed error. The wire parser also
accepts provider deviations such as `"154 lb"` for a mass field as raw input
to the semantic normaliser; this is a defensive fallback, not part of the
prompted schema.

**Alternative considered:** ask the model for a completed `BodyMeasurement`.
Rejected because that would mix recognition, derivation, validation, date
choice, and persistence in an unreviewable step.

### Pure sanitation distinguishes unusable output from review warnings

`src/logic/bodyCompositionParser.ts` is pure and exports the canonical
normaliser plus named bounds/constants. It never reads storage, media, time, or
network state.

Sanitation is deterministic:

- trim strings; accept finite numbers and numeric strings only;
- accept kilograms directly;
- convert an explicitly labelled `lb`, `lbs`, or `pound(s)` value with the
  shared `lbToKg` conversion and round only for display, not internal storage;
- reject contradictory or unknown units rather than guessing;
- return `null` for zero, negative, `NaN`, infinity, and structurally invalid
  values;
- withhold weight at or below 20 kg and body-fat percentage outside the
  inclusive 3-60 range from automatic prefill;
- retain no derived candidate: one returned field can never manufacture
  another field;
- report field-specific review issues separately from candidate values.

Other positive mass and BMR candidates pass structural sanitation, then the
existing `energyInputWarnings` and provider derivation rules assess the
confirmed draft. Cross-field contradictions, such as fat-free mass materially
exceeding weight, produce review issues; they do not trigger arithmetic repair.
The review can require manual re-entry, but the person's manually confirmed
outlier remains governed by `add-energy-sources`: warn, never clamp or reject.

This two-stage policy is intentional. A model candidate does not earn the same
trust as a value a person has inspected and explicitly entered.

**Alternative considered:** clamp candidates into plausible ranges. Rejected
because the displayed number would no longer be what the report or person
provided. Rejecting all outliers was also rejected because legitimate outliers
must remain manually confirmable.

### Review state lives in the in-memory onboarding store

Extend `src/store/onboardingStore.ts` with one nullable transient draft:

```ts
interface BodyCompositionScanDraft {
  phase: 'selected' | 'extracting' | 'review' | 'error';
  photoUri: string;
  extraction: BodyCompositionExtraction | null;
  confidence: 'high' | 'medium' | 'low' | null;
  issues: readonly BodyCompositionIssue[];
}
```

Actions select/replace the image, begin extraction, receive candidates, record
a recoverable error kind, and clear the draft. Do not store an `Error`, API key,
raw provider response, or base64 payload. The `AbortController` remains local
to `app/onboarding/energy.tsx`, because it is tied to one mounted request rather
than navigation state.

The store survives the native picker and allows the same route to be opened
from onboarding or Settings. It is cleared on successful save, explicit
discard, full onboarding reset, and source change away from the reviewed
provider. On request failure or cancellation, it retains the URI and editable
values for retry/manual entry.

**Alternative considered:** component-local state only. Rejected because it is
easy to lose the thumbnail/candidates across picker and Settings navigation,
and the user explicitly needs a stable review boundary. SQLite persistence was
rejected because unconfirmed health-report output must not outlive the flow.

### One energy screen owns manual, pending, review, and save states

`app/onboarding/energy.tsx` remains the shared route for DEXA, InBody, and stated
inputs. For DEXA/InBody it gains a compact intake section above the existing
provider-specific fields:

1. `idle/manual`: choose a report image or type the fields;
2. `selected`: show the unaltered thumbnail, precise provider-transmission
   copy, Analyse and Replace actions;
3. `extracting`: preserve the image and fields, expose labelled busy semantics,
   allow cancellation, and use the existing reduced-motion progress language;
4. `review`: show detected provider/confidence, mismatch or field issues, scan
   date, and editable provider-specific fields;
5. `error`: keep evidence and inputs, use shared `VisionError` recovery copy,
   and offer retry, key settings, or manual entry as appropriate.

Provider mismatch never changes `targetSource` by itself. The person must
choose to switch or keep the selected source. Low confidence changes emphasis
and copy only; it never disables editing. Save remains disabled until the
existing provider's required confirmed fields and scan date are present.

The report image is evidence: use an ordinary thumbnail/preview with a
hairline boundary, no tint, blur, crop that hides labels, decorative frame, or
medical-dashboard treatment. Use existing `StepShell`, `Field`, `Button`,
`Caption`, typography, semantic colours, spacing, radii, focus handling, and
large-text behaviour. No new screen-local visual constants.

**Alternative considered:** a new scan-review route. Rejected because it would
duplicate field/save logic, add navigation state, and make onboarding and
Settings drift. If implementation proves the single component unreadable,
extract view components under `src/components/` while keeping the route and
state machine single.

### Welcome copy changes; estimated-path behaviour does not

`app/onboarding/welcome.tsx` keeps the brand promise and makes the setup reason
the next sentence rather than presenting a general product/privacy paragraph.
The intended hierarchy is:

- product promise: “Cook from what you have, tracked as you go.”;
- practical explanation: start with a daily energy target so logged meals have
  a useful reference point, and note that it can be changed later;
- primary action: the existing estimated path, labelled as setting the target;
- quiet alternate-source group: DEXA, InBody, and known figure;
- precise privacy proof: diary data is local; a chosen photo leaves the device
  only for the selected provider analysis.

No AI label, model name, “smart/personalised/optimised” claim, fake precision,
health promise, extra card grid, or extra screen is introduced. The navigation
snapshot test from `add-energy-sources` is updated only where it asserted exact
welcome copy; route/order/tap/result assertions remain unchanged.

### Settings reuses the route and save boundary

The existing Settings source chooser continues to seed the in-memory
`targetSource` and navigate to `app/onboarding/energy.tsx`. If a saved
measurement exists, its persisted fields seed manual review; a newly extracted
candidate does not overwrite it until confirmation. Saving replaces only the
chosen provider through existing queries, recomputes through the existing
resolver, returns to Settings, and clears transient scan state. Cancelling
leaves the saved measurement and target unchanged.

## Risks / Trade-offs

- **Sensitive report image is sent to a third-party model** -> require an
  explicit Analyse action, state the boundary before sending, use only the
  person's stored provider key, retain no response/image record, and never log
  content or URI.
- **Model returns convincing but wrong values** -> forbid completion arithmetic,
  use source vocabulary, apply deterministic sanitation, show confidence and
  image evidence, and require editable human confirmation.
- **DEXA/InBody mismatch silently changes meaning** -> disclose mismatch and
  require an explicit source choice; never map fields by route alone.
- **Imperial conversion loses source context** -> convert only explicitly
  labelled imperial values with the shared conversion constant; unknown units
  become absent.
- **Strict extraction bounds hide a legitimate outlier** -> bounds govern
  automatic prefill only; manual confirmation remains available under the
  existing warn-never-clamp contract.
- **Transport extraction regresses meal/receipt/recipe vision** -> preserve
  compatibility exports and run existing provider-facade and vision suites in
  addition to new focused tests.
- **Active `add-energy-sources` changes while this is implemented** -> begin
  apply by re-reading its artifacts and live code; keep its types, persistence,
  derivations, and switch tests authoritative.
- **One screen becomes dense** -> use a small explicit state machine and extract
  view-only shared components if necessary; do not create a second save path.
- **Native image/document support differs by platform** -> scope acceptance to
  supported image assets and record camera/library/device verification
  separately from unit tests; PDF conversion remains out of scope.

## Migration Plan

1. Reconfirm that `add-energy-sources` types, persistence, derivation, and
   onboarding/Settings routes are present and its targeted tests pass.
2. Extract the provider-neutral transport with compatibility tests before
   adding the new caller; no provider or key behaviour changes.
3. Add the pure prompt parser and semantic normaliser with fixtures and boundary
   tests, then add the URI-to-extraction facade.
4. Add transient store state and wire the review state machine into the shared
   energy route.
5. Update welcome copy and the behavioural snapshot tests without changing the
   estimated route.
6. Run focused tests, full Vitest, TypeScript typecheck, strict OpenSpec
   validation, and device checks for picker permissions, cancellation, large
   text, reduced motion, and both onboarding and Settings entry points.

No database migration or data backfill is required. Rollback removes the
intake UI, transient store fields, and extraction modules while leaving every
previously confirmed `BodyMeasurement` and profile value valid under
`add-energy-sources`.
