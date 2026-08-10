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
- [ ] 1.4 Include a multi-pack, a store-printed variable-weight code from a
      supermarket deli or produce counter, and a code with a deliberately wrong
      check digit. These are the three shapes that are not "a product", and each
      fails differently.

## 2. Lookup client

- [x] 2.1 Implement `src/api/openFoodFacts.ts`: lookup by GTIN with the same
      timeout and abort conventions as `src/api/gemini.ts`.
- [x] 2.2 Throw `VisionError` kinds from `src/api/errors.ts` — `network`,
      `timeout`, `server` — rather than inventing a second error vocabulary for
      one module.
- [x] 2.3 Parse defensively. Missing brand, missing package size, and missing
      nutrition are all ordinary, not failures.
- [x] 2.4 Set a descriptive user-agent, as the service asks of clients.
- [x] 2.5 Unit-test parsing against the fixture responses including the
      malformed one.

## 2a. Codes that are not products

Three cases the lookup client must dispose of before it makes a request. Each
would otherwise cost a round trip and then poison the cache with a miss that is
not a miss.

- [x] 2a.1 Validate structure and check digit in `src/logic/barcode.ts` for
      EAN-13, EAN-8, UPC-A, and UPC-E. Pure, and worth having as its own tested
      function.
- [x] 2a.2 Treat a validation failure as an **unread scan**, not an unknown
      product. The camera misread; the shelf is fine.
- [x] 2a.3 Detect restricted-circulation prefixes — the ranges retailers print
      in-store for loose and variable-weight goods — and route them to
      photograph or manual entry without a lookup.
- [x] 2a.4 **Never cache either as a miss.** A store-local code means something
      different in every shop, and a misread means nothing anywhere. Caching
      them makes a rescan fail permanently for no reason.
- [x] 2a.5 Never bind a canonical to a store-local code, for the same reason.
      This is the one place where the learn-once-and-stop-asking behaviour is
      actively wrong.
- [x] 2a.6 Do not read an embedded price or weight out of a store-local code as
      a quantity. The encoding is retailer-specific and the number is often the
      price.
- [x] 2a.7 Unit-test all three against the 1.4 fixtures, including that a valid
      code still passes.

## 3. Cache

- [x] 3.1 Add product upsert by GTIN to `src/db/queries.ts`, writing name,
      brand, package size, nutrition, source, and fetch time.
- [x] 3.2 Append a `barcode_misses` migration storing GTIN and lookup timestamp.
      Keep misses out of `products`: a miss has no canonical id, and a resolved
      product must never carry a fabricated one. A rescan then avoids repeating
      a request that already failed.
- [x] 3.3 Honour a cached miss for one month before retrying, as a named
      constant.
- [x] 3.4 Confirm a cached hit and a cached miss both make no network request.

## 4. Product to ingredient

- [x] 4.1 Implement `src/logic/barcode.ts`: turn a lookup result into a product
      record and a reference for the matcher.
- [x] 4.2 Pass the product name to `resolve()` **without** the barcode set —
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
- [ ] 6.4a Expand a known multi-pack into one item per container, each holding a
      single container's size. Decision 56 is the reason: six unopened cans have
      six independent expiries, and one item of quantity six has one wrong.
- [ ] 6.4b Create a single item when the container count is unknown. Inferring a
      count from a package size is guessing.
- [ ] 6.4c Show the pack count in review and let the user change it — lookup data
      is the least reliable field the remote source returns and this one
      multiplies.
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
- [ ] 8.4a Scan a supermarket's own variable-weight sticker and confirm it goes
      straight to photograph or manual entry with no failed-lookup message.
- [ ] 8.4b Scan a multi-pack and confirm the pantry holds its containers
      separately.
- [ ] 8.5 Confirm scanning an Asian packaged good either resolves or falls back
      cleanly — record the hit rate across the fixture set, since it is the
      evidence for how load-bearing the fallback is.
- [ ] 8.6 Run `npm run typecheck` and `npm test`, then record the measured
      lookup hit rate in `docs/product-decisions.md`.
