## Why

Mise's welcome screen currently joins a strong product promise to dense,
disconnected setup copy, while people with DEXA or InBody reports must manually
transcribe unfamiliar fields. The onboarding entrance should explain the value
of an energy target in Mise's calm, practical voice, and scan owners should be
able to import a report, review what was read, and correct it before anything is
saved.

## What Changes

- Rewrite and regroup the first-run welcome content around one clear outcome:
  set a useful daily energy target so meal tracking has context. Keep the
  existing estimated path visually primary and preserve its routes, questions,
  tap count, calculations, and resulting profile.
- Add photo and document-image intake to the existing DEXA and InBody entrances
  in onboarding and to the corresponding energy-source editor reached from
  Settings. Manual entry remains available before, during, and after a failed
  extraction.
- Add one provider-neutral, multimodal extraction contract for DEXA and InBody
  reports. It returns candidate values for `provider`, `weightKg`,
  `bodyFatPct`, `leanTissueKg`, `boneMineralContentKg`, `fatFreeMassKg`,
  `bmrKcal`, and `confidence`; unknown or unreadable values remain absent.
- Normalise imperial report values to kilograms, reject non-finite output, and
  flag physiologically implausible candidates for review without silently
  clamping them or treating the model as an authority.
- Present the report image, detected provider, confidence, and editable fields
  in a human-in-the-loop review state. No extracted value changes a profile,
  measurement, target source, or calorie target until the user explicitly
  confirms it.
- Reuse the `add-energy-sources` `TargetSource`, `BodyMeasurement`, derivation,
  persistence, switching, and warning contracts. Extraction is a temporary
  input aid, not a second body-composition data model.

This change affects decisions 5 and 166-175. It preserves decisions 166-171
and 173-175. It deliberately narrows decision 172's "regular onboarding does
not change" invariant to its intended behavioural guarantees: no extra screen,
question, tap, or calculation on the estimated path. The welcome copy and
information hierarchy change explicitly; the path does not.

## Capabilities

### New Capabilities

- `onboarding-intake`: Cohesive first-run energy-target introduction and
  review-first DEXA/InBody report-image extraction available from onboarding
  and later Settings updates.

### Modified Capabilities

None. `energy-sources` is still an active change rather than a main spec. This
change depends on and extends its contract without adding another persisted
source or measurement shape.

## Non-goals

- Replacing or lengthening the estimated onboarding path.
- Adding a fifth target source, a second measurement table, scan history, or a
  persisted extraction-response record.
- Saving the report image as health history or including it in export. The
  selected URI is transient review state and is cleared on confirm, cancel, or
  reset according to the existing media lifecycle.
- Diagnosing, scoring, ranking, or evaluating a person's body, health, fitness,
  progress, or scan quality.
- Extracting or displaying visceral fat, segmental analysis, skeletal muscle
  mass, metabolic age, InBody score, or any field that cannot feed the existing
  energy-source workflow.
- Automatically accepting a provider, measurement, BMR, scan date, or calorie
  target without review.
- Supporting PDFs as a new binary document pipeline. The picker accepts images
  and image representations already supported by the app; broader document
  conversion is a later capability.
- Changing API-key storage, adding a Mise server/account, or bypassing the
  user's selected Anthropic, Gemini, or OpenAI provider.

## Impact

- **OpenSpec dependency:** implementation starts only after the
  `add-energy-sources` model and behavioural contract are present. Its
  `TargetSource`, `BodyMeasurement`, provider-specific derivations,
  non-destructive switching, and warning behaviour remain authoritative.
- **API:** new prompt/response parsing and extraction modules under `src/api/`;
  dispatch goes through the existing provider-neutral vision facade and
  `VisionError` taxonomy. The requested `src/api/transport.ts` name does not
  exist in the current tree, so implementation must extend or extract the
  existing `src/api/vision.ts` transport contract rather than create a parallel
  facade.
- **Logic:** a pure body-composition extraction parser handles sanitation,
  unit conversion, nullable fields, and review warnings. It does not replace
  `src/logic/bodyComposition.ts`, which remains the calculation authority.
- **State and UI:** `src/store/onboardingStore.ts`,
  `app/onboarding/welcome.tsx`, `app/onboarding/energy.tsx`, and the existing
  Settings entry point gain transient scan/review flow. Shared components and
  semantic tokens remain the visual authority.
- **Persistence:** no migration and no new database model. Confirmed values are
  mapped into the existing per-provider `BodyMeasurement` or, when the user
  explicitly chooses an InBody printed BMR, the existing stated-resting path.
- **Privacy:** the selected image is sent only to the provider associated with
  the user's API key after an explicit action. Copy must state that boundary;
  it must not imply the report stays entirely on-device.
- **Dependencies:** no new runtime package is expected; reuse
  `expo-image-picker`, existing photo encoding, Zustand, and the vision
  transports.
