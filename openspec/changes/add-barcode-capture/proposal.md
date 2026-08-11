## Why

Decision 22 settled that barcode beats vision for packaged goods — roughly two
seconds against fifteen for photograph-plus-correction. Decision 60 then made
progressive population the way the pantry fills, and barcode is the fastest
channel of the three for the goods that carry one.

The infrastructure is already built and unused. `add-identity-layer` created the
`products` table with a unique `gtin` index, and step 1 of the resolution
cascade already resolves a barcode to a canonical ingredient at confidence 1 —
the cheapest and most certain path there is. Nothing currently populates it.
Every packaged item in the app today goes through the slow path for want of a
scanner.

`expo-camera` is already a dependency and supports scanning natively, so this is
mostly wiring rather than new capability.

Implements decisions 8, 22, and 60.

## What Changes

- **Scan a barcode with the camera**, using `expo-camera`'s native support. No
  new dependency.
- **A known barcode resolves instantly and offline.** The `products` table is
  the cache; a second scan of the same item never touches the network, which is
  what decision 8 means by offline-first in practice.
- **An unknown barcode is looked up in Open Food Facts**, a free community
  database with usable international coverage — including the Asian packaged
  goods decision 4 cares about. The result is stored as a product so the lookup
  happens once ever.
- **The looked-up product name resolves through the existing matcher** to a
  canonical ingredient. A product is a specific SKU; the canonical is the food.
  This change does not invent a second path for that.
- **Nutrition from the lookup populates the product**, filling fields the
  `products` table already has and nothing currently writes.
- **Rapid scan mode**, so stocking up is scan-scan-scan then one review — the
  batching lesson decision 23 learned about photo capture, applied to a channel
  where it matters more because scanning is fast enough that per-item review
  would dominate.
- **A barcode not in the database falls back gracefully** to photograph or
  manual entry rather than dead-ending.

## Capabilities

### New Capabilities

- `barcode-capture`: Scanning a product barcode and turning it into stock.
  Covers camera scanning, resolution against the local product cache, remote
  lookup and caching of unknown barcodes, mapping a product to a canonical
  ingredient, nutrition capture, rapid multi-scan with deferred review, and
  fallback when a barcode is unknown everywhere.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Matching.** `resolve()` handles product name to canonical. This change calls
  it.
- **Barcode generation, or non-product codes.** QR codes, loyalty cards, and
  coupons are not in scope.
- **Contributing corrections back to Open Food Facts.** Worth doing eventually
  and a genuine good, but it needs an account, an upload path, and a moderation
  story. Not now.
- **Depending on a lookup being available.** The feature must remain useful when
  the remote database is unreachable or the barcode is absent from it.
- **Weighing or scanning loose produce.** Barcodes are for packaged goods;
  produce goes through photo or manual entry.

## Impact

**Schema.** Forward-only migrations add `barcode_misses` with a unique GTIN and
lookup timestamp, then nullable `products.container_count`. A positive count is
durable SKU metadata only when the source explicitly states it; `null` means it
is genuinely unknown and is never inferred from total package quantity.
`products` remains the cache for resolved products: its required canonical id
makes it structurally unable to represent a miss. Scan sessions remain in
memory and need no persistence.

**Code.**
- `src/api/openFoodFacts.ts` — lookup by GTIN, with the same timeout, abort, and
  error-taxonomy conventions as the existing transports. It is not a vision
  provider, so it does not go through `vision.ts`, but it should fail in the
  same vocabulary.
- `src/logic/barcode.ts` — pure: turning a lookup result into a product record
  and a reference for the matcher.
- `src/db/queries.ts` — product upsert by GTIN, and reads for the cache path.
- `app/` — a scan screen and the deferred review for rapid mode.

**Dependencies.** None added. `expo-camera` is already at ~17.0.10 and scans
natively.

**Depends on** `add-identity-layer` (merged) and `add-pantry-stock` (in
progress — scanning creates pantry items).

**Cost.** No model calls on the common path. A lookup is a small HTTP request,
and a cached barcode costs nothing at all. This is the cheapest input channel in
the product by a wide margin.

**Risk.** Open Food Facts is community-maintained, so entry quality varies —
wrong weights, missing brands, occasional nonsense. A scan that silently creates
a wrong pantry item is worse than one that asks. Coverage is also uneven by
region, and thinnest in exactly some of the Asian markets decision 4 targets, so
the fallback path is load-bearing rather than an edge case.

**Licensing.** Open Food Facts data is published under the Open Database
License. Attribution belongs somewhere in the interface, and the obligation
should be checked before shipping rather than after.
