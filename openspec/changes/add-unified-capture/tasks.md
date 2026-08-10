## 1. Fixtures first

Classification accuracy is the whole risk, and it is measurable.

- [ ] 1.1 Collect at least 20 capture fixtures: packaged goods with barcodes,
      receipts from several stores, single items, several items on a counter, a
      receipt photographed at an angle, a fridge interior, and two captures with
      no usable food at all.
- [ ] 1.2 Include at least three receipts that carry their own barcode. This is
      the collision the router exists to survive.
- [ ] 1.3 Record a model response per fixture so routing tests need no provider.

## 2. The router

Pure logic. No camera, no network.

- [x] 2.1 Implement `routeCapture(barcodeResult, extraction): Destination` in
      `src/logic/captureRoute.ts`.
- [x] 2.2 Encode the decision table: resolved barcode, detected-but-unresolved,
      receipt, items, unclear, nothing usable.
- [x] 2.3 **A barcode routes only when it resolves.** Detection alone must not
      route, or every receipt carrying a barcode fails as a bad product scan.
- [x] 2.4 Unit-test every branch, especially the receipt-with-barcode fixtures
      from 1.2.

## 3. Classifying extraction

- [x] 3.1 Write `src/api/capturePrompt.ts` returning a discriminated result —
      receipt with lines, items with items, or unclear. Raw JSON only, following
      `src/api/prompt.ts`.
- [x] 3.2 One request. Do **not** classify and then extract; the extraction pass
      already knows what it is looking at, and two calls double cost and latency
      per capture.
- [x] 3.3 Implement `src/api/capture.ts` through the existing provider facade and
      `src/api/errors.ts`.
- [x] 3.4 Parse defensively: an unrecognised `kind` is `unclear`, never a crash.
- [x] 3.4a Make the receipt branch return the complete receipt draft contract —
      store, date, type, totals, and typed lines — shared with receipt parsing.
      Hand the draft to receipt persistence without a second model request.
- [ ] 3.5 Measure per-kind accuracy across the fixtures and record it.

## 4. The item path

The handler nothing else in the queue owns.

- [x] 4.1 Turn identified items into proposed pantry items, resolving each name
      through `resolve()` with source `vision`.
- [x] 4.2 Identify several items in one photograph separately.
- [x] 4.3 Propose a storage location per item from its canonical's default
      (decision 18), letting the user change it.
- [x] 4.4 Show predicted expiry before saving, as manual add already does.
- [x] 4.5 Route confirm-band resolutions to the existing confirmation surface
      rather than a new one.

## 5. The capture surface

- [x] 5.1 Build one Add to pantry screen on `CameraView`, following
      `app/capture.tsx`'s conventions. Tokens from `src/constants/theme.ts`, no
      literals.
- [x] 5.2 Enable native barcode detection alongside stills, so a code in frame
      resolves without the user doing anything different.
- [x] 5.3 Offer no choice of input method anywhere on the surface.
- [x] 5.4 Keep manual entry reachable, as the path needing no key, connection, or
      camera.
- [x] 5.5 Extend `src/media/photos.ts` with a pantry captures directory, reusing
      the existing resize path.

## 6. Review before write

- [x] 6.1 Route each destination to its review surface — receipt drafts to
      receipt review, items to item review, and products to product confirmation.
- [x] 6.2 Confirm no path writes a pantry item or stock change before the user
      accepts. A receipt draft may be persisted before review and is removed if
      the user discards it.
- [x] 6.3 Confirm abandoning a capture leaves no trace.
- [x] 6.4 Make a misclassification visible and correctable at review, since the
      router made the choice rather than the user.

## 7. Edges

- [x] 7.1 Ask once when classification is `unclear`, and only then.
- [x] 7.2 Report a capture containing nothing usable rather than inventing items.
- [x] 7.3 Handle no-key and offline plainly: say so, retain the capture for
      later, leave manual entry working.
- [x] 7.4 Confirm a cached barcode resolves with no request at all.

## 7a. Receipts longer than a frame

A weekly supermarket shop prints a till roll that does not fit in one legible
photograph. The change currently assumes one capture is one thing, which holds
for a barcode and a bag of onions and fails for the input the receipt path most
wants — the big shop, which is also the one that fills a pantry.

- [x] 7a.1 Append a forward-only migration for `receipt_frames` and
      `receipt_frame_lines`. Store each frame URI, order, extraction state, and
      extracted fields with a frame-local position. Preserve existing
      single-frame receipts and extend `DROP_ALL` plus media deletion.
- [x] 7a.2 Refactor `receiptService` so a new receipt creates its first frame,
      each later frame is retained before extraction, and any failed frame can
      retry independently without recapturing the others.
- [x] 7a.3 Add the receipt-review frame strip and its explicit **Add another
      photo** action. Show retained frames, but never prompt for another one
      when a single frame suffices.
- [x] 7a.4 Rebuild one reviewable receipt from the extracted frames in one
      transaction. De-duplicate only adjacent-frame edge lines matching on
      normalised text, price, and position; preserve legitimate repeated
      purchases under decision 111.
- [x] 7a.5 Take header totals from the latest captured frame that reports them,
      so the tail supplies the printed arithmetic check under decision 113.
- [ ] 7a.6 Allow an unedited frame to be retaken or removed without losing the
      others. Once a line is manually edited, excluded, reclassified, or matched,
      block further frame changes rather than overwrite that correction.
- [ ] 7a.7 Add two-frame and three-frame receipt fixtures, including deliberate
      overlap, identical legitimate purchases, a tail-only total, frame retry,
      removal, and retake cases.

## 7b. The pending queue

The spec retains an offline capture; nothing yet says what the queue *is*.

- [x] 7b.1 Append a forward-only migration creating `pending_captures`, with its
      image URI, status, retry count, last error kind, timestamps, and `DROP_ALL`
      coverage. Never put an API key or interpreted pantry data in this table.
- [x] 7b.2 Persist pending captures with their images, so the queue survives the
      app being closed. A queue in memory loses the capture at the moment the
      user is least able to retake it — they have put the shopping away.
- [x] 7b.3 Interpret a pending capture when a connection returns **to review, not
      to the pantry.** The requirement that nothing is written before review does
      not weaken because the write happens later.
- [x] 7b.4 Show pending captures with a count and a thumbnail, and allow
      individual discard including the retained image.
- [x] 7b.5 Release the queue when a key is configured, not only when a connection
      returns — no-key and offline are different waits with the same shape.
- [x] 7b.6 Bound retries and report a persistently failing capture as failing.
      "Still pending" for a week is a lie by omission.
- [x] 7b.7 Include pending capture images in *Delete all data*, alongside meal
      photos and receipt images.
- [x] 7b.8 Cap the queue, and say so when it is reached rather than accepting
      captures that will never be interpreted.

## 8. Amend the sibling changes

Both are unstarted, so nothing is discarded.

- [x] 8.1 Amend `add-receipt-import` task 7.2: build the receipt handler and
      review surface, not a capture screen.
- [x] 8.2 Amend `add-barcode-capture` task 5.1: build lookup, caching, and batch
      review, not a scan screen. Rapid multi-scan stays its own, reached from
      the shared surface.
- [x] 8.3 Confirm the router degrades gracefully to whichever handlers exist, so
      it does not block on either change landing.

## 9. Verification

- [ ] 9.1 Scan a real product and confirm it resolves with no model call.
- [ ] 9.2 Photograph a real receipt **that carries a barcode** and confirm it is
      handled as a receipt.
- [ ] 9.3 Photograph several groceries and confirm each is identified separately
      with a proposed location.
- [ ] 9.4 Photograph something with no food and confirm it is reported rather
      than forced into items.
- [ ] 9.5 Confirm one action reaches all three outcomes with no method choice.
- [ ] 9.5a Photograph a real weekly-shop receipt across three frames with overlap
      and confirm one receipt, no duplicated lines, and a balanced total.
- [ ] 9.5b Capture with aeroplane mode on, restart the app, restore the
      connection, and confirm the capture is interpreted and lands on review
      rather than in the pantry.
- [ ] 9.6 Record classification accuracy per kind in
      `docs/product-decisions.md`.
- [x] 9.7 Run `npm run typecheck` and `npm test`.
