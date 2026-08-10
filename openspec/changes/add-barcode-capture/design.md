## Context

See `proposal.md` — Why.

The unusual thing about this change is how much of it already exists:

- `products` in `src/db/schema.ts` has `gtin UNIQUE`, `brand`, `name`,
  `pkg_qty`, `pkg_unit`, `canonical_id`, per-100 nutrition, `source`, and
  `fetched_at`, plus `idx_products_gtin`. Written for this and never populated.
- Step 1 of `resolve()` already takes `reference.barcode`, looks up
  `productCanonicalByBarcode`, and returns confidence 1 with method `barcode`.
  Tested. Nothing produces a barcode to feed it.
- `expo-camera` at ~17.0.10 scans natively.

So this is a lookup, an upsert, and a screen.

## Goals / Non-Goals

**Goals:**

- The common path costs nothing: no model call, and no network after first sight.
- A failed lookup is a fork in the road, not a wall.
- Scanning twelve items feels like scanning, not like twelve small forms.

**Non-Goals:**

- Matching, contribution back to the remote source, loose produce. See the
  proposal's non-goals.
- Guaranteeing coverage. The remote database is uneven and the design assumes
  misses are ordinary.

## Decisions

### The lookup client is not a vision provider, but fails in the same vocabulary

`src/api/openFoodFacts.ts` stands alone rather than joining the `TRANSPORTS`
registry, but throws `VisionError` kinds from `src/api/errors.ts` — `network`,
`timeout`, `server`.

*Why:* it is not an inference call and has no API key, so putting it behind the
provider facade would misrepresent it. But every caller in the app already knows
how to handle that error taxonomy, and inventing a second one for one module
would mean two ways to say "the network is down". Reusing the vocabulary without
reusing the routing is the honest middle.

*Naming caveat:* `VisionError` is a poor name for a barcode lookup failure. It
is not worth a rename now, but if a third non-vision caller appears the type
should become `AppError` with `VisionError` as an alias.

### A miss is cached separately from a product

A barcode the remote source does not know is stored in `barcode_misses` with
its GTIN and lookup timestamp, not left absent. `products` remains only for
resolved products: its required `canonical_id` must never be fabricated for a
product the lookup could not identify.

*Why:* without this, every scan of the same unknown item repeats a request that
will fail again, and the fallback path — photograph or manual — is exactly where
a user is most likely to rescan out of hope. Caching the miss also means the
fallback can be offered immediately on second sight rather than after a timeout.

*Trade-off:* the remote database gains entries constantly, so a cached miss goes
stale. The timestamp allows a refresh policy later; the initial policy is to
retry a miss no more than once a month.

### Product-to-canonical goes through `resolve()`, with the barcode omitted

The lookup returns a name like `Kikkoman Naturally Brewed Soy Sauce 500ml`. That
string is passed to `resolve()` as an ordinary reference — *without* the barcode
set, because step 1 would otherwise consult the very product row being created.

*Why:* the existing normaliser already strips size tokens and brand prefixes,
which is precisely what a product title needs. Reusing it means a barcode
lookup benefits from every alias the receipt path has learned, and vice versa.
Omitting the barcode avoids a circular resolution that would return nothing
useful.

### Uncertain mappings are resolved once and bound to the barcode

Where resolution lands in the confirm band, the user is asked, and the answer is
written both as an alias (through the existing user-resolution path) and as the
product's `canonical_id`.

*Why:* the barcode is a stronger key than the name. Binding the answer to the
GTIN means the question is never asked again for that SKU even if the name
resolves ambiguously forever.

### Rapid scan holds a session in memory, not in the database

Scanned items accumulate in a store and are written only when the batch is
accepted.

*Why:* the spec requires nothing be applied before acceptance, and a scanning
session is short. Persisting mid-session would need its own table, its own
cleanup, and a resume interface, for a flow measured in seconds.

*Consequence, stated because it is a real trade-off:* a crash mid-session loses
the scans. Acceptable for a sixty-second flow; it is the reason the migration
plan says a migration is needed *only* if this proves wrong in use.

### Duplicate scans within a session increment, across sessions do not

Scanning the same code twice in one session is treated as two items — people
stocking up buy three identical tins. Holding the camera still on one code does
not.

*Why:* these look similar and are opposite. Debouncing is about the same
physical code being read repeatedly in a fraction of a second; a deliberate
rescan seconds later is a second tin. A short debounce window separates them,
and the review screen lets a wrong count be fixed either way.

### Three kinds of code are not products, and each fails differently

The lookup client's first job is deciding whether to look anything up.

**A misread code** — the camera resolved a barcode that fails its check digit.
Nothing is wrong with the shelf; the scan is simply not a scan yet.

**A store-local code** — the range retailers reserve for goods they price
in-store, printed at the deli counter and the produce scales. It is a valid
barcode that means something only inside one shop, and often encodes a price or
a weight rather than an identity.

**An unknown product code** — a real, globally meaningful GTIN that the remote
source has never heard of. This one is genuinely a miss, and is the only one of
the three that should be cached as one.

*Why the distinction is load-bearing rather than pedantic:* the existing design
already caches a miss as a marked row for a month, and already binds a
user-supplied identification to a barcode so a rescan stops asking. Both are
right for an unknown product and actively harmful for the other two. A cached
miss on a misread makes a perfectly good tin unscannable for a month. A canonical
bound to a store-local code makes the deli counter's sticker mean "chicken
thighs" in every shop the user ever visits, forever, because the range repeats
across retailers.

*Why validation happens before the request rather than after the failure:* it is
free, it is pure, and the failure it prevents is indistinguishable from a real
miss once the request has been made.

*Why an embedded weight is not read:* the encodings are retailer-specific and
undocumented, and the field that looks like a weight is frequently a price.
Decision 15's principle again — a quantity the app cannot defend is worse than
no quantity.

### A multi-pack expands into its containers

Six cans of coconut milk scanned once is six pantry items, not one item of
quantity six.

*Why:* decision 56 makes a pantry item a container, and the whole expiry model
rests on it. Five unopened cans and one opened one have different expiries and
different statuses, and a single item of quantity six can only represent one of
those states. The expansion is what keeps decision 3's promise honest for
anything bought in packs, which in a supermarket is a great deal.

*Why only when the count is known:* a package size of `6 x 400 ml` states the
count; `2.4 l` does not, and dividing one by a guessed container size to recover
it is inventing a fact. Unknown makes one item, and the review screen shows the
count so the user can correct either way.

*Consistency with rapid scan:* scanning the same tin three times in a session
already produces three items. A three-pack scanned once produces the same three.
The two paths agree, which is the point — a user should not get a different
pantry depending on whether the shop shrink-wrapped their tins.

## Risks / Trade-offs

**Remote data quality is uneven** → wrong weights and missing brands create
wrong pantry items silently. Mitigation: the spec requires looked-up fields be
correctable before the item is created, and the review screen shows what was
fetched rather than hiding it.

**Coverage is thinnest where decision 4 aims** → Asian packaged goods are less
completely catalogued than Western ones, so the differentiator audience hits the
fallback more often. Mitigation: the fallback is specified as a first-class
path, and a user-supplied mapping is remembered against the barcode, so a
poorly-covered pantry becomes well-covered after one pass.

**Scanning creates stock faster than the user notices** → twelve scans is twelve
rows, and a mis-scan is easy to miss in a list. Mitigation: running count during
the session, and removal during review.

**Licence obligation** → Open Food Facts is ODbL, which carries attribution and
share-alike terms on the data. Mitigation: attribution is a spec requirement,
and the task list puts checking the obligation *before* shipping rather than
after.

## Migration Plan

Append one migration creating `barcode_misses` with a unique GTIN and
`fetched_at`. The miss table has no foreign key because a not-found GTIN has no
product or canonical ingredient. `DROP_ALL` removes it.

No migration is needed for scan sessions, which deliberately stay in memory.

Rollback: nothing to reverse. Cached products remain and are simply unused.

## Open Questions

- **How long a cached miss is honoured before retrying.** One month initially.
  A policy over one column, changeable with no interface impact.
- **Whether a second lookup source is worth adding for regional coverage.**
  Depends on measured miss rates once real scanning happens. The client is a
  single module, so a second source attaches behind the same function.
