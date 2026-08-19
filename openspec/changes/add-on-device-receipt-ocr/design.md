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

## Existing pipeline inventory (task 1.1)

Read-only inventory of the receipt/unified-capture seams this change must slot
into, and how each connects to the cited product decisions. No behavior
described here changes as part of this section — it is the factual basis
tasks 2–3 build against.

**Capture entry points.** `app/pantry-capture.tsx` is the single "unified
capture" screen: one photo goes to `extractCapture()`
(`src/api/capture.ts`), which returns a discriminated `kind` —
`'items' | 'receipt' | 'unclear' | 'nothing'` — decided entirely by the
vision call itself, not by any local classifier. `kind === 'receipt'` routes
to `captureExtractedReceipt()` (`src/logic/receiptService.ts`) then
`/receipt-review`. `app/receipt-capture.tsx` is a focused, receipt-only
follow-up screen for adding/retaking individual frames of an
already-started multi-photo receipt (its own header comment: *"First
receipt photos always enter through the shared Add to pantry capture; this
focused handler exists because multi-frame receipts need a way back from
review without starting a new capture classification"*). **Local OCR has no
existing local classification step to hook before** — today classification
*is* the first vision call. Task 3.1/3.5's "opt-in first-use/recovery
pass" must therefore run OCR either before that classifying call (as a
receipt-likely heuristic) or after it (once `kind === 'receipt'` is
already known) — the latter matches today's flow shape more closely and is
the assumed integration point unless a fixture corpus (task 1.3) shows
pre-classification OCR is worth the added complexity.

**Extraction today.** Two call sites share one contract:
`extractCapture()` (unified, one request) and `extractReceipt()`
(`src/api/receipt.ts`, used for multi-frame add/retake and the
"unclear→Receipt" fallback) both resolve to `parseReceiptObject`, which
does OCR-equivalent text reading **and** semantic structuring
(quantity/price/kind classification) in a single cloud vision call. This
change's own Non-Goal ("semantic understanding in the OCR bridge") means
local OCR replaces only the *reading* half; the *structuring* half has no
existing local implementation to fall back to. **This is not a solved
question in this document** — design.md's own Open Questions ("should OCR
run automatically…") is exactly this gap: whether OCR text is fed back into
a (still cloud) semantic pass, used only to pre-fill/cross-check the
existing cloud result, or something else, is a task-3 design decision, not
assumed here.

**Review** (`app/receipt-review.tsx`) operates on `ReceiptWithLines` +
`ReceiptFrame[]` and offers edit/re-match/exclude/reclassify/retake/accept/
discard per line, regardless of how a line's text was originally read.
Local OCR does not need review changes beyond task 3.4's low-confidence
line surfacing — review already treats extraction as provisional evidence
subject to correction (decision-113-adjacent: `checkArithmetic()` reads
`lineTotalCents`/`subtotalCents` off the same `ReceiptLine` shape regardless
of extraction source, so OCR-sourced lines must still populate those fields
for the mismatch banner to keep working unchanged).

**Queueing / offline (decision 8).** Two queues exist, both keyed on
network/extraction failure, not on OCR: `pending_captures`
(`src/db/schema.ts`, general offline capture retry, `insertPendingCapture`
from `pantry-capture.tsx`'s catch block) and per-receipt-frame pending
state (`receipt_frames.status`, `recordReceiptFrameFailure`,
`retryAllPending()` on Pantry-tab focus). **Local OCR's whole value
proposition is bypassing this queue for the reading step** — an installed
model reads offline; decision 8's queue should now apply only to whatever
semantic step still needs network (see above), not to text recognition
itself. No schema change to these tables is anticipated; the model-state
machine (task 1.2) is a new, separate concept from capture/frame pending
status.

**Fallback.** Every existing fallback path (no key, "nothing usable",
"unclear", extraction throws, 3 failed retries) ends in either manual entry
or a retry — never a forced dead end. Local OCR adds one more fallback
tier ahead of these: model not installed/unavailable/failed → same cloud
extraction path as today, unchanged. This preserves proposal.md's "keep the
existing receipt vision/manual path available" requirement by construction:
OCR is additive in front of the existing chain, not a replacement of any
link in it.

**Application / reconciliation (decisions 21, 55, 111).** `acceptReceiptReview()`
→ `planReceiptApply()` (new items) and `reanchorFromReceipt()` (existing
items: *sets* `qty_remaining`/zeroes drift, never adds — decision 55) →
optionally `matchShoppingItemToReceipt()` for shopping-list reconciliation.
None of this reads how a `ReceiptLine` was produced; local OCR changes
nothing here as long as OCR-sourced lines land in the same `ReceiptLine`
rows with the same fields populated. Decision 111 ("one pantry item per
container, repeated lines are real repeats, never collapsed") constrains
task 2.5's line-ordering/grouping logic directly: OCR geometry grouping may
merge a price with its wrapped continuation line, but must never merge two
visually-similar-but-separate printed lines into one — that is exactly the
"tempting defence against extraction reading a line twice" decision 111
already rejected for the cloud path, and it applies identically here.

**Types.** `Receipt`, `ReceiptLine`, `ReceiptFrame`,
`ReceiptType`/`ReceiptStatus`/`ReceiptLineKind`/`QuantityKind` already exist
in `src/types.ts` and are extraction-source-agnostic (no field records
which engine produced a line today). Task 1.2's new OCR model-state/engine/
geometry/confidence types are additive alongside these, not a replacement —
`ReceiptLine` may eventually gain an optional provenance field once task 3
settles how OCR text reaches it, but that is task-3 scope, not decided here.

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
