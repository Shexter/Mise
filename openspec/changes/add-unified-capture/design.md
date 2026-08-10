## Context

See `proposal.md` — Why.

Three entry points exist in the plan today and one is missing entirely:
`add-barcode-capture` task 5.1 builds a scan screen, `add-receipt-import` task
7.2 builds a receipt capture screen, and nothing plans photographing groceries
despite decisions 23 and 60 assuming it exists.

What is reusable: `expo-camera`'s `CameraView` already backs `app/capture.tsx`
and scans barcodes natively; `src/media/photos.ts` resizes and stores; the
provider facade and error taxonomy are established; and `resolve()` from the
identity layer turns a name into a canonical ingredient.

## Goals / Non-Goals

**Goals:**

- The user never classifies their own input.
- The common case costs nothing — a barcode never triggers a model call.
- A wrong turn is visible and correctable before anything is written.

**Non-Goals:**

- Unifying with meal logging, replacing the specialised extractors, removing
  manual entry, owning session flows. See the proposal.

## Decisions

### Routing is tiered by cost, cheapest first

1. Product barcode in frame → attempt local, then remote, resolution.
2. Resolved → product path. Done, no model call.
3. Not resolved, or no barcode → capture the frame and interpret it.

*Why:* barcode detection is free and instant, and packaged goods are a large
share of what enters a pantry. Making the free path first means the most common
input never pays for inference, which matters more here than anywhere else in
the app because this is the action people repeat most.

### A barcode wins only if it resolves

Detection alone does not route.

*Why this is not a detail:* receipts carry barcodes. Supermarket receipts often
print one at the foot for returns. A router that trusts detection would send
every receipt to a product lookup, fail, and report a bad scan — for the input
type it was most supposed to help with. Requiring resolution turns the receipt's
barcode into a harmless non-event.

*Consequence:* an unknown product barcode also falls through to image
interpretation, which is the right outcome anyway — the label is in frame, so
the model can often identify what the lookup could not.

### One request returns a discriminated result and a complete receipt draft

`{ kind: 'receipt', receipt: ExtractedReceipt } | { kind: 'items', items: [...] } | { kind: 'unclear' }`

The receipt branch contains the same store, purchase date, type, totals, and
typed lines that the receipt review already persists. `receiptService` accepts
that extracted draft and creates its pending receipt rows without calling the
model again. `receiptPrompt` and `capturePrompt` may share the receipt schema
and parsing helpers; they must not maintain two drifting versions of it.

*Why not classify then extract:* two calls double the cost and the latency of
every capture, to answer a question the extraction pass is already positioned to
answer. A model reading the image to transcribe it knows whether it is looking
at a till roll or a bag of onions, and asking separately discards that.

*Why a discriminated union rather than a superset object:* a result carrying
both `lines` and `items` fields, most of them empty, invites a caller to read
the wrong one. The tag forces the branch.

### The router is pure and separately testable

`routeCapture(barcodeResult, extraction): Destination` in
`src/logic/captureRoute.ts`, with the camera and the model both injected at the
edges.

*Why:* the interesting part is the decision table — resolved barcode, detected
but unresolved, receipt, items, unclear, non-food — and testing it through a
camera is impossible while testing it as a function is trivial. The same
reasoning that made `planDepletion` a pure function producing intentions.

### Every route lands on review; draft persistence is not application

No route creates pantry items or stock changes before the user accepts. A
receipt needs a durable draft so review, retry, correction, and multi-frame
capture have an identity; creating that draft in `receipts` and
`receipt_lines` is permitted before review and is not application.

*Why:* this is what makes automatic routing safe. A menu makes a wrong choice
the user's; a router makes it the app's, and the only honest compensation is
that a mistake is visible before it costs anything. It also means classification
does not have to be perfect to be better than a menu — it has to be recoverable.

### Ambiguity asks rather than guesses, and asking is rare by construction

`kind: 'unclear'` triggers a single question.

*Why:* the whole premise is removing a decision, so reintroducing it routinely
would defeat the change. Reserving it for genuine inconclusiveness keeps the
promise while refusing to invent a route. A guess here is worse than a question,
because a wrongly-routed receipt produces a catalogue of line-item nonsense.

### Pending captures have a durable, bounded queue

`pending_captures` stores the image URI, capture kind when known, status,
retry count, last error kind, and timestamps. It contains no API key and no
interpreted pantry data. A successful retry removes the queue row only after it
has handed the result to its review flow; discard removes the image and row.

*Why not Zustand or a file-only queue:* either loses the relationship between a
capture, its retry state, and its deletion lifecycle on process death. The
capture image is already a file; SQLite supplies the durable index, count,
retry bound, and transaction boundary that the requirements need.

## Risks / Trade-offs

**Misclassification is less legible than a menu** → the user cannot see why the
app chose wrong. Mitigation: review before write on every route, and fixtures
measuring classification accuracy rather than assuming it.

**A whole-shelf photo is much harder than a few items** → occlusion, stacking,
labels facing away. Mitigation: excluded from the promises. The item path
targets a handful of items in frame; a fridge interior may work and is not
guaranteed.

**One prompt handling several shapes gets muddled** → a classifier and two
extractors sharing an instruction block can degrade all three. Mitigation: the
discriminated output keeps the shapes separate, reuses one receipt contract,
and measures per-kind accuracy independently against fixtures.

**The router ships before its handlers** → receipt and barcode changes may land
after. Mitigation: the router degrades to the handlers that exist and gains the
rest as they arrive, which is why it does not depend on either landing first.

## Migration Plan

Append one forward-only migration creating `pending_captures` with an id, image
URI, nullable detected kind, status, retry count, last error kind, and created
and updated timestamps. Add it to `DROP_ALL`, deleting its images with the
other capture media. Existing receipt drafts continue to use their existing
tables; the queue only owns captures that cannot yet enter a review flow.

`add-receipt-import` task 7.2 and `add-barcode-capture` task 5.1 are amended so
each builds its handler and review surface without a capture screen of its own.
The receipt handler gains an extracted-draft entry point, so the unified
classifier does not cause a second receipt extraction. Both are unstarted, so
nothing is discarded.

Rollback: reverting leaves the specialised handlers reachable only if their own
entry points are restored, which is why the amendment is a task edit rather than
a deletion.

## Open Questions

- **Whether a detected-but-unresolved barcode should be offered to the item
  path as a hint.** The model may identify a product whose code is unknown, and
  binding that code to the answer would grow the local cache. Deferrable — it
  changes one payload field and no interface.
