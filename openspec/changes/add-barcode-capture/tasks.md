## 1. Groundwork

- [ ] 1.1 Check the Open Food Facts licence obligations — the data is ODbL, with
      attribution and share-alike terms — and record what the app must display
      and where. Do this first: it can change the interface, and finding out
      after shipping is the expensive order.
- [ ] 1.2 Call the lookup API by hand for a hit, a miss, and a malformed entry.
      Record the response shape, the fields actually populated in practice, and
      the rate-limit and user-agent expectations.
- [ ] 1.3 Collect at least 15 real barcodes as fixtures spanning Western and
      Asian packaged goods, deliberately including two known to be absent.

## 2. Lookup client

- [ ] 2.1 Implement `src/api/openFoodFacts.ts`: lookup by GTIN with the same
      timeout and abort conventions as `src/api/gemini.ts`.
- [ ] 2.2 Throw `VisionError` kinds from `src/api/errors.ts` — `network`,
      `timeout`, `server` — rather than inventing a second error vocabulary for
      one module.
- [ ] 2.3 Parse defensively. Missing brand, missing package size, and missing
      nutrition are all ordinary, not failures.
- [ ] 2.4 Set a descriptive user-agent, as the service asks of clients.
- [ ] 2.5 Unit-test parsing against the fixture responses including the
      malformed one.

## 3. Cache

- [ ] 3.1 Add product upsert by GTIN to `src/db/queries.ts`, writing name,
      brand, package size, nutrition, source, and fetch time.
- [ ] 3.2 Store a miss as a marked row rather than nothing, so a rescan does not
      repeat a request that will fail again.
- [ ] 3.3 Honour a cached miss for one month before retrying, as a named
      constant.
- [ ] 3.4 Confirm a cached hit and a cached miss both make no network request.

## 4. Product to ingredient

- [ ] 4.1 Implement `src/logic/barcode.ts`: turn a lookup result into a product
      record and a reference for the matcher.
- [ ] 4.2 Pass the product name to `resolve()` **without** the barcode set —
      step 1 would otherwise consult the product row being created, which
      resolves nothing useful.
- [ ] 4.3 On a confirm-band outcome, ask the user once, then write the answer
      both as an alias through the existing user-resolution path and as the
      product's `canonical_id`, so the GTIN never asks again.
- [ ] 4.4 Unit-test the mapping path, including the confirm-band branch.

## 5. Scanning

- [ ] 5.1 Build lookup, caching, and batch review — **not a scan screen**.
      Barcodes arrive from the shared Add to pantry surface in
      `add-unified-capture`, which detects them natively and routes here only
      when one resolves. Rapid multi-scan remains this change's, reached from
      that surface.
- [ ] 5.2 Give immediate feedback on a successful read — haptic and visual,
      following the existing capture screen's conventions.
- [ ] 5.3 Debounce a code held in frame so it is not read repeatedly, while
      still allowing a deliberate rescan seconds later to count as a second
      item. These look similar and are opposite.
- [ ] 5.4 Keep the camera active across scans, accumulating a session in a store
      rather than in the database.
- [ ] 5.5 Show a running count during the session.

## 6. Review and apply

- [ ] 6.1 Build the batch review: every scanned item together, with what the
      lookup returned visible rather than hidden.
- [ ] 6.2 Allow correcting name, brand, and package size, and keep the
      correction.
- [ ] 6.3 Allow removing an item before applying.
- [ ] 6.4 Apply as one transaction: create a pantry item per scan using package
      size as quantity and the canonical's default location, with zero
      estimation drift.
- [ ] 6.5 Confirm an abandoned session creates nothing.
- [ ] 6.6 Attribute the remote data source wherever its data is shown, per 1.1.
- [ ] 6.7 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.

## 7. Fallback

The path that carries the differentiator audience, not an edge case.

- [ ] 7.1 When a lookup finds nothing, offer photograph or manual entry inline
      rather than reporting a failed scan.
- [ ] 7.2 When there is no connection and the barcode is uncached, offer the
      same fallback immediately rather than after a timeout.
- [ ] 7.3 Bind a user-supplied identification to the barcode so a later scan
      resolves without asking.
- [ ] 7.4 Test the fallback with the two deliberately-absent fixture barcodes.

## 8. Verification

- [ ] 8.1 Scan a real product, confirm it reaches the pantry with a predicted
      expiry and the right quantity.
- [ ] 8.2 Rescan it with the network disabled and confirm it resolves from cache
      with no request.
- [ ] 8.3 Scan ten items in succession and confirm the camera never interrupts
      and the batch reviews once.
- [ ] 8.4 Scan an item absent from the remote source and confirm the fallback,
      then confirm a rescan does not ask again.
- [ ] 8.5 Confirm scanning an Asian packaged good either resolves or falls back
      cleanly — record the hit rate across the fixture set, since it is the
      evidence for how load-bearing the fallback is.
- [ ] 8.6 Run `npm run typecheck` and `npm test`, then record the measured
      lookup hit rate in `docs/product-decisions.md`.
