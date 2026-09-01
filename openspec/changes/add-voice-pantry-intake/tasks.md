## 1. Research and decision gates

- [x] 1.1 Inventory Android and iOS speech-recognition options compatible with
      Expo SDK 54; record on-device/offline behavior, supported languages,
      permission/config-plugin needs, development-build limits, artifact impact,
      licensing, and provider retention contracts.
- [x] 1.2 Decide transcription modes and explicit consent copy. Prove a photo or
      vision-provider key does not silently authorize audio upload or a second
      text-resolution request.
- [x] 1.3 Resolve unknown acquisition-date semantics and loose-item
      materialization with the pantry/receipt/manual domains. If schema changes
      are required, specify one new forward-only migration appended to
      `MIGRATIONS` and extend Delete all data.
- [x] 1.4 Build an anonymized local fixture corpus covering the example utterance,
      filler, self-correction, noise, accents, code-switching, original-script
      ingredients, locale decimals, container counts, per-container amounts,
      approximate quantities, location changes, and no-food speech.

## 2. Source-neutral intake contract

- [x] 2.1 Define `PantryIntakeProposal`, per-field evidence/confidence,
      transcription mode, review reasons, stable draft ids, and nullable unknowns
      in `src/types.ts`, with no required photo URI.
- [x] 2.2 Generalize proposal planning from `src/logic/captureItems.ts` so photo,
      manual, and voice candidates can reuse canonical matching, location
      proposals, and expiry eligibility without changing existing behavior.
- [x] 2.3 Add `voice` reference provenance to the resolver and alias path. Preserve
      original-script input and keep transcription confidence separate from
      canonical-match confidence.
- [x] 2.4 Add contract tests proving unknown or approximate evidence is preserved,
      source-specific evidence is not fabricated, and existing image intake
      remains compatible.

## 3. Deterministic transcript parsing

- [x] 3.1 Implement pure segmentation for ingredient phrases, filler, conjunctions,
      pauses, and explicit self-correction. No network or microphone dependency.
- [x] 3.2 Parse physical-container count separately from per-container amount and
      unit, covering packs, cartons, cans/tins, bags, bottles, bunches, heads,
      pieces, fractions, and “left” language.
- [x] 3.3 Parse session-location inheritance and spoken location changes without
      overriding user-defined location ids by display-name guesswork.
- [x] 3.4 Add locale-aware decimal/unit normalization that preserves the original
      phrase and never converts approximate speech into exact precision.
- [x] 3.5 Run the fixture corpus with no provider and record candidate recall,
      false ingredients, correction handling, amount accuracy, and review-needed
      rates.

## 4. Review and pantry mutation boundary

- [x] 4.1 Build a source-neutral compact batch-review model with clear and
      **Needs a look** groups, edit/change-location/resolve/skip actions, and
      unknown quantity as a valid non-blocking state.
- [x] 4.2 Reuse the existing canonical confirmation and picker for ambiguous or
      unresolved identity; never silently create a canonical item.
- [x] 4.3 Implement an exclusive-transaction batch writer that materializes the
      accepted physical items, records voice/user-confirmed provenance, returns
      created ids, and performs no partial commit.
- [x] 4.4 Add stable idempotency so repeated confirmation cannot duplicate a batch,
      plus bounded Undo that deletes only the created batch and refreshes pantry
      and downstream suggestions once.
- [x] 4.5 Test cancel, partial selection, unresolved identity, duplicate existing
      stock, mixed locations, transaction failure, retry, repeated confirmation,
      Undo, and downstream invalidation.

## 5. Microphone and transcription lifecycle

- [x] 5.1 Implement an explicit microphone state machine: idle, requesting
      permission, listening, paused, finishing, transcribing, ready, interrupted,
      failed, and cancelled.
- [x] 5.2 Add the chosen on-device transcription adapter behind a platform-neutral
      interface, with selectable recognition language and no network call in
      local-only mode.
- [x] 5.3 If approved by task 1.2, add a separately capability-gated cloud adapter
      with per-session provider/payload disclosure, explicit consent, retry, and
      raw-audio deletion.
- [x] 5.4 Ensure calls, audio-route loss, app backgrounding, permission revocation,
      and microphone contention stop or pause capture and never resume
      automatically.
- [x] 5.5 Prove raw audio is removed after success, cancel, and terminal failure;
      do not reuse `pending_captures`. If transcript recovery ships, persist only
      the disclosed local draft and expose Delete draft.

## 6. Pantry and optional first-inventory experience

- [x] 6.1 Add a labelled **Speak items** sibling action without altering the
      camera surface's automatic barcode/receipt/item routing; keep manual entry
      reachable.
- [x] 6.2 Add the session location, Start/Pause/Resume/Finish/Cancel controls,
      live editable transcript, elapsed time, language selector, and Type instead
      path using existing design tokens.
- [x] 6.3 Add the compact review with exact final mutation copy, success summary,
      skipped/unresolved phrases, Undo, and optional route to the existing dinner
      decision after confirmed stock refresh.
- [x] 6.4 Add an optional post-onboarding/empty-Pantry invitation to perform a
      first inventory by voice. Skip must be immediate and must not affect access
      to calorie tracking, meal prep, or Pantry.
- [x] 6.5 Add plain recovery states for permission denied, microphone unavailable,
      no speech, heavy noise, unsupported/offline speech service, missing key,
      provider timeout, local resolution failure, and interrupted draft.

## 7. Accessibility, privacy, and verification

- [x] 7.1 Add screen-reader announcements for state transitions and batch summary;
      keep the waveform decorative and prevent live transcript announcement spam.
- [x] 7.2 Verify 48dp Android / 44pt iOS targets, 200% font/display scaling,
      largest iOS accessibility text, keyboard/safe-area reachability, external
      keyboard, Voice Control, Switch Control, TalkBack, and VoiceOver.
- [x] 7.3 Add no-network tests proving local-only transcription and local alias
      resolution make no provider calls. Separately test explicit cloud consent,
      payload minimization, and refusal/cancel behavior.
- [x] 7.4 Run typecheck, focused tests, full test suite, strict OpenSpec validation,
      and `git diff --check`.
- [ ] 7.5 **Owner only — needs a device.** Owner-test real Android and iOS sessions in a quiet kitchen, noisy
      kitchen, mixed-language speech, permission denial, call interruption,
      backgrounding, offline transition, provider failure, process restart,
      duplicate stock, unknown quantity, and Undo.
- [ ] 7.6 **Owner only — needs a device.** Record median time-to-reviewed-inventory, correction count, unresolved
      rate, and completion rate for voice versus camera/manual first inventory
      using consented owner testing or local-only study instrumentation; do not
      introduce silent telemetry.
- [x] 7.7 Update `docs/product-decisions.md`, the implementation queue, and the
      current handoff with the selected transcription architecture, measured
      results, unresolved platform evidence, and exact release boundary.


> Tasks 7.5 and 7.6 need a physical device and a real kitchen; they cannot be
> completed from a workstation. Their checks are written out in
> `docs/owner-app-test-checklist.md` under "Voice pantry intake".

## 8. Correct the speech architecture contract

- [x] 8.1 Supersede product decisions 186 and 189 through 192 with the
      owner-approved distinction between phone speech, Offline only,
      transcript-only AI parsing, remembered/revocable consent, and runtime-
      proven model readiness. Remove every Samsung-specific guarantee from docs
      and user copy.
- [x] 8.2 Define diagnostic event/result types for recognition mode, service
      discovery, native error, model readiness, parser path, provider/model, app
      version, and source revision. Add redaction tests proving transcript,
      audio, API keys, pantry data, and raw provider responses cannot enter them.
- [x] 8.3 Add a persisted speech-preference contract using
      `expo-sqlite/kv-store` for phone-speech disclosure, Offline-only choice,
      transcript-parsing consent, and preferred compatible model. Test invalid,
      missing, revoked, and Delete-all-data states without network or a key.

## 9. Repair Android recognition modes

- [x] 9.1 Split Android system-default recognition from guaranteed-offline
      recognition. The default path must omit an explicit service package and
      must not claim a vendor; Offline only must use Android's on-device API.
- [x] 9.2 Add Android's official offline-language availability and installation
      flow for the visible selected locale, including installed, dialog opened,
      completed, cancelled, unsupported, and recheck states.
- [x] 9.3 Preserve safe partial text on native failure and offer explicit Retry,
      Offline model, Keyboard microphone, and Type choices without switching an
      active session automatically.
- [x] 9.4 Add adapter tests against the installed native module's real precedence:
      system default, on-device, explicit-package non-guarantee, permission,
      language missing, start error, partial result, stop, cancel, and late event.

## 10. Make local-model state truthful and durable

- [x] 10.1 Replace registry-dependent installed checks with local downloaded-
      manifest enumeration, ready-marker/path validation, and an app-model to
      real-registry-id binding. Prove startup discovery works in airplane mode.
- [x] 10.2 Add post-download checksum/file, model detection, and bounded STT
      initialize/destroy validation. Map failure to Resume, Repair, Delete,
      incompatible-device, or alternative-engine recovery rather than Ready.
- [x] 10.3 Configure persistent Android background downloads with a visible
      notification and restore Pause, Resume, Cancel, progress, download,
      extraction, and validation state after backgrounding, screen lock, and
      process restart.
- [x] 10.4 Reconcile valid, partial, corrupt, and legacy installs on open without
      silently redownloading. Persist a compatible user-selected Parakeet or
      SenseVoice model and never download or switch one automatically.
- [x] 10.5 Add deterministic model-store and local-adapter tests for fresh
      download, stale/absent registry, completed offline discovery, interrupted
      transfer/extraction, runtime incompatibility, restart, removal, and both
      Parakeet and SenseVoice initialization option shapes.

## 11. Add consented transcript-only AI parsing

- [x] 11.1 Define one provider-neutral structured response schema with exact
      source spans and nullable evidence fields. Build a validator that rejects
      prompt injection, invented items, unsupported numbers/quantities/locations,
      dates, canonicals, aliases, and stock mutation instructions.
- [x] 11.2 Add a provider-neutral voice-intake prompt and defensive response
      parser for OpenAI, Anthropic, and Gemini through the existing selected
      provider/model transport. Send only transcript JSON, locale, visible
      location ids/names, and schema; apply the shared single rate-limit retry
      and an eight-second foreground timeout.
- [x] 11.3 Add the one-time, remembered, revocable **AI transcript parsing**
      disclosure and Settings control. Name the selected provider and say
      transcript only, never audio; a configured photo key alone must not opt in.
- [x] 11.4 Make Finish start one logical AI parse when eligible, validate its
      candidates, and use the deterministic parser for rejected/unused spans.
      No key, refusal, offline state, timeout, unavailable model, auth failure,
      malformed output, or provider failure must preserve the transcript and
      fall back locally with truthful status copy.
- [x] 11.5 Bind parsing to a transcript hash plus provider/model identity. Abort
      or discard stale work after edit, provider/model change, navigation, or
      Cancel; disable duplicate Finish; require explicit **Parse corrected
      transcript** before an edited draft spends another request.
- [x] 11.6 Add provider-contract tests for valid, partial, hallucinated,
      prompt-injected, malformed, rate-limited, timed-out, cancelled, and stale
      responses across all three providers, plus local fallback and mixed
      provider/local span reconciliation.

## 12. Rebuild recovery, diagnostics, and deletion surfaces

- [x] 12.1 Update voice intake to show the proven active mode—Phone speech,
      Android offline, Parakeet, SenseVoice, Keyboard, or Type—plus explicit
      processing/fallback state. Never label an unverified vendor.
- [x] 12.2 Update model controls to show durable Downloading, Paused, Extracting,
      Validating, Ready, Resume, Repair, Incompatible, and Delete states with
      persisted user selection and no disappearing failure.
- [x] 12.3 Add the Settings **Speech diagnostics** surface and explicit Copy
      report action, including source commit and failed boundary while applying
      the redaction contract and bounded local retention.
- [x] 12.4 Extend Delete all data to remove models, partial archives, extraction
      state, speech/model/consent preferences, recoverable drafts, diagnostics,
      raw provider responses, and pending parse state while preserving the
      existing credential-deletion contract.
- [ ] 12.5 Verify TalkBack, 200% scaling, long provider/model/error names,
      background-download notification controls, consent revocation, error
      announcements, and reachable keyboard/type fallback on Android.

## 13. Prove the committed Samsung pipeline before release

- [x] 13.1 Run typecheck, focused speech/model/provider tests, the full test
      suite, Expo config/prebuild checks, strict OpenSpec validation, and
      `git diff --check`. Record static/provider-contract proof separately from
      device and live-provider proof.
- [x] 13.2 With the owner's configured provider and zero-copy credential flow,
      prove one live transcript-only parse reaches validated candidates and
      Pantry review. Record the provider/model and outcome without logging the
      key, transcript, or pantry content; leave other providers labelled static
      until live-tested.
- [x] 13.3 Commit the exact intended repair before building, embed/display the
      source hash, build the APK from that commit, verify archive/signature/ABI
      and checksum, and name the prerelease/asset from the same hash. Do not
      publish a working-tree-only binary as reproducible.
- [ ] 13.4 **Owner plus agent — physical Samsung required.** Prove system-default
      speech to editable transcript, Android offline-language install/recheck,
      SenseVoice and Parakeet download/restart/initialize/transcribe, airplane-
      mode local parsing, AI parsing and local fallback, edit/reparse, review,
      atomic Pantry confirmation, Undo, interruption, and redacted diagnostics.
      Do not call the prerelease fixed until this matrix passes.
