## 1. Contract Tests and Pure Flow Foundations

- [x] 1.1 Add `src/logic/age.test.ts` fixtures for ordinary birthdays, birthday-today/birthday-tomorrow boundaries, invalid dates, supported ages 15-99, local-calendar behavior, and the March 1 non-leap anniversary rule for February 29.
- [x] 1.2 Implement `src/logic/age.ts` as calendar-only validation and age calculation with no UTC conversion, persistence, or inferred birth date; resolve the three-argument form through the explicit local-calendar adapter.
- [x] 1.3 Add tests for a generic confirmable-value state covering fresh anchors, explicit acceptance, scroll adjustment, typed and extracted origins, saved-value precedence, cancellation, and no submission while an anchor is unconfirmed.
- [x] 1.4 Implement the confirmable-value helper and named neutral anchors: height 170 cm, weight 70 kg, body fat 23%/28% after confirmed formula sex and 25% when unavailable.
- [x] 1.5 Add unit tests for a total measured-intake stage reducer covering onboarding/Settings origin, DEXA/InBody source-specific paths, scan/manual choice, missing extracted fields, back-state preservation, cancellation, and exhaustive transition handling.
- [x] 1.6 Implement the pure measured-intake reducer and keep report candidates separate from confirmed input values and persisted models.
- [x] 1.7 Add copy-contract tests that reject wholly-on-device extraction claims and unsourced `ideal`, `healthy`, `athletic`, or `average` body labels, while requiring the manual path, provider boundary, later key reuse, and qualified third-party terms.

## 2. Database Readiness and Startup Recovery

- [x] 2.1 Add database lifecycle tests for concurrent open calls, delayed opening beyond three seconds, opening rejection, partial migration/seed failure, a new reject-then-success Retry attempt, and publication of `ready` only after the full attempt succeeds.
- [x] 2.2 Repair `src/db/index.ts` so the shared opening promise is cleared in `finally`, a partial handle is never exposed after migration/seed failure, and concurrent callers still share one attempt.
- [x] 2.3 Add `src/db/readiness.ts` with subscribed `opening | ready | unavailable` state, attempt identity, idempotent initialise, and explicit Retry behavior; add focused state tests.
- [x] 2.4 Add a themed, accessible storage-opening/recovery surface with durable Retry feedback and tests for opening, unavailable, and retry-pending states.
- [x] 2.5 Update `app/_layout.tsx` to remove timeout-as-success, publish readiness only after database open, key seeding, and profile load, and keep DB-backed navigation unmounted until ready.
- [x] 2.6 Add route-guard tests proving `app/onboarding/energy.tsx` performs no measurement query or save before readiness and does not surface “Database used before it was opened.”
- [x] 2.7 Integrate the shared readiness state into `app/onboarding/energy.tsx`, guarding both measurement-seeding effects and the final save as defence in depth.

## 3. API-Key Intent and Guidance

- [x] 3.1 Add store tests for the bounded `default-onboarding | energy-onboarding | energy-settings` API-key return intent, exhaustive source handling, one-time consumption, reset, invalid-value fallback, and preservation of compatible scan/manual drafts.
- [x] 3.2 Extend `src/store/onboardingStore.ts` with the transient return intent and measured-flow origin; keep API keys, routes, report URIs, and full birthdays out of persisted profile data.
- [x] 3.3 Extract and test a key-readiness controller with `checking | present | missing | unavailable`, including secure-store rejection, Retry, and the guarantee that manual entry remains available in every non-present state.
- [x] 3.4 Update `app/onboarding/api-key.tsx` to resolve and consume the bounded intent after save, skip, cancel, and back, while preserving the existing dietary destination for ordinary onboarding.
- [x] 3.5 Add the no-key explainer to measured intake with the two required actions, the direct-to-provider boundary, later photo-meal reuse, and a qualified Gemini recommendation without hiding Anthropic/OpenAI.
- [x] 3.6 Keep camera/library actions behind key readiness, repeat consent beside “Read this report,” and add behavior tests proving key check, photo selection, preview, and manual entry make no provider call.
- [x] 3.7 Update invalid-key and key-storage failure recovery to preserve the selected report and confirmed values while offering repair, meaningful Retry, and immediate manual entry.

## 4. Shared Accessible Input Controls

- [x] 4.1 Install the Expo SDK 54-compatible `@react-native-community/datetimepicker` version with `npx expo install`, record the resolved version, and run `npx expo-doctor` before using it.
- [x] 4.2 Build a `BirthdayPicker` adapter with year/month/day ergonomics, min/max dates derived from `AGE_RANGE`, explicit confirm/cancel, screen-reader labels, dynamic text support, and component-level state tests.
- [x] 4.3 Build `MeasurementPicker` with a canonical metric value, snapped scrolling, explicit anchor confirmation, increment/decrement accessibility actions, direct decimal entry, unit conversion, and reduced-motion behavior.
- [x] 4.4 Add measurement-picker tests for metric/imperial parity, repeated unit switches without drift, range boundaries, direct-entry decimals, unconfirmed anchors, saved/extracted seeds, and no silent clamping.
- [x] 4.5 Build `FormulaSexControl` with no initial selection and copy that identifies the Mifflin-St Jeor formula input without presenting it as gender identity.
- [x] 4.6 Build `FieldGuidance` using theme tokens and structured purpose/range/vocabulary copy; add tests that each supported field has guidance and no forbidden evaluative language.
- [x] 4.7 Verify all shared controls at maximum supported text size, with screen-reader focus/actions, keyboard/direct entry, reduced motion, no haptics, and touch targets from the existing accessibility contract.

## 5. Estimated Onboarding Ergonomics

- [x] 5.1 Replace the control in `app/onboarding/sex.tsx` with `FormulaSexControl` while preserving the route, required answer, draft field, and next destination.
- [x] 5.2 Replace free-text age entry in `app/onboarding/age.tsx` with `BirthdayPicker`, storing only the computed integer age and clearing the calendar tuple after confirmation/unmount.
- [x] 5.3 Replace height text entry in `app/onboarding/height.tsx` with the shared measurement control, using `HEIGHT_RANGE_CM`, the unconfirmed 170 cm anchor, and the existing unit preference.
- [x] 5.4 Replace weight text entry in `app/onboarding/weight.tsx` with the shared measurement control, using `WEIGHT_RANGE_KG`, the unconfirmed 70 kg anchor, decimal entry, and the existing unit preference.
- [x] 5.5 Add estimated-path integration tests proving route order, tap/step count, calculation inputs, target output, back-state restoration, no scan questions, and no persisted full birthday remain unchanged.
- [x] 5.6 Reuse matching controls and validation in `src/components/settings/ProfileSheet.tsx` without reconstructing a birth date from stored age or changing existing values before Save.

## 6. Progressive DEXA and InBody Intake

- [x] 6.1 Refactor `app/onboarding/energy.tsx` into the tested stage reducer plus focused child stages while retaining the current resolver, warnings, persistence functions, transient scan draft, and explicit final save boundary.
- [x] 6.2 Implement the DEXA manual sequence for measurement date, weight, and the explicit body-fat versus lean-tissue-plus-BMC path; exclude every unused estimated/InBody field.
- [x] 6.3 Implement DEXA body-fat adjustment with the documented unconfirmed anchor, 3-60 quick range, precise decimal entry, neutral helper copy, and existing warn-without-clamp handling for typed outliers.
- [x] 6.4 Implement the InBody manual sequence for measurement date, weight, printed Fat Free Mass, and the existing optional printed-BMR choice; exclude formula sex, age, height, body fat, and DEXA fields.
- [x] 6.5 Adapt scan review so report evidence, provider mismatch, confidence, issues, and candidates appear first, then each unconfirmed or missing required field is reviewed progressively.
- [x] 6.6 Add an editable summary stage that shows only source-relevant confirmed inputs, routes edits back to the focused field, and performs no profile/measurement/target write before final Save.
- [x] 6.7 Add DEXA integration tests for manual-only completion, partial/full extraction, either valid derivation path, source mismatch, outlier confirmation, cancellation, and failed-save rollback.
- [x] 6.8 Add InBody integration tests for manual-only completion, partial/full extraction, Fat Free Mass vocabulary, optional printed BMR mapping to the existing stated-resting path, cancellation, and failed-save rollback.

## 7. First-Run and Settings Parity

- [x] 7.1 Update the welcome DEXA/InBody entrances to set the measured-flow onboarding origin without adding any screen or tap to the visually primary estimated path.
- [x] 7.2 Update the Settings source chooser to set Settings origin, await DB readiness, and enter the same measured reducer rather than a duplicated editor.
- [x] 7.3 Add Settings tests proving saved provider values seed controls instead of anchors, cancel writes nothing, successful save returns to Settings, and DEXA/InBody records survive source switching.
- [x] 7.4 Add navigation tests proving key save/cancel/back returns to the initiating first-run or Settings flow once, and absent/stale intents use the safe ordinary-onboarding fallback.
- [x] 7.5 Verify onboarding reset and successful measured save clear transient flow/key intent/report state while leaving the other provider's persisted measurement untouched.

## 8. Privacy, Copy, and Regression Verification

- [x] 8.1 Centralise provider-guidance source metadata and audit the release copy against current Gemini getting-started, pricing, and data-use terms; keep setup time and free-tier wording qualified and linkable.
- [x] 8.2 Add privacy regression tests proving API keys remain confined to `src/api/keyStore.ts` and no full birthday, unconfirmed anchor, raw provider response, confidence, issue, report URI, or partial measurement enters SQLite, export, analytics, or logs.
- [x] 8.3 Run the copy audit across onboarding and Settings for direct-to-provider disclosure, manual availability, formula-only sex framing, source vocabulary, and forbidden diagnostic/evaluative body language.
- [x] 8.4 Run `npm run typecheck`, `npm test`, `npx expo-doctor`, `npx openspec validate improve-onboarding-ux-and-api-guidance --strict`, and `git diff --check`; record exact pass/fail counts and unrelated pre-existing failures.
- [ ] 8.5 On Android and iOS where available, verify slow DB startup, failed-open Retry, no-key manual completion, Gemini and non-Gemini key detours, camera/library consent, interrupted extraction, birthday picker, unit switching, DEXA/InBody completion, and Settings cancellation.
- [ ] 8.6 With TalkBack/VoiceOver and reduced motion, verify focus order, picker values/actions, confirmation state, dynamic text, error recovery, and completion without colour, animation, or haptic cues.
- [ ] 8.7 Recheck that no migration or persisted model change was introduced, update the numbered product-decision ledger with the accepted UX/readiness decisions, and mark only evidence-backed OpenSpec tasks complete.

### Verification record — 2026-08-21

- `npm run typecheck`: passed, 0 TypeScript errors.
- `npm test`: passed, 131 files and 1,281 tests; Vite emitted its existing future native-config-loader warning and Node emitted experimental SQLite warnings.
- `npx expo-doctor`: passed, 18/18 checks after Expo-aligned patch updates.
- `npx openspec validate improve-onboarding-ux-and-api-guidance --strict`: passed.
- `git diff --check`: passed with no whitespace errors.
