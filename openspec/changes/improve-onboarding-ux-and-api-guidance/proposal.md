## Why

People who enter onboarding with a DEXA or InBody report currently reach scan
controls before Mise establishes whether their vision-provider key is ready or
explains what will leave the device. At the same time, manual energy intake
still relies on text-entry-heavy forms, and the app can expose `energy.tsx`
before SQLite has opened, producing the observed “Database used before it was
open” failure instead of a usable onboarding step.

This change makes both first-run and later Settings entry calm and progressive:
state the provider boundary before a report is selected or sent, offer key
setup or an immediate manual path, collect only one meaningful answer at a
time, and never mount DB-dependent work until storage is genuinely ready.

## What Changes

- Add a pre-scan API-key readiness state to the DEXA/InBody intake shared by
  onboarding and Settings. If no key exists, explain why vision access is
  needed, how the same user-owned key can support later photo meal logging,
  what data is sent to the selected provider, and offer two equal, non-blocking
  paths: set up a key or enter values manually.
- Recommend Google Gemini as a low-friction option while keeping the existing
  Gemini, Anthropic, and OpenAI key contract provider-neutral. Product copy
  describes Gemini's current free tier and approximate setup time as
  changeable third-party terms, never as a permanent promise.
- Preserve the user's intake intent across key setup, cancellation, and back
  navigation so DEXA/InBody users return to the same energy flow with transient
  scan/manual state intact instead of being advanced through the generic
  onboarding sequence.
- Replace dense or text-entry-heavy body inputs with a progressive, focused
  interaction model. Use an accessible segmented control for formula sex, an
  ergonomic date picker that derives but does not persist full birth date,
  unit-aware height/weight pickers with neutral starting anchors, and an
  adjustable body-fat picker plus precise manual-entry fallback.
- Treat every suggested picker value as an unconfirmed cursor position, not
  user data. Continue remains disabled until the person adjusts or explicitly
  confirms it; existing saved or extracted values take precedence.
- Show concise contextual guidance for each field: why Mise needs it, the
  accepted input range, and neutral reference context where useful. Avoid
  diagnosing, grading, or labelling a body as athletic, average, healthy, or
  unhealthy.
- Keep DEXA and InBody questions source-specific and progressively request only
  missing values. Scan extraction still lands in the existing editable review
  flow; manual entry stays available before, during, and after key setup or
  extraction failure.
- Replace the startup timeout/boolean with an explicit database readiness
  contract. DB-backed onboarding routes do not mount or query until
  `openDatabase()` succeeds; delayed or failed opening shows a calm retry state,
  and `energy.tsx` retains a route-level guard as defence in depth.

This change implements decisions 5, 8, and 15 and preserves the energy-source
contracts in decisions 166-175. In particular, it keeps decision 172's four
entrances and regular path length, decision 173's separate DEXA/InBody
vocabulary, decision 174's non-destructive provider records, and decision
175's rule that a source asks only for inputs its calculation needs.

## Capabilities

### New Capabilities

- `onboarding-ux`: Transparent API-key guidance, progressive energy inputs,
  intent-preserving navigation, and database-ready gating for first-run and
  Settings energy intake.

### Modified Capabilities

None. `energy-sources` and `onboarding-intake` remain active changes rather
than main specs. This capability explicitly extends their source, extraction,
review, persistence, and calculation contracts without changing either data
model.

## Non-goals

- Writing application code, changing the database schema, or adding a new
  energy source, body-measurement shape, scan history, or persisted birth date.
- Requiring an API key to complete onboarding, to enter scan values manually,
  or to edit energy data later in Settings.
- Claiming scan extraction happens entirely on-device. The image is prepared
  locally and sent directly to the vision provider selected by the user's key;
  Mise still has no server, account, or copy of the key.
- Promising that a third-party API remains free, retaining provider pricing in
  app state, or preferentially blocking non-Gemini providers.
- Collecting gender identity, pregnancy status, medical history, or any field
  not used by the selected energy calculation. “Sex” remains a transparent
  formula input under the existing estimated-source contract.
- Assessing fitness, health, scan quality, or body composition; showing
  prescriptive “ideal” values; or silently clamping a user-confirmed outlier.
- Adding questions, screens, or taps to the estimated path solely to support
  scan users. Picker ergonomics may improve existing steps without changing
  their calculation or required answers.
- Making the app usable without a vision-provider network connection. Manual
  intake remains offline-capable; provider-backed extraction does not.

## Impact

- **OpenSpec dependencies:** implementation must extend, not replace,
  `add-energy-sources` and
  `improve-onboarding-cohesion-and-scan-intake`. Their `TargetSource`,
  `BodyMeasurement`, transient scan draft, provider-specific derivations,
  warning rules, and confirmation boundary remain authoritative.
- **Navigation and state:** `app/onboarding/energy.tsx`,
  `app/onboarding/api-key.tsx`, the Settings energy entrance, and transient
  onboarding state gain a bounded return intent and progressive confirmation
  state. No scan image, API key, full birth date, or unconfirmed anchor is
  persisted.
- **UI and logic:** onboarding sex, age/birthday, height, weight, and measured
  inputs adopt shared accessible picker primitives and pure date/unit helpers.
  The existing calculation modules remain the only target authority.
- **Database lifecycle:** `app/_layout.tsx` exposes explicit opening, ready, and
  unavailable states; DB-dependent reads/writes are guarded centrally and at
  the energy route. No migration is expected.
- **Privacy and keys:** key storage stays confined to
  `src/api/keyStore.ts`. Guidance links to current provider documentation and
  states that provider terms and data handling apply before any report leaves
  the device.
- **Dependencies:** implementation may add an Expo-compatible native date
  picker only after verifying SDK 54 compatibility and accessibility. Numeric
  pickers should prefer existing React Native scrolling, gesture, haptic,
  reduced-motion, and theme infrastructure over a second UI system.
