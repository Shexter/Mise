## 1. Decide the permission story before writing any of it

- [ ] 1.1 Write the sentence shown before the permission is requested. If it
      cannot be justified in one honest sentence, the feature is not worth the
      permission and this change should stop here.
- [ ] 1.2 Confirm which permission level is actually needed. "While in use" does
      not deliver departure events reliably; "always" is a much larger ask.
      Establish this from the platforms before designing around either.
- [ ] 1.3 Record the answer, because it changes how defensible the feature is.
      If it needs always-on location, that is a materially bigger trade than the
      proposal weighed and it should be re-decided rather than assumed.

## 2. Schema

- [ ] 2.1 Append the migration creating `shops` — id, display name, the store
      name receipts use, and a coarse latitude and longitude.
- [ ] 2.2 **No visit table, no timestamps of presence, no `last_seen_at`.** The
      stored data must be unable to reconstruct movement, and that is a property
      of the schema rather than of the code. Someone will later want a cache
      column here; the answer is no.
- [ ] 2.3 Add `Shop` to `src/types.ts`.
- [ ] 2.4 Extend `DROP_ALL`, and confirm *Delete all data* removes shop
      positions.
- [ ] 2.5 Add a test asserting the schema holds no field capable of recording
      when the user was somewhere.
- [ ] 2.6 Verify the migration runs from the current head and `npm run typecheck`
      passes.

## 3. Learning shops

- [ ] 3.1 On receipt import with permission granted, record a coarse position
      against the receipt's store name.
- [ ] 3.2 Store coarse, not precise. A geofence radius is hundreds of metres and
      a supermarket is a large building; precision buys nothing and stores more
      than is needed.
- [ ] 3.3 Update an existing shop rather than creating a duplicate when the same
      store is imported again nearby.
- [ ] 3.4 **Make no request for nearby places.** Add a test asserting no places
      lookup occurs. The obvious open source is ODbL and decision 144 is already
      holding a change behind exactly that question.
- [ ] 3.5 Do nothing at all when permission is absent — import proceeds
      unchanged.

## 4. Geofencing

- [ ] 4.1 Add `expo-location` and register region monitoring for known shops.
- [ ] 4.2 Handle the OS cap on monitored regions by monitoring the nearest, and
      say so where shops are managed.
- [ ] 4.3 Do not poll position. An app that polls is an app with a position to
      mishandle; region events are what the platforms provide for this.
- [ ] 4.4 Measure battery impact over a normal day rather than assuming region
      monitoring is free.
- [ ] 4.5 Handle permission revoked at runtime without crashing or nagging.

## 5. The two prompts

- [ ] 5.1 On arrival, surface ingredients that are `running_low` or `out`.
- [ ] 5.2 **Show status, never a quantity.** Decision 15 — "running low on soy
      sauce" is defensible, "you have 40 ml left" standing in an aisle is not.
- [ ] 5.3 Surface nothing when nothing is low or out. A prompt that fires with
      no content teaches the user to dismiss the next one.
- [ ] 5.4 On departure, offer to capture what was bought, routing to the existing
      capture surface.
- [ ] 5.5 **Neither prompt acts.** No pantry item, no receipt, no stock change
      without the user. A feature triggered by walking through a door is the last
      place to break the pattern decisions 95 and 122 set, because the user did
      not initiate it and may not even be shopping.
- [ ] 5.6 Make an ignored prompt leave no trace.

## 6. Feeding receipt matching

- [ ] 6.1 Pass a recognised shop's store name into `normalise` as the store,
      using the parameter `add-receipt-import` already added. No change to
      `normalise.ts` itself.
- [ ] 6.2 **The receipt's own header wins** where it states a store. The printed
      header is direct evidence; the geofence is circumstantial, and someone can
      buy a coffee next door or shop at two places in one trip.
- [ ] 6.3 Define "shortly after being at a known shop" as a named constant.
- [ ] 6.4 Test the fallback with an illegible-header fixture and the override
      with a legible one.

## 7. Managing shops

- [ ] 7.1 Add a shops surface: list, rename, remove.
- [ ] 7.2 Allow deleting all stored positions without deleting anything else, so
      withdrawing from the feature does not mean withdrawing from the app.
- [ ] 7.3 Explain in one line what is stored — shop positions, not visits.
- [ ] 7.4 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.

## 8. Verification

- [ ] 8.1 Import a receipt at a real shop and confirm it is remembered.
- [ ] 8.2 Return to that shop and confirm the low-stock list surfaces.
- [ ] 8.3 Leave and confirm the capture offer appears and does nothing on its own.
- [ ] 8.4 Confirm a shop with nothing needed surfaces nothing.
- [ ] 8.5 Decline the permission and confirm the whole app behaves exactly as it
      does today.
- [ ] 8.6 Revoke the permission mid-use and confirm nothing breaks.
- [ ] 8.7 Inspect the database and confirm it cannot answer where the user was on
      any given day.
- [ ] 8.8 Confirm no request anywhere carries a position.
- [ ] 8.9 Run `npm run typecheck` and `npm test`, then record the permission
      level required and the measured battery impact in
      `docs/product-decisions.md`.
