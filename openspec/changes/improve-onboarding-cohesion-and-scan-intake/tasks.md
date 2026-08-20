## 1. Dependency and Behaviour Baseline

- [ ] 1.1 Re-read the live `add-energy-sources` proposal, design, spec, tasks, types, persistence, calculation, onboarding, and Settings code before editing; record any drift from this design.
- [ ] 1.2 Run the focused `add-energy-sources` tests and preserve evidence that DEXA derivation, InBody Fat Free Mass handling, stated-resting BMR, warnings, and non-destructive switching pass before this change.
- [ ] 1.3 Snapshot the estimated onboarding route order, questions, required taps, calculation, and resulting profile so welcome-copy changes cannot alter its behaviour.
- [ ] 1.4 Confirm `src/api/transport.ts` is still absent and `src/api/vision.ts` remains the single provider map before performing the facade extraction.
- [ ] 1.5 Confirm this change needs no schema migration, no new persisted target source, and no change to `BodyMeasurement`; add a regression assertion if any serializer/export path could retain transient scan data.

## 2. Prompt Contract and Defensive Response Parsing

- [x] 2.1 Create `src/api/bodyCompositionPrompt.ts` with the closed provider and confidence types plus nullable candidate fields for provider, weight, body fat, lean tissue, bone mineral content, Fat Free Mass, and BMR.
- [x] 2.2 Implement `buildBodyCompositionPrompt()` returning system and user prompts with one exact JSON schema, DEXA/InBody vocabulary, kilogram output, and explicit no-invention/no-derivation rules.
- [x] 2.3 In the prompt, forbid skeletal muscle mass substitution, provider inference from the selected route, missing-field arithmetic, scan-date invention, body evaluation, and output outside the declared keys.
- [x] 2.4 Implement `parseBodyCompositionResponse()` with optional code-fence removal, object-root validation, ignored unknown keys, `unknown` provider fallback, `low` confidence fallback, and `null` candidate fallbacks.
- [x] 2.5 Make empty, malformed, array, primitive, and non-object responses throw `VisionError('malformed', ...)` without echoing provider content.
- [x] 2.6 Add `src/api/bodyCompositionPrompt.test.ts` with realistic DEXA and InBody outputs, missing fields, unknown provider, invalid confidence, fenced JSON, unknown keys, numeric strings with units, and every malformed-root case.
- [x] 2.7 Add prompt-text assertions that the exact declared keys are present and that the no-invention, provider-vocabulary, unit, privacy, and non-evaluation constraints cannot regress.

## 3. Pure Body-Composition Normalisation

- [x] 3.1 Create `src/logic/bodyCompositionParser.ts` with pure raw-input, normalised-extraction, and field-specific issue types; keep it independent of network, media, storage, time, and React Native.
- [x] 3.2 Implement finite-number and numeric-string sanitation that maps missing, zero, negative, `NaN`, infinity, and unsupported units to `null` without clamping.
- [x] 3.3 Convert explicitly labelled `lb`, `lbs`, and `pound(s)` mass values to kilograms through the shared unit conversion; leave internal values unrounded.
- [x] 3.4 Add named automatic-prefill bounds for weight greater than 20 kg and body fat from 3 through 60 percent, returning review issues rather than repaired values.
- [x] 3.5 Add cross-field review issues for contradictory positive candidates, including Fat Free Mass materially exceeding weight, without deriving or mutating another field.
- [x] 3.6 Preserve manually entered outliers for the existing `energyInputWarnings` warn-never-clamp path; keep extraction eligibility separate from manual-confirmation validity.
- [x] 3.7 Add `src/logic/bodyCompositionParser.test.ts` with realistic metric and imperial DEXA/InBody responses, exact pound conversion, missing-data fallbacks, invalid units, non-finite values, 20 kg and 3/60 percent boundaries, and cross-field contradictions.
- [x] 3.8 Add regression tests proving the normaliser never derives Fat Free Mass, body fat, provider, BMR, or scan date from other candidates.

## 4. Single Provider Transport Facade

- [x] 4.1 Create `src/api/transport.ts` by extracting the existing provider-neutral `Transport`, exhaustive `TRANSPORTS`, retry helpers, API-key selection, and caller-supplied `completeVision` dispatch from `src/api/vision.ts`.
- [x] 4.2 Update `src/api/vision.ts` to consume and compatibility-re-export the extracted transport symbols without changing meal estimation, key verification, provider attribution, retry, timeout, or cancellation behaviour.
- [x] 4.3 Keep one exhaustive `Record<Provider, Transport>` and add a compile-time/test guard that a provider cannot be added without every required operation.
- [x] 4.4 Update existing receipt, recipe, barcode-recovery, or other caller imports only where needed to preserve a single facade; do not duplicate key detection or provider request logic.
- [x] 4.5 Run the existing transport, vision, receipt, recipe, rate-limit, and API-key tests after the extraction before adding body-composition calls.

## 5. URI-to-Extraction Engine

- [x] 5.1 Create `src/api/bodyComposition.ts` with `extractBodyComposition(photoUri: string, signal?: AbortSignal)` using `src/media/photos.ts`, the prompt builder, `completeVision`, response parser, and pure normaliser.
- [x] 5.2 Preserve provider attribution and every known `VisionError`; wrap unexpected unreadable-media or response failures as malformed without logging the URI, base64 payload, raw response, or API key.
- [x] 5.3 Thread `AbortSignal` from the public function through encoding/request boundaries where supported and ensure pre-aborted and in-flight cancellation return the shared cancelled error.
- [x] 5.4 Add mocked unit tests proving the engine sends the exact prompts through the selected facade, normalises the returned content, performs no request for an unreadable URI, and needs no live provider key.
- [x] 5.5 Add mocked error tests for no key, unknown key, unauthorized, billing, rate limit, server, network, timeout, malformed content, and cancellation, preserving provider metadata and recovery classification.

## 6. Transient Scan Draft State

- [x] 6.1 Extend `src/store/onboardingStore.ts` with a nullable, in-memory scan draft containing phase, photo URI, normalised candidates, confidence, and review issues only.
- [x] 6.2 Add actions for select/replace, extracting, review success, recoverable error kind, and clear; keep `AbortController`, `Error`, raw JSON, base64, API key, and timestamps out of the store.
- [x] 6.3 Clear the scan draft on successful save, explicit discard, full onboarding reset, and source change away from the reviewed provider; retain it on retryable failure and cancellation.
- [x] 6.4 Add store tests for every transition, replacement, reset, source mismatch, Settings re-entry, and proof that extracted candidates are never written to the profile by a store transition.

## 7. Cohesive Welcome Experience

- [x] 7.1 Update `app/onboarding/welcome.tsx` to keep the existing product promise and explain the daily target as useful context for logged meals in calm, practical language.

      `app/onboarding/welcome.tsx` keeps the product promise as the title and
      replaces the disconnected setup copy with what the step is actually for:
      a daily calorie and macro target, named as the figure the pantry, logged
      meals, and recipes are all measured against. Practical, one outcome, no
      claim about the person.
- [x] 7.2 Keep the estimated action primary, group DEXA/InBody/known-figure entrances quietly, and state the local-storage/provider-image boundary without AI labels, model names, fake precision, or health claims.

      The estimated path is the only primary action — "Let's do the basic
      setup", with "Calculate from age, sex, height, weight & activity" under
      it. The two alternatives sit under a quiet "Already have a figure?"
      label as secondary buttons: "Scan or upload body composition report"
      (DEXA or InBody scan) and "I already know my calorie target" (Enter an
      exact daily calorie goal or resting BMR). DEXA and InBody are one
      entrance now; the provider is chosen on the energy step, where the
      mismatch disclosure lives. The privacy line distinguishes the local
      diary from a report or photo explicitly sent to the person's own
      provider, and deliberately does not claim nothing ever leaves.
- [x] 7.3 Use existing `StepShell`, typography, buttons, semantic tokens, spacing, focus, and large-text behaviour; add no screen-local palette, spacing constants, decorative medical imagery, or card grid.

      `StepShell` throughout, with two shared additions rather than
      screen-local ones: `Button` gained an optional `detail` line (used for
      every label/subtitle pair here), and `layout.contentMaxWidth` was added
      as a token so `StepShell`'s header, body, and footer form one centred
      column instead of stretching a single line of copy across a desktop
      viewport. No screen-local palette, no spacing literals, no card grid,
      no medical imagery.
- [x] 7.4 Update onboarding tests only for the intentional copy/hierarchy change and assert that route order, questions, tap count, estimated calculation, and result remain identical.

      `test/brand-system.test.ts` was updated for the one intentional copy
      change — its local-versus-provider assertion now matches the new
      sentence and its intent is unchanged. `test/onboarding-intake-ui.test.ts`
      asserts the route order, the estimated entry route, the unchanged
      `energyTargets` result, and that the primary action still enters that
      route in one tap with no routing screen inserted.
- [x] 7.5 Add a copy regression test covering forbidden assessment/AI-buzzword/health-promise language in the welcome and scan flow.

## 8. DEXA/InBody Image Selection and Review


      Same file: a `test.each` over 23 forbidden terms — AI buzzwords
      (artificial intelligence, machine learning, neural, model names),
      health promises (guarantee, accurate, precise, healthy), and evaluation
      language (diagnos, assess, score, rank, judge, fitness, progress) —
      across both the welcome and the scan flow.
- [x] 8.1 Add image-library and supported camera intake to the DEXA/InBody branch of `app/onboarding/energy.tsx` while leaving stated and manual entry available.

      Library and camera intake through `expo-image-picker` on the DEXA and
      InBody branch. Stated and manual entry are untouched, and every field
      remains typeable whether or not a report was ever selected.
- [x] 8.2 Make selection preview-only: show the unaltered evidence thumbnail and precise transmission copy, and do not call a provider until the person taps Analyse.

      Selection calls `selectScanPhoto` only. The picked URI is previewed
      unaltered (`resizeMode="contain"`, no tint, no blur) with the exact
      transmission sentence, and nothing is sent until "Read this report" is
      tapped. A test asserts a single `extractBodyComposition` call site and
      that it sits behind that button.
- [x] 8.3 Implement idle/manual, selected, extracting, review, and error states with one local `AbortController`, labelled busy semantics, reduced-motion treatment, and shared `VisionError` recovery copy.

      Idle/manual, selected, extracting, review, and error states, one local
      `AbortController` in a ref, `ProcessingIndicator` for the labelled busy
      state (it carries the reduced-motion treatment and assistive semantics
      already), and `copyForError` from the shared vision facade for recovery
      classification.
- [x] 8.4 Pre-populate only source-relevant, eligible candidates; show detected provider, confidence, issues, and editable fields without changing persisted profile or measurement state.

      `prefillFrom` writes only the fields the chosen source uses, and only
      from candidates the normaliser returned non-null — an out-of-bounds or
      contradictory value arrives as null with an issue, and is left to be
      typed. Detected provider, confidence note, and every issue are shown.
      A test asserts the prefill touches no persistence call.
- [x] 8.5 Disclose DEXA/InBody provider mismatch and require an explicit keep-or-switch choice; never switch `targetSource` from model output alone.

      A DEXA/InBody mismatch is stated plainly with an explicit "Switch to X"
      button and a "keep X and edit below" alternative. A test pins the single
      `setDraft({ targetSource` call site so model output cannot switch the
      source on its own.
- [x] 8.6 Add an editable measurement-date field to scan and manual measured review; do not infer a report date and do not silently use the analysis time as the measurement date.

      An editable `Date of measurement` field with a `YYYY-MM-DD` format
      check. Manual entry pre-fills today, which the person confirms;
      `prefillFrom` deliberately blanks it after a scan, and a test asserts
      that path never calls `localDateString()` — the analysis happened today,
      the scan did not.
- [x] 8.7 Preserve the existing DEXA alternatives: weight plus body-fat percentage, or weight plus lean tissue and bone mineral content; derive Fat Free Mass only through existing confirmed-domain logic.

      Unchanged: the same `dexaFatFreeMass` call over weight plus body-fat
      percentage, or weight plus lean tissue and bone mineral content. Fat
      Free Mass is still derived only there.
- [x] 8.8 Preserve the existing InBody path: weight plus printed Fat Free Mass; keep printed BMR optional and require an explicit choice before mapping it to the stated-resting path.

      Unchanged: weight plus printed Fat Free Mass. The printed BMR stays
      optional and now requires an explicit "Use the printed BMR instead"
      choice before it maps to the stated-resting path — previously any
      parseable BMR silently took over.
- [x] 8.9 Keep manual values, image, and draft available after permission denial, cancellation, malformed response, and retryable provider failures; provide Replace, Retry, Enter manually, or key-settings actions as appropriate.

      A picker failure sets a message and leaves manual entry available.
      Cancellation and every retryable failure keep the image and the fields;
      the error state offers Try again (or Add an API key, per the shared
      recovery classification), Choose a different photo, and Type it in
      instead.
- [x] 8.10 Disable confirmation until the chosen existing source has its required reviewed fields and date, while allowing manually confirmed outliers to proceed with existing warnings.

      `primaryDisabled={!valid}`, where `valid` requires the source's own
      required fields *and* a parseable date. Manually typed outliers still
      pass through to `energyInputWarnings` rather than being blocked.
- [x] 8.11 On confirmation, call only the existing `saveBodyMeasurement`/profile update/target resolver path, replace only the chosen provider, discard unused candidates, and clear transient extraction state after a successful write.

      Confirmation runs the pre-existing path only — `saveBodyMeasurement`,
      then `create`/`update` with `resolveTarget` — and calls
      `clearScanDraft()` after a successful write. Unused candidates are never
      persisted because only the confirmed field strings are read.
- [x] 8.12 On cancel/back, leave the saved profile, active source, target, and both provider measurements unchanged; cancel an in-flight request without discarding the selected image unless the person explicitly discards it.

## 9. Settings Reuse and Persistence Boundaries


      Nothing is written before the confirm action, so cancel and back leave
      the profile, active source, target, and both providers' measurements
      untouched. Cancelling analysis aborts the request and keeps the selected
      image; only "Type it in instead" discards it.
- [x] 9.1 Keep the existing Settings source chooser as the entry point and seed `app/onboarding/energy.tsx` with the selected source plus its current saved measurement.

      `app/(tabs)/settings.tsx` remains the entry point. The energy step now
      seeds weight, date, and the provider-specific fields from the saved
      `BodyMeasurement` for the selected source on first entry, and yields to
      a scan draft when one is already open.
- [x] 9.2 Verify a newly extracted draft never overwrites the seeded saved measurement until confirmation and that a cancelled Settings edit returns without writes.

      Seeding is read-only: a test asserts the seeding effect contains no
      `saveBodyMeasurement`, `update(`, or `create(` call, and the prefill
      path likewise. Leaving without confirming writes nothing.
- [x] 9.3 Verify saving from Settings replaces only the selected provider, recomputes through the existing resolver, retains the other provider, returns to Settings, and clears transient state.

      Save calls the existing per-provider `saveBodyMeasurement` and
      `resolveTarget`, then `router.back()` to Settings and clears the
      transient draft. The non-destructive per-provider replacement itself is
      still guaranteed by the `add-energy-sources` tests, which pass.
- [x] 9.4 Verify an explicitly chosen InBody BMR saves as a stated resting figure and does not add a BMR column/field to `BodyMeasurement` or the body-measurement table.

      An explicitly chosen InBody BMR sets `targetSource: 'stated'` with
      `statedFigureKind: 'resting'`. A test asserts `BodyMeasurement` has no
      BMR field at all, so there is nowhere for it to be stored as one.
- [x] 9.5 Verify raw responses, confidence, issue lists, thumbnails, and report URIs are absent from SQLite, JSON export, logs, and persisted Zustand state.

## 10. Automated Verification


      Tested: the onboarding store uses no `persist` middleware and holds no
      base64, API key, raw response, or `AbortController`; and neither
      `src/db/queries.ts` nor `src/logic/export.ts` references `scanDraft`,
      the extraction type, the parser, or the engine.
- [x] 10.1 Run the new prompt, parser, engine, store, onboarding, Settings, persistence-boundary, and copy-focused tests without network access or a real API key.

      Ran green with no network access and no API key: the prompt, parser,
      engine, store, onboarding, and copy tests all use mocks or source
      assertions.
- [x] 10.2 Run `npm run typecheck` and fix every error introduced by the transport extraction, new types, transient store state, and UI flow.

      `npm run typecheck` clean.
- [x] 10.3 Run the full Vitest suite and separate pre-existing/unrelated failures from failures introduced by this change.

      Full Vitest suite: 115 files, 1053 tests, all passing. One pre-existing
      test needed updating for the intentional welcome copy change (recorded
      under 7.4); no other failure appeared.
- [x] 10.4 Run `npx openspec validate improve-onboarding-cohesion-and-scan-intake --strict` and `git diff --check`.

      `npx openspec validate improve-onboarding-cohesion-and-scan-intake
      --strict` reports valid, and `git diff --check` is clean.
- [x] 10.5 Re-run the `add-energy-sources` focused tests and the estimated-onboarding behavioural snapshot after the full implementation.

## 11. Provider and Device Acceptance


      `energy-measurements`, `body-composition`, and `regular-onboarding` all
      pass unchanged after the UI work; the estimated route order and
      `energyTargets` result are asserted directly in
      `test/onboarding-intake-ui.test.ts`.
- [ ] 11.1 With an Anthropic key, analyse one realistic DEXA image and one realistic InBody image; verify provider vocabulary, nullable missing fields, review, correction, confirmation, and no automatic save.
- [ ] 11.2 Repeat the realistic DEXA/InBody image pass with Gemini and OpenAI, recording model/provider differences without weakening the shared parser or review boundary.
- [ ] 11.3 On iOS and Android, verify library/camera permissions, replace, cancel, retry, offline/network failure, no-key recovery, and returning from key Settings with the draft intact.
- [ ] 11.4 Verify first-run onboarding and later Settings updates with metric and imperial reports, low confidence, provider mismatch, missing fields, and a manually confirmed outlier.
- [ ] 11.5 Verify 320/375/414/768-equivalent phone/tablet widths where applicable, large text, VoiceOver/TalkBack, focus order, labelled busy state, reduced motion, and no obscured report evidence.
- [ ] 11.6 Verify report images, base64 payloads, raw responses, and confidence do not remain after successful save, explicit discard, reset, app relaunch, export, or log inspection.

## 12. Decision Record and Handoff

- [ ] 12.1 After owner acceptance, append the next numbered product decision recording review-before-save scan intake, the transient-only report boundary, and the narrow welcome-copy clarification to decision 172; do not mark it settled before approval.
- [ ] 12.2 Update `docs/current-implementation-handoff.md` and `docs/implementation-queue.md` with exact task progress, dependency on `add-energy-sources`, verification results, dirty-file scope, device/provider gaps, and restart steps.
- [ ] 12.3 Keep real-provider, device, accessibility, and owner-acceptance tasks open until their named evidence exists; do not archive this change from unit-test evidence alone.
