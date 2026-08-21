## Context

See `proposal.md` for motivation and `specs/onboarding-ux/spec.md` for the
observable contract.

This change sits on two active contracts. `add-energy-sources` owns the closed
`estimated | dexa | inbody | stated` source set, provider-specific inputs,
calculation and warning rules, per-provider persistence, and non-destructive
switching. `improve-onboarding-cohesion-and-scan-intake` owns transient report
selection, provider-backed extraction, editable review, and explicit save. The
new work changes the path into those contracts, not their persisted models.

The regular estimated path already uses separate routes for formula sex, age,
height, weight, activity, and goal. The main input problem is therefore control
ergonomics and guidance, not a need to combine or repartition those routes.
`app/onboarding/energy.tsx`, by contrast, currently renders report intake and
many source fields together. Its Settings entrance is the same route, which is
useful convergence to retain.

Key setup is currently linear: `app/onboarding/api-key.tsx` always continues to
the dietary step. A scan user sent there after a key failure loses the semantic
destination even if in-memory scan state survives. `src/api/keyStore.ts` is and
remains the only credential authority.

The startup bug has two causes. `app/_layout.tsx` races database initialisation
against a three-second timeout and publishes `dataReady = true` after either
success or failure. A DB-backed route can then call `db()` while the handle is
null. In addition, `src/db/index.ts` does not clear the shared `opening` promise
when opening rejects, so a Retry would receive the same rejected promise unless
the lifecycle is repaired.

The Cronometer material in `competitor-analysis/cronometer/goals-targets/`
provides interaction evidence for focused profile rows and native-feeling
sex, birthday, and height pickers. Mise borrows the low-friction mechanics, not
the dense dark styling, evaluative health framing, or full-birthday storage.

## Goals / Non-Goals

**Goals:**

- Make a missing API key an explained choice point rather than a provider
  error discovered after selecting a private report.
- Preserve source, origin, report, and manual draft state through key setup
  using a small, type-safe navigation contract.
- Share progressive input primitives and validation between first-run and
  Settings while keeping current calculations and saved models authoritative.
- Separate picker position, draft value, confirmation, and persisted value so
  a convenient starting point can never become invented user data.
- Fix database startup as a lifecycle invariant, then retain a route-local
  guard around measurement reads and writes.

**Non-Goals:**

- Rewriting the energy calculation, extraction engine, API transport, key
  format detection, or body-measurement persistence.
- Adding a full date of birth to `Profile`, SQLite, export, logs, analytics, or
  any long-lived store.
- Building a cross-application form engine or copying Cronometer's visual
  system.
- Adding a server-side key proxy, provider account creation, automatic billing,
  or a network requirement for manual entry.
- Using population bands to judge, prescribe, celebrate, or warn about a
  person's body.

## Decisions

### Model energy intake as explicit stages, not conditional field piles

Keep the existing route-per-question estimated flow. Within the shared measured
energy route, introduce a typed stage reducer with source-specific transitions:

```text
enter measured source
  -> check key readiness
  -> [key explainer | scan-or-manual]
  -> [key setup and return | select report | manual questions]
  -> [report consent -> extraction -> review]
  -> fill only missing required source fields
  -> activity and goal when required
  -> summary
  -> explicit save through existing resolver/persistence
```

The reducer state distinguishes `origin` (`onboarding | settings`), `source`,
`mode` (`undecided | scan | manual`), `stage`, values, and a confirmation map.
The existing transient scan draft remains the only report-image/candidate
state. The measured editor can be decomposed into focused child components,
but the reducer is the single transition authority; individual components do
not push arbitrary next routes.

Source transitions are total and follow decisions 173 and 175:

- DEXA: measurement date, weight, then either body fat or lean tissue plus bone
  mineral content.
- InBody: measurement date, weight, printed Fat Free Mass, then the existing
  optional printed-BMR decision.
- Stated: its current figure-kind, activity, and goal behavior remains outside
  scan/key gating.
- Estimated: existing route order and calculations remain intact.

An accepted extraction skips questions only where a usable candidate is
present; it never marks that candidate confirmed. Review can display the
evidence together, then focus one unconfirmed/missing value at a time.

**Alternative considered:** hide later fields in place as earlier fields are
filled. Rejected because one long component still creates gesture/keyboard
conflicts, weak back semantics, and hard-to-test implicit transitions.

### Use a bounded return-intent enum for API-key detours

Add transient navigation intent to `src/store/onboardingStore.ts` rather than a
free-form redirect string:

```ts
type ApiKeyReturnIntent =
  | { kind: 'default-onboarding' }
  | { kind: 'energy-onboarding'; source: 'dexa' | 'inbody' }
  | { kind: 'energy-settings'; source: 'dexa' | 'inbody' };
```

The measured editor sets the intent before opening
`app/onboarding/api-key.tsx`. That screen resolves the union exhaustively after
save or cancel, clears the intent after consumption, and falls back to its
current safe default if the intent is absent or invalid. It does not accept a
URL or route name from external input. The source and existing scan/manual
draft remain in memory and are not placed in query strings, SQLite, Secure
Store, or logs.

The generic key step keeps its current skip-to-dietary behavior. Only an
explicit measured-intake detour changes the return destination.

**Alternative considered:** pass `returnTo=/onboarding/energy` as a query
parameter. Rejected because it permits stale or arbitrary routes, loses origin
semantics, and makes the privacy-sensitive report draft depend on URL state.

### Check key readiness before image access and repeat consent at send time

The measured route calls `hasApiKey()` on entry and models
`checking | present | missing | unavailable`. A missing key reveals a concise
explainer before camera/photo buttons. `present` goes to scan-or-manual choice;
`unavailable` offers Retry and manual entry without claiming the key is absent.

The explainer has a stable hierarchy:

1. **Why:** a vision provider reads the figures so the user need not transcribe
   the report.
2. **Reuse:** the same key can later power photo meal logging and calorie
   estimation.
3. **Boundary:** the chosen report goes directly from the phone to that
   provider; Mise has no relay server, and provider terms/data handling apply.
4. **Choice:** set up a key, or enter values manually and add one later.

The selected-image review repeats the boundary beside “Read this report.” No
provider call occurs at key-check, image-selection, or preview time.

Gemini is the recommended setup card because Google's current documentation
says new users receive a project/key and frames the first call as under a
minute. Copy uses “usually about a minute” and “Gemini currently offers a free
tier,” links to `https://ai.google.dev/gemini-api/docs/get-started` and
`https://ai.google.dev/gemini-api/docs/pricing`, and explicitly notes limits
and terms can change. The free-tier disclosure also states that Google
currently lists free-tier content as usable to improve its products. Anthropic
and OpenAI remain first-class supported choices in the existing key form.

**Alternative considered:** say extraction happens on-device because the URI
is prepared locally and Mise has no server. Rejected as materially misleading:
the model inference occurs at the provider.

### Picker position, draft value, and confirmation are separate state

Build shared primitives under `src/components/onboarding/` rather than embed
scroll math in route files:

- `FormulaSexControl`: accessible two-option selection with no initial answer.
- `BirthdayPicker`: a native date control wrapped in Mise's labels, range, and
  confirmation semantics.
- `MeasurementPicker`: a unit-aware snapped numeric control with increment,
  decrement, direct-entry, and explicit “Use …” confirmation.
- `FieldGuidance`: purpose, accepted range/vocabulary, and optional sourced
  neutral context.

Numeric state uses:

```ts
interface ConfirmableValue<T> {
  position: T;
  value: T | null;
  origin: 'anchor' | 'saved' | 'typed' | 'extracted';
  confirmed: boolean;
}
```

Fresh controls get cursor anchors chosen to minimise adjustment, not to claim a
personal norm: height 170 cm, weight 70 kg, DEXA body fat 23% after confirmed
male formula sex, 28% after confirmed female formula sex, and 25% when formula
sex is unavailable. Anchor values are constants with tests and explanatory
comments. They do not enter the onboarding store until a person moves the
control or taps the explicit confirmation action. Saved, typed, or extracted
values always replace the anchor position.

Height and weight use `HEIGHT_RANGE_CM` and `WEIGHT_RANGE_KG`; body fat uses
the existing 3-60 extraction/prefill range and energy warning behavior.
Unit conversion happens through `src/logic/units.ts` around one canonical
metric value, so repeated display-unit changes do not round-trip the already
rounded display. Direct entry supports decimal precision. A typed outlier is
not clamped; it follows the existing warning/confirmation policy.

The numeric picker uses React Native scrolling and the installed gesture,
haptic, and reduced-motion infrastructure. It must also expose accessible
increment/decrement actions and direct entry, so snapping is an enhancement,
not the only input method.

**Alternative considered:** initialise the existing text fields with averages.
Rejected because a prefilled field looks like user data and can be submitted
without conscious confirmation.

### Use the SDK-compatible native date picker, but persist only age

Install Expo SDK 54's supported
`@react-native-community/datetimepicker` version with `npx expo install`; Expo's
SDK 54 documentation currently recommends 8.4.4 and includes it in Expo Go.
Wrap it so route code does not depend on platform-specific event details. The
wrapper presents year/month/day selection in the platform's accessible date
UI and constrains dates to those producing `AGE_RANGE` 13-100.

Add pure helpers under `src/logic/age.ts`:

- a calendar-only `{ year, month, day }` shape;
- validity and supported-range checks;
- `ageOnDate(birthday, today)` with no UTC conversion;
- one explicit leap-day rule: in a non-leap year, February 29 reaches its
  anniversary on March 1.

The birthday exists only in local component state. On confirmation, the route
stores the computed integer `age` in the existing onboarding draft and clears
the calendar tuple. Existing Settings/profile age remains the seed; this
change does not attempt to reconstruct a birth date from an age.

**Alternative considered:** add `birthDate` to `Profile`. Rejected because the
formula needs only age, a full date is more sensitive, and reconstructing or
annually updating it would require a migration and new lifecycle behavior.

### Guidance uses domain bounds and sourced context, never labels

Guidance is defined as structured copy adjacent to the domain constants, not
as scattered screen strings. Every field states purpose and accepted input:

- formula sex: identifies the Mifflin-St Jeor input without equating it to
  identity;
- birthday: states that only age is kept and shows the accepted age range;
- height/weight: uses the named accepted ranges and says the values feed the
  energy estimate;
- DEXA/InBody fields: uses the exact report vocabulary and source-specific
  calculation purpose;
- body fat: “Picker range: 3-60%. Reports and reference ranges vary by age and
  source; this is a calculation input, not a score.”

If user research later supports a phrase such as “typical athletic range,” it
must include a named source and applicable population context before shipping.
The initial implementation does not use athletic/average/ideal labels because
they conflict with decision 170 and can turn generic statistics into a personal
assessment.

**Alternative considered:** hard-code broad male/female “athletic” and
“average” bands from competitor copy. Rejected as unsourced, overgeneralised,
and inconsistent with Mise's non-judgmental posture.

### Publish real database readiness and make retry create a new attempt

Add one lifecycle authority under `src/db/readiness.ts` with a subscribed state:

```ts
type DatabasePhase = 'opening' | 'ready' | 'unavailable';
interface DatabaseReadiness {
  phase: DatabasePhase;
  attempt: number;
  error: unknown | null;
}
```

`app/_layout.tsx` starts an attempt after fonts begin loading, awaits
`openDatabase()`, environment key seeding, and profile loading, and publishes
`ready` only after they resolve. Remove the `Promise.race` path that converts a
timeout/failure into success. A visible `StorageUnavailable` surface replaces
the permanent blank splash on a true failure and offers Retry. A slow open
stays in `opening`; it is not a failure merely because three seconds elapsed.

Repair `src/db/index.ts` so `opening` is reset in `finally`, including rejected
attempts. If a handle opens but migration/seed fails, close or otherwise
invalidate that partial handle before retry; never publish it through `db()`.
Concurrent callers still share one attempt. Tests reset module lifecycle state
through a test-only boundary, not by mutating production globals from route
tests.

Wrap the navigation stack with the readiness provider. DB-backed routes do not
mount until `ready`. `app/onboarding/energy.tsx` also reads the same state:
measurement-seeding effects return before ready, and the save handler rechecks
ready before calling a query. This is defence in depth for navigation
restoration, hot reload, and isolated route tests. Errors are rendered as a
durable recovery state, not emitted as the misleading database toast.

**Alternative considered:** keep the timeout and catch query failures inside
`energy.tsx`. Rejected because other DB-backed routes remain exposed and a
timeout is not evidence that storage is safe or impossible.

### First-run and Settings share adapters, not duplicated screens

`app/onboarding/energy.tsx` remains the convergence point for measured intake.
The Settings source chooser sets `origin: 'settings'`; welcome sets
`origin: 'onboarding'`. Both use the same reducer, controls, guidance,
validation, key gate, scan review, and save adapter. Only completion differs:
onboarding creates/continues the profile, while Settings updates and returns.

Estimated route controls and `src/components/settings/ProfileSheet.tsx` share
pure picker and validation primitives where their data models match. Settings
seeds from persisted values after DB readiness and writes nothing until save.
Switching providers continues to load each provider's existing record and
never deletes the other.

**Alternative considered:** build a separate Settings scan editor to avoid
origin branching. Rejected because key guidance, conversion, confirmation, and
warning behavior would drift.

## Risks / Trade-offs

- **[A native birthday picker looks different across iOS and Android]** → Wrap
  platform UI in consistent labels, helper copy, confirm/cancel actions, and
  tests; accept native control differences as an accessibility benefit.
- **[Adding a date-picker dependency can break Expo compatibility]** → Install
  only through `npx expo install`, pin the SDK 54-compatible version, run Expo
  Doctor, and verify both Expo Go/development build behavior before completion.
- **[Starting anchors may be mistaken for recommendations]** → Use neutral copy,
  never mark anchors confirmed, disable Continue, and instrument no analytics
  with the anchor value.
- **[Birthday collection feels more sensitive than age]** → Explain that only
  age is kept, hold the tuple in component state only, and test that store,
  SQLite, export, and logs never receive it.
- **[Provider pricing or privacy terms change]** → Link to current provider
  pages, qualify all claims, centralise the copy/source metadata, and include a
  release audit task rather than embedding quotas or prices.
- **[Free-tier scan data may be used by the provider to improve products]** →
  Disclose the current policy before key setup/send and keep manual entry a
  first-class path.
- **[Progressive stages can create more taps for measured entry]** → Skip
  satisfied extracted fields, preserve back state, keep related DEXA alternative
  inputs in one focused decision, and validate time-to-completion on device.
- **[A DB open can hang indefinitely]** → Keep the non-destructive opening
  state, offer an explicit user-triggered recovery affordance only when the
  platform reports failure, and add platform-specific diagnostics without
  pretending DB-backed features are ready.
- **[Retry after partial migration failure can reuse a bad handle]** → Reset the
  shared promise in `finally`, invalidate partial handles, retain forward-only
  migration semantics, and cover reject-then-success behavior with unit tests.
- **[Large text or screen readers can make wheel controls cumbersome]** →
  provide direct entry and accessible adjustment actions; validate at maximum
  supported text size and with reduced motion.

## Migration Plan

1. Land pure age, picker-state, conversion, and intent tests before changing
   screens. Add the SDK-compatible date-picker package with the Expo installer
   and record Expo Doctor output.
2. Repair the DB opening promise and add the readiness authority/recovery
   surface. Remove timeout-as-success only after delayed, rejected, retry, and
   concurrent-open tests pass.
3. Add route-level DB guards to measured intake, then add the bounded API-key
   return intent and key-readiness explainer. Existing default key onboarding
   remains the fallback.
4. Introduce shared controls behind the current route boundaries, beginning
   with estimated onboarding. Then convert measured intake to the explicit
   stage reducer and reuse it from Settings.
5. Run copy/privacy, accessibility, reduced-motion, device-picker, slow-start,
   no-key, invalid-key, scan-review, manual-only, and Settings regression
   acceptance before marking the change complete.

Rollback removes the new presentation/reducer layer and returns routes to the
existing text controls. There is no schema or data rollback. The DB readiness
repair should remain even if the picker UX is rolled back because it restores
the documented precondition of `db()`.

## Open Questions

None. Provider wording and dependency versions require release-time freshness
checks, but those checks do not change the specified behavior or architecture.
