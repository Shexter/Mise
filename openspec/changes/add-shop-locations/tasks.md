## 1. The permission story, resolved

- [x] 1.2 Confirm which permission level is actually needed. Resolved:
      reliable arrival/departure detection needs background region monitoring,
      which needs "Always" authorization on both platforms — iOS requires a
      second, separate prompt for it; Android requires declaring
      `ACCESS_BACKGROUND_LOCATION` and justifying it to Play Store review. "While
      in Use" cannot deliver background events, confirmed from platform docs
      (see `design.md`'s "Foreground-only reads, not geofencing").
- [x] 1.3 Record the answer: this was a materially bigger trade than the
      proposal weighed. Per the change's own stop condition, it was re-decided
      rather than assumed — the user chose to drop automatic arrival/departure
      detection and keep the rest, making "While in Use" (foreground-only, no
      background task) sufficient. See `design.md`'s Decisions and the revised
      `proposal.md`.
- [x] 1.1 Write the sentence shown before the permission is requested, now that
      the ask is foreground-only. Written and shipped verbatim in three places
      — `app/shops.tsx` (`PERMISSION_EXPLANATION`, shown on screen before the
      OS dialog can appear), and `app.config.ts` as both
      `NSLocationWhenInUseUsageDescription` and the `expo-location` plugin's
      `locationWhenInUsePermission`: "Mise uses your location, only while the
      app is open, to recognise shops you've bought from before and show what
      you're low on when you check one."

## 2. Schema

- [x] 2.1 Appended `SHOPS` to `src/db/schema.ts` as Migration 30 (index 29,
      `LATEST_VERSION` 30 — the change's original "Migration 28" note predated
      the fasting and chart-preference migrations landing). Five columns:
      `id`, `name`, `store_name`, `latitude`, `longitude`, with a unique index
      on `store_name`.
- [x] 2.2 No visit table, no timestamps of presence, no `last_seen_at`. The
      migration's own comment says why, and the property is enforced by test
      rather than by review — see 2.5.
- [x] 2.3 Added `Shop` to `src/types.ts`, alongside `NeededIngredient`
      (identity and status only — no quantity field exists to leak).
- [x] 2.4 `DROP_ALL` drops `shops` first; `test/shop-locations.test.ts` asserts
      *Delete all data* removes the table, and `test/migrations.test.ts`'s
      existing "DROP_ALL removes every table" test still passes.
- [x] 2.5 `test/shop-locations.test.ts` asserts the `shops` table has exactly
      those five columns and none matching a time-like name, that no table
      anywhere is named for visits/arrivals/geofences, and that no *other*
      table carries a coordinate that could be paired with a timestamp.
- [x] 2.6 The migration is applied from the prior head with existing data
      intact in `test/shop-locations.test.ts`. `npm run typecheck` passes.

## 3. Learning shops

- [x] 3.1 `attachAndResolveReceipt` in `src/logic/receiptService.ts` calls
      `noteShopForReceipt` (`src/logic/shopService.ts`), which does one
      foreground read via `readCoarsePosition` and records it against the
      receipt's store name.
- [x] 3.2 `coarsen` in `src/logic/shops.ts` rounds to `COARSE_DECIMALS` (4,
      ~11 m) before anything is stored; `rememberShop` coarsens again at the
      query layer so no caller can bypass it. Tested with two readings inside
      one supermarket collapsing to the same stored position.
- [x] 3.3 `rememberShop` is keyed on `store_name` (unique index) and updates in
      place. The user's own name for the shop survives the update; only the
      position moves, so repeated imports leave one row rather than a trail.
- [x] 3.4 No places lookup exists. `test/shop-locations.test.ts` scans every
      source file in the feature for `geocodeAsync`, `reverseGeocode`, `fetch(`,
      `nominatim`, `overpass`, `places`, and the background-location APIs, and
      `test/stubs/expo-location.ts` deliberately implements only the three
      foreground calls, so reaching for a lookup breaks the suite.
- [x] 3.5 Without permission, `noteShopForReceipt` returns before reading —
      asserted by the position stub recording zero reads — and the import
      proceeds unchanged.

## 4. The manual shop check

- [x] 4.1 `expo-location` added (`~19.0.8`, via `expo install`) and wrapped in
      `src/logic/location.ts`: `getCurrentPositionAsync` at `Accuracy.Low`,
      one shot, foreground. No `startLocationUpdatesAsync`, no
      `startGeofencingAsync`, no `TaskManager`, no background permission
      request — the config declares only `ACCESS_COARSE_LOCATION` and the
      "when in use" strings.
- [x] 4.2 `checkCurrentShop` matches the read position with `nearestShop`
      (`SHOP_MATCH_RADIUS_METRES`, 150 m) and returns what
      `listNeededIngredients` finds at `running_low` or `out`.
- [x] 4.3 `NeededIngredient` carries `canonicalId`, `displayName`, `status`
      and nothing else; the query does not select a quantity column at all.
      Tested by asserting the result keys.
- [x] 4.4 `nothing_needed` and `unknown_shop` are distinct outcomes, both
      surfacing a one-line toast rather than an empty result screen.
- [x] 4.5 A test snapshots `pantry_items`, `receipts`, `shops`, and
      `consumption_events`, runs the check twice, and asserts nothing moved.
- [x] 4.6 Every failure mode — denied, revoked mid-check, services off, no fix
      — resolves to `no_permission` or `no_position`. Nothing throws and
      nothing re-prompts; the OS remembers a decline and the screen returns to
      showing the explanation.

## 5. Feeding receipt matching

- [x] 5.1 `storeForReceipt` passes the resolved store into
      `resolveReceiptLines`, which already threads it to `normalise` via
      `referencesFromLines`. `normalise.ts` is untouched.
- [x] 5.2 `storeForNormalisation` returns the printed header whenever it is
      non-blank, and only falls back to the recognised shop otherwise.
- [x] 5.3 `SHOP_RECENCY_WINDOW_MS` (30 minutes) in `src/logic/shops.ts`, with
      the guess documented. It gates an in-memory `lastRecognised` value only
      — nothing about when the user was anywhere reaches disk.
- [x] 5.4 Both directions tested: an unreadable header at a known shop adopts
      the shop's store name; a legible header standing in a *different* known
      shop keeps its own. An unreadable header at an unknown shop yields null
      rather than a guess.

## 6. Managing shops

- [x] 6.1 `app/shops.tsx` — list, rename (via `Sheet` + `Field`), and remove
      individually. Reachable from Settings → Tracking → Shops.
- [x] 6.2 "Forget all shop positions" calls `deleteAllShops`, which touches
      only the `shops` table; a test asserts the pantry survives it intact.
- [x] 6.3 One line at the top of the screen: "Mise stores where a shop is,
      learned from receipts you import there. It never stores when you were
      anywhere."
- [x] 6.4 Built from `Screen`, `Card`, `Divider`, `Button`, `Field`, `Sheet`,
      `Toast`, and the `Type` components, styled only with `color`, `space`,
      `layout`, and `opacity` tokens. No colour, font, or spacing literal.

## 7. Verification

- [ ] 7.1 Import a receipt at a real shop and confirm it is remembered.
      *(On-device; not runnable here. Covered in automated form by
      `test/shop-locations.test.ts` "learns the shop when a receipt names its
      store".)*
- [ ] 7.2 Check that shop and confirm the low-stock list surfaces.
      *(On-device; automated equivalent: "surfaces what is low or out, by
      status and never by quantity".)*
- [x] 7.3 Confirm a shop with nothing needed surfaces nothing, and confirm
      checking never creates or changes anything on its own — both asserted in
      `test/shop-locations.test.ts`, the second by a full before/after
      database snapshot across two checks.
- [x] 7.4 Declining the permission leaves the app exactly as it is today:
      `noteShopForReceipt` returns without reading, the import path is
      unchanged, and `checkCurrentShop` reports `no_permission`. Asserted.
- [x] 7.5 Revoking mid-use, including mid-check, is covered by the stub's
      `throwOnRead`: both entry points resolve to a null/`no_position` result
      rather than throwing, and neither re-prompts.
- [x] 7.6 The database cannot answer where the user was on any given day —
      enforced by the schema tests in 2.5 rather than by inspection.
- [x] 7.7 No request carries a position: nothing in the feature calls `fetch`,
      geocodes, or reverse-geocodes (asserted by source scan), and the receipt
      extraction request is built from the photo alone — the shop is used only
      to pick brand prefixes locally in `normalise`.
- [x] 7.8 `npm run typecheck` and `npm test` both pass (106 files, 888 tests).
      The permission level — "While in Use", foreground-only — is recorded in
      `docs/product-decisions.md` under "Shop locations".
