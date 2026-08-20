## Context

See `proposal.md` — Why, the deliberate reversal of `add-venue-inference`'s
location non-goal, and why the shop list is learned rather than downloaded.

What ships today: `src/logic/normalise.ts` takes an optional store and consults
`prefixesForStore` before falling back to `STORE_BRAND_PREFIXES` — store-aware
matching exists and depends on the receipt naming its own store. `receiptService`
imports receipts end to end. Pantry items carry a status of `in_stock`,
`running_low`, `out`, `discarded`, `replaced`. No location code exists anywhere
and `package.json` has no location dependency.

## Goals / Non-Goals

**Goals:**

- The app is useful in the shop, which is where it currently is not.
- The privacy story survives the permission rather than being traded for it.
- Nothing happens without the user asking.

**Non-Goals:**

- Transmitting position, a location history, a downloaded POI database,
  background capture, venue inference from position, shopping-list management,
  requiring the permission. See the proposal.

## Decisions

### Store shops, never visits

`shops(id, name, store_name, latitude, longitude)`. No visit table, no
timestamps of presence, no arrival log.

*Why this is the decision the whole change rests on:* "the app knows where the
supermarkets are" and "the app knows where you have been" are different
databases with wildly different consequences if the device is lost, and only one
of them is needed. A foreground position read tells the app which shop it is
looking at, in the moment, without needing to keep a record of where the user
has been to do it.

*The test that keeps it honest:* the stored data must be unable to reconstruct
movement. That is a property of the schema, not of the code, which is why it is
a requirement rather than a guideline — someone adding a `last_seen_at` column
for a reasonable-sounding cache would quietly cross the line.

### Foreground-only reads, not geofencing

A one-shot position read at two moments: when a receipt is imported, and when
the user taps "check this shop." No background task, no region monitoring.

*Why this replaced geofencing:* the original plan was OS-level region
monitoring — entering and exiting a shop's radius would drive both prompts
automatically. Checking that plan against the platforms (task 1.2) found that
reliable arrival/departure detection needs background region monitoring, which
needs "Always" location authorization on both iOS and Android — not "While in
Use." iOS shows a second, separate prompt specifically for "Always," weeks
after the first grant; Android requires declaring
`ACCESS_BACKGROUND_LOCATION` and justifying it to Play Store review before the
permission is even grantable app-wide. That is a materially bigger trade than
this change argued for: the proposal weighs "a permission," not *the*
permission both platforms treat as their most sensitive, gated by their
heaviest review scrutiny. Per task 1.3, that gap triggered a re-decision
rather than proceeding on the original assumption. The user chose to drop
automatic detection and keep everything else, which makes the permission
foreground-only: no background task, no region cap, no battery question,
because there is nothing running when the app is not.

*What this costs:* the two automatic prompts become one manual action (see
"The manual check is an offer, and it never acts," below). Arrival surfacing
is still available, just user-triggered; departure-triggered capture is
dropped entirely rather than replaced, because there is no reliable
foreground-only way to detect "leaving," and receipt capture already covers
that moment without needing a trigger.

### Shops are learned at receipt import

When a receipt is imported and permission is granted, record the coarse position
against the receipt's store name.

*Why at import rather than at capture:* the receipt is the thing that names the
store. A photograph taken in a shop knows where it was and not what it was.

*Why coarse:* a supermarket is a large building, and matching "which shop is
this" only ever needs building-level precision. Storing a precise position
buys nothing and stores more than is needed.

*Why this beats a places database:* argued in the proposal. The short version is
that it works offline, carries no licence question — decision 144 is currently
holding an entire change behind exactly that — and it learns the Asian grocer on
the corner that no database lists and that decision 4's audience actually uses.

*The bootstrap cost, stated plainly:* nothing happens at a shop until a receipt
from it has been imported. That is a real limitation. It is also self-resolving,
explainable in a sentence, and free — importing the receipt was already the
thing the user was doing.

### The manual check is an offer, and it never acts

Checking a known shop surfaces what is low or out. It changes nothing.

*Why still frame it as an offer, now that it is user-triggered rather than
automatic:* every other automatic-seeming thing in this app lands on review
first — decision 95 for capture routing, decision 122 for pending captures.
The user asking "what do I need here" should not silently do anything beyond
answering that question — no different from any other read-only query in the
app.

*Why it shows status rather than quantity:* decision 15. "Running low on soy
sauce" is defensible; "you have 40 ml left" standing in an aisle is a number
the app cannot justify and the user cannot check.

*Why the departure/capture offer was dropped rather than kept manual too:* a
manual "capture what I bought" button needs no location at all — it is just
the existing capture surface, reachable the same way it already is today.
Location only would have added value by triggering it automatically on
departure, and that is exactly the piece removed above.

### The receipt's own header still wins

A recognised shop supplies a store name only when the receipt does not.

*Why:* the receipt is direct evidence and a position match is circumstantial.
Someone can buy a coffee at the shop next door, or shop at two places in one
trip. Where both are available the printed header is the better source, and
the position match is the fallback it never had.

## Risks / Trade-offs

**The permission is the app's first, and asking costs trust** → mitigated by
asking in context rather than at launch, explaining before requesting, and
degrading fully. It is still a real cost and the proposal weighs it explicitly
rather than assuming the feature is worth it.

**Position accuracy in dense retail** → shops next to each other, or a large
shopping centre, can make the nearest-match wrong. Accepted: the check is a
manual offer, so a wrong match costs a dismissed screen, not a silent bad
decision — lower stakes than the original automatic-prompt design, since the
user only sees a result when they asked for one.

**Feature creep toward a shopping list** → "what you are out of" looks like a
list and will invite editing, adding, ticking off. That is a separate change and
naming it here is what keeps this one small.

**It normalises asking for more permissions** → the honest risk of reversing a
non-goal. Mitigation: the reversal is argued in the proposal on its own terms,
and it explicitly does *not* extend to venue inference, which must be decided
separately rather than inheriting the permission.

## Migration Plan

One forward-only migration creating `shops`. Additive; no existing table
changes. `DROP_ALL` gains it, and *Delete all data* removes shop positions with
everything else.

Rollback removes the manual-check entry point; the app returns to today's
behaviour and the table is inert.

## Open Questions

- **How long "shortly after being at a known shop" should be** for the receipt
  matching fallback. A named constant, and a guess until there is usage.
- **Whether a shop should be learnable without a receipt** — a manual "remember
  this place" for somewhere the user shops without keeping receipts. Cheap, and
  it weakens the argument that the list cannot become a place database.
