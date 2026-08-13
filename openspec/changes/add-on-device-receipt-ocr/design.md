## Context

Mise already has receipt capture, review, semantic extraction, identity resolution, and offline queueing. This change adds a local text-recognition seam before those existing stages. The base APK is intentionally kept small, and receipt data must remain local when local OCR is selected.

## Goals / Non-Goals

**Goals:** provide a platform-neutral OCR contract; dynamically install the smallest selected model at first use; support offline processing after installation; preserve structure/confidence for receipt parsing; keep fallback and review behavior intact; measure artifact and storage cost.

**Non-Goals:** semantic understanding in the OCR bridge, cloud OCR, automatic application, all-language model shipping, or replacing the existing resolver.

## Decisions

1. **Optional dynamic model over bundled model.** The base build stays small and users who never scan receipts pay no model cost. The download must be explicit, resumable, cancellable, and removable. A later measured build can choose bundled packaging for a specific distribution if first-use friction is worse than the size cost.

2. **Platform-native engines behind one TypeScript contract.** Android uses ML Kit Text Recognition and iOS uses Vision. The shared contract returns lines, order, geometry, confidence, engine, and model state; platform-specific installation and permissions stay native. A single cross-platform ML dependency was rejected because it adds size and reduces native integration quality.

3. **OCR is text evidence, not identity truth.** The existing parser and canonical resolver interpret text. OCR confidence is retained separately from match confidence so a crisp misspelling cannot be mistaken for a certain food identity.

4. **Preprocess locally and keep raw source references.** Crop/perspective/contrast/sharpen operations happen before OCR and produce a temporary derivative. The original frame remains available to the review path; no image leaves the device for local OCR.

5. **First-use prompt, not onboarding prompt.** Ask when the user has an actual receipt to read, with Settings as a proactive alternative. This avoids downloading a model for users who never use the capability.

6. **Start with Latin and measure before expanding scripts.** Language packs are a product decision based on real receipt fixtures and the target audience. Asian-script support is planned as additional packs, not silently inferred from a Latin-only model.

## Components and data flow

- Native bridge: model availability/download/remove, OCR invocation, and structured result mapping.
- `src/types.ts`: OCR model state, engine, line geometry, confidence, and local draft types.
- `src/logic/receiptOcr.ts`: pure ordering, confidence bands, preprocessing options, fallback decision, and model-state transitions.
- `src/logic/receiptService.ts`: invoke local OCR before semantic extraction when selected, then pass text evidence into the existing parser/review flow.
- Receipt capture/review and Settings: opt-in prompt, progress, retry/remove, and fallback messaging.
- Tests: parser fixtures, state machine, no-network boundary, model lifecycle, and artifact-size report.

## Risks / Trade-offs

- [Risk] Dynamic download fails on restricted networks or devices without Google services → retain manual/provider fallback and explicit unavailable state.
- [Risk] OCR recognizes text but loses columns or wrapped-line relationships → retain geometry and build a fixture corpus across stores before tuning grouping.
- [Risk] Native bridge increases maintenance across Android/iOS → keep the TypeScript contract narrow and test platform adapters with fakes.
- [Risk] Model download/storage surprises users → show size, use removable storage, and record only local state.
- [Risk] OCR confidence encourages overtrust → display uncertainty and keep semantic match confidence separate.

## Migration Plan

1. Add the shared types and pure fallback/state logic with no native dependency.
2. Add Android dynamic model lifecycle and OCR adapter, measure APK and installed model size.
3. Add iOS Vision adapter and shared receipt-service integration.
4. Add first-use prompt, Settings controls, review wiring, and offline/error states.
5. Run fixture and full automated tests, then owner-test Android/iOS offline, download, removal, and review flows.

## Open Questions

- Which initial script packs are required after the first receipt fixture corpus is measured?
- Should OCR run automatically when the model is installed, or remain an explicit “Improve reading” action until accuracy evidence supports automatic use?
