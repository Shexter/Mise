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

- [ ] 2.1 Implement `routeCapture(barcodeResult, extraction): Destination` in
      `src/logic/captureRoute.ts`.
- [ ] 2.2 Encode the decision table: resolved barcode, detected-but-unresolved,
      receipt, items, unclear, nothing usable.
- [ ] 2.3 **A barcode routes only when it resolves.** Detection alone must not
      route, or every receipt carrying a barcode fails as a bad product scan.
- [ ] 2.4 Unit-test every branch, especially the receipt-with-barcode fixtures
      from 1.2.

## 3. Classifying extraction

- [ ] 3.1 Write `src/api/capturePrompt.ts` returning a discriminated result —
      receipt with lines, items with items, or unclear. Raw JSON only, following
      `src/api/prompt.ts`.
- [ ] 3.2 One request. Do **not** classify and then extract; the extraction pass
      already knows what it is looking at, and two calls double cost and latency
      per capture.
- [ ] 3.3 Implement `src/api/capture.ts` through the existing provider facade and
      `src/api/errors.ts`.
- [ ] 3.4 Parse defensively: an unrecognised `kind` is `unclear`, never a crash.
- [ ] 3.5 Measure per-kind accuracy across the fixtures and record it.

## 4. The item path

The handler nothing else in the queue owns.

- [ ] 4.1 Turn identified items into proposed pantry items, resolving each name
      through `resolve()` with source `vision`.
- [ ] 4.2 Identify several items in one photograph separately.
- [ ] 4.3 Propose a storage location per item from its canonical's default
      (decision 18), letting the user change it.
- [ ] 4.4 Show predicted expiry before saving, as manual add already does.
- [ ] 4.5 Route confirm-band resolutions to the existing confirmation surface
      rather than a new one.

## 5. The capture surface

- [ ] 5.1 Build one Add to pantry screen on `CameraView`, following
      `app/capture.tsx`'s conventions. Tokens from `src/constants/theme.ts`, no
      literals.
- [ ] 5.2 Enable native barcode detection alongside stills, so a code in frame
      resolves without the user doing anything different.
- [ ] 5.3 Offer no choice of input method anywhere on the surface.
- [ ] 5.4 Keep manual entry reachable, as the path needing no key, connection, or
      camera.
- [ ] 5.5 Extend `src/media/photos.ts` with a pantry captures directory, reusing
      the existing resize path.

## 6. Review before write

- [ ] 6.1 Route each destination to its review surface — receipt review, item
      review, or the product confirmation.
- [ ] 6.2 Confirm no path writes a pantry item, receipt, or stock change before
      the user accepts.
- [ ] 6.3 Confirm abandoning a capture leaves no trace.
- [ ] 6.4 Make a misclassification visible and correctable at review, since the
      router made the choice rather than the user.

## 7. Edges

- [ ] 7.1 Ask once when classification is `unclear`, and only then.
- [ ] 7.2 Report a capture containing nothing usable rather than inventing items.
- [ ] 7.3 Handle no-key and offline plainly: say so, retain the capture for
      later, leave manual entry working.
- [ ] 7.4 Confirm a cached barcode resolves with no request at all.

## 8. Amend the sibling changes

Both are unstarted, so nothing is discarded.

- [ ] 8.1 Amend `add-receipt-import` task 7.2: build the receipt handler and
      review surface, not a capture screen.
- [ ] 8.2 Amend `add-barcode-capture` task 5.1: build lookup, caching, and batch
      review, not a scan screen. Rapid multi-scan stays its own, reached from
      the shared surface.
- [ ] 8.3 Confirm the router degrades gracefully to whichever handlers exist, so
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
- [ ] 9.6 Record classification accuracy per kind in
      `docs/product-decisions.md`.
- [ ] 9.7 Run `npm run typecheck` and `npm test`.
