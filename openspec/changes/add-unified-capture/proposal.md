## Why

As the queue stands, adding something to the pantry means first deciding *how*
you are adding it. `add-barcode-capture` builds a scan screen.
`add-receipt-import` builds a receipt capture screen. Photographing groceries
has no change at all, and would be a third.

Three doors, and the user has to classify their own input before the app will
help — which is a decision they should never have to make, because the app can
make it better than they can. A barcode is recognisable by the camera in
milliseconds. A receipt does not look like a bag of onions. Asking a person to
sort that out first is friction the product creates and then charges them for.

One action: **Add to pantry**. Point it at a barcode, a receipt, or the food
itself, and the routing happens behind the camera.

This also closes a real gap rather than only tidying one. Nothing in the queue
plans photographing groceries into the catalogue, despite decision 23 and
decision 60 both assuming it exists.

## What Changes

- **One entry point.** A single Add to pantry action replaces the separate scan,
  receipt, and photo entries. The specialised handlers survive; the user-facing
  choice does not.
- **Tiered routing, cheapest first.** A product barcode in frame resolves
  locally with no model call at all. Only when there is no usable barcode does an
  image go to the model.
- **Classification and extraction in one call**, returning a discriminated
  result — a complete receipt draft, or items — rather than classifying and
  then extracting. A receipt result carries the same header and typed-line data
  the receipt review needs, so handing it off does not make a second model call.
- **A barcode only wins if it resolves.** Receipts frequently carry their own
  barcode; detecting one and looking it up would otherwise send every receipt
  down the product path to fail. A detected code that resolves to nothing falls
  through to image classification.
- **Photographing groceries into the catalogue**, which no change currently
  owns. This is the third handler and it has to be built here.
- **One question, only when the app genuinely cannot tell.** Ambiguity is
  resolved by asking, once, rather than by guessing.

## Capabilities

### New Capabilities

- `unified-capture`: One action for putting anything into the pantry. Covers the
  single entry point, tiered routing from barcode through image classification,
  the discriminated extraction result, photographing groceries into catalogue
  items, handling ambiguity, and the rule that specialised handlers are never
  chosen by the user.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.
`add-receipt-import` and `add-barcode-capture` keep their capabilities intact;
only their task lists change, so their extractors are reached through this
router rather than through screens of their own.

## Non-goals

- **Unifying with meal logging.** Photographing dinner to log calories and
  photographing shopping to stock the pantry are different intents, and a plate
  of food is genuinely ambiguous between them — the app cannot infer which the
  user meant, and guessing wrong writes to the wrong place. Separate tabs,
  separate actions.
- **Replacing the receipt or barcode handlers.** Those changes own their
  persistence, lookup, and review surfaces. This owns getting to them and uses
  their shared data contracts so a receipt is interpreted once.
- **Removing manual entry.** Typing an item stays, as the path that works with
  no key, no connection, and no camera.
- **Bulk session flows.** Rapid multi-scan belongs to `add-barcode-capture`, and
  batched grocery capture to whatever ships it. This is the front door, not the
  session model.
- **Deciding what a photo of a fridge interior means.** A whole-shelf photo is a
  harder problem than a few items on a counter; it is not excluded, but nothing
  here promises it works well.

## Impact

**Schema.** One forward-only migration adds `pending_captures`, the durable
queue for captures that cannot yet be interpreted. A receipt draft is stored in
the existing `receipts` and `receipt_lines` tables before review; it is not
applied stock.

**Code.**
- `src/api/capturePrompt.ts` and `src/api/capture.ts` — the classifying
  extractor, through the existing provider facade and error taxonomy. Its
  receipt variant uses the receipt draft contract rather than a lines-only
  shortcut.
- `src/logic/captureRoute.ts` — new, pure: given a barcode result and an
  extraction result, decide the destination. Testable with no camera and no
  network.
- `app/` — one capture screen, replacing what would have been three.
- `src/media/photos.ts` — extended for pantry captures.

**Dependencies.** None added. `expo-camera` already scans barcodes natively and
is already a dependency.

**Depends on** `add-pantry-stock` (merged) for somewhere to put items, and
coordinates with `add-receipt-import` and `add-barcode-capture` for the
handlers. It does not need either to land first — the router can ship with the
handlers it has and gain the rest as they arrive.

**Risk.** A router that guesses wrong is worse than a menu, because the user
cannot see why. Misreading a receipt as groceries produces a catalogue full of
line-item nonsense; misreading groceries as a receipt produces nothing useful at
all. The mitigation is that every route lands on a review step the user already
has to pass, so a wrong turn is visible and correctable before anything is
written — and the tasks measure classification accuracy against fixtures rather
than assuming it.

## On timing

Neither `add-receipt-import` nor `add-barcode-capture` has started. Building
their screens first and unifying afterwards would mean writing two capture
surfaces to delete them, and retrofitting a router around interfaces shaped for
standalone use. Their task lists are amended here instead, which costs nothing
now and is the same reasoning as the engine seam added to
`add-dinner-decision`.
