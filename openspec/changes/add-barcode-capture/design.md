## Context

See `proposal.md` — Why.

The unusual thing about this change is how much of it already exists:

- `products` in `src/db/schema.ts` has `gtin UNIQUE`, `brand`, `name`,
  `pkg_qty`, `pkg_unit`, `canonical_id`, per-100 nutrition, `source`, and
  `fetched_at`, plus `idx_products_gtin`. A later forward migration adds the
  nullable `container_count` needed to distinguish one 2.4 L container from a
  six-pack of 400 ml containers.
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
- Reproducing Yuka's nutrition/additive/organic score, Scout's editorial score,
  affiliate shopping, or a whole-shelf-to-stock inference path.

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

### Container count is durable only when it is explicit

`products.container_count` is nullable SKU metadata, not an estimate. The
Open Food Facts parser sets it only when the source explicitly expresses a
pack shape such as `6 x 400 ml`; a total quantity such as `2.4 l` leaves it
null. The review shows the current count as one for a null value but keeps the
underlying product value null until the user supplies a positive count.

*Why persist it on the product:* pack count identifies how a particular SKU
must become pantry containers. Keeping it only in a short scan session would
make the same known six-pack turn into one container on a later offline scan.

*Why never derive it:* dividing a total by a typical container size guesses a
fact that affects expiry, open state, and stock count. A user may correct an
explicit source value; that correction updates the cached product so later
scans reuse it.

### The product direction is a Mise hybrid, not a competitor clone

Yuka's useful interaction is barcode-first immediacy: one scan opens a compact
result and progressively reveals the source facts. Its operational advantage is
a large, quality-controlled catalogue and explicit missing-product workflow.
Scout's useful interaction is multimodal recovery: barcode, front photograph,
or broader visual search can reach a product explanation. References reviewed
for this decision are Yuka's official application, methodology, limitations,
and 2026 press kit, plus Scout's official product, methodology, privacy, and
terms pages.

Mise combines the interaction strengths without adopting their verdict model.
The result answers five factual questions in order: what product was read,
where its data came from, what package/container shape will enter the pantry,
which nutrition fields are actually known, and what the person can correct.
There is no health score, red/green food judgement, affiliate placement, or
manufacturer-sponsored ranking.

*Why:* Mise cannot defend an overall score from partial Open Food Facts fields,
and a food judgement conflicts with the product's uncertainty and body-neutral
rules. Source and completeness are both testable and useful to the actual pantry
decision.

### Single-scan results use one progressive product sheet

`app/barcode-review.tsx` becomes the single-scan result and review surface. Its
summary is immediately scannable: product and brand, local/remote/user source,
package and container count, pantry destination, and estimated expiry. Available
nutrition is a secondary disclosure; missing values say "Not provided" and
never render as zero.

Every lookup-owned field is editable in place or through a sheet before the
existing add action. A correction upserts the product first, then refreshes the
preview. The batch review uses the same product-row contract so single and rapid
scan do not disagree about correction or attribution.

*Alternative rejected:* a Yuka-style full-screen score is fast to read but
hides the facts that determine pantry correctness. A toast-only success state
is also insufficient because it gives no correction boundary.

### Photograph recovery is a GTIN-bearing draft

`app/barcode-fallback.tsx` must not send "Photograph it instead" to a generic
capture that forgets the barcode. It creates an in-memory recovery draft holding
the validated GTIN and optional remote name. The guided route collects a package
front first, then declared quantity and nutrition-label evidence only as needed.
It reuses the configured provider boundary and existing photo lifecycle; it does
not upload to a Mise service.

Extracted fields return to the same product review. The user confirms the
canonical ingredient and corrects product facts before `upsertProduct` binds the
GTIN. If provider analysis is unavailable, the manual form uses the same draft
and retains the GTIN. Store-local codes remain excluded because they are not
globally stable identities.

*Why:* Scout's front-photo recovery is valuable, but its backend and optional
account model do not fit Mise. Carrying the GTIN locally makes recovery teach the
device once without creating central product infrastructure.

### Recent scans are a presentation index over local products

Recent scan history uses a nullable `products.last_scanned_at` column added by a
new forward-only migration appended to `MIGRATIONS`. A successful local-cache or
remote recognition writes the current time after code validation; merely opening
a result does not. The column does not duplicate nutrition or pantry state and
does not trigger a remote refresh. The history query orders non-null timestamps
descending. Clearing history sets the timestamps to `NULL`, leaving corrected
product facts and pantry records intact.

The existing `products.fetched_at` was rejected because it means remote fetch or
cache update, not scan. Reusing it would reorder history after a correction and
exclude later offline rescans.

*Alternative rejected:* treating Pantry as scan history conflates "I examined
this product" with "I own this product." A server-backed history would add an
account and synchronization boundary for no required benefit.

### Whole-shelf capture is discovery-only until identity and quantity are explicit

The shared camera may visually contain several products, but a shelf image is
not purchase evidence. This change does not implement whole-shelf recognition.
Any later discovery experiment must return selectable candidates and route each
chosen product through individual identity and review; it can never add every
visible package to stock.

## Risks / Trade-offs

**Remote data quality is uneven** → wrong weights and missing brands create
wrong pantry items silently. Mitigation: the spec requires looked-up fields be
correctable before the item is created, and the review screen shows what was
fetched rather than hiding it.

**A simple score would appear more decisive than the source data** → Do not
compute one. Show source, known facts, unknown facts, and the pantry consequence
that review will apply.

**Guided photo recovery can look local while calling a configured provider** →
Use the existing provider disclosure, retain a manual path, and never claim that
submitted evidence remained on-device.

**Recent scans can be mistaken for owned stock** → Keep history visually and
semantically separate from Pantry; reopening a scan is read-only until review.

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
`fetched_at`, then a later forward-only migration adding nullable positive
`container_count` to `products`, then append another forward-only migration
adding nullable `last_scanned_at`. The miss table has no foreign key because a
not-found GTIN has no product or canonical ingredient. Existing products retain
an unknown count and no scan-history entry (`NULL`); `DROP_ALL` removes the
tables and added columns through its normal product-table reset.

No migration is needed for scan sessions, which deliberately stay in memory.

Rollback: nothing to reverse. Cached products remain and are simply unused.

## Open Questions

- **How long a cached miss is honoured before retrying.** One month initially.
  A policy over one column, changeable with no interface impact.
- **Whether a second lookup source is worth adding for regional coverage.**
  Depends on measured miss rates once real scanning happens. The client is a
  single module, so a second source attaches behind the same function.
