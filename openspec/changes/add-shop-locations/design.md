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
of them is needed. Geofencing gives arrival and departure events at runtime;
nothing requires persisting them, so nothing does.

*The test that keeps it honest:* the stored data must be unable to reconstruct
movement. That is a property of the schema, not of the code, which is why it is
a requirement rather than a guideline — someone adding a `last_seen_at` column
for a reasonable-sounding cache would quietly cross the line.

### Geofencing rather than polling

OS-level region monitoring, entering and exiting.

*Why:* it is what the platforms provide for exactly this, it is
battery-efficient because the OS is already tracking regions for other apps, and
it delivers events rather than requiring the app to ask where the user is. An
app that polls position is an app that has a position to mishandle.

*Consequence:* the number of monitored regions is capped by the OS. If the user
learns more shops than the cap, monitor the nearest — which needs a position and
is the one place this change reads one directly.

### Shops are learned at receipt import

When a receipt is imported and permission is granted, record the coarse position
against the receipt's store name.

*Why at import rather than at capture:* the receipt is the thing that names the
store. A photograph taken in a shop knows where it was and not what it was.

*Why coarse:* a supermarket is a large building and a geofence radius is
hundreds of metres. Storing a precise position buys nothing and stores more than
is needed.

*Why this beats a places database:* argued in the proposal. The short version is
that it works offline, carries no licence question — decision 144 is currently
holding an entire change behind exactly that — and it learns the Asian grocer on
the corner that no database lists and that decision 4's audience actually uses.

*The bootstrap cost, stated plainly:* nothing happens at a shop until a receipt
from it has been imported. That is a real limitation. It is also self-resolving,
explainable in a sentence, and free — importing the receipt was already the
thing the user was doing.

### Both prompts are offers, and neither acts

Arrival surfaces what is low or out. Departure offers capture. Neither changes
anything.

*Why:* every other automatic-seeming thing in this app lands on review first —
decision 95 for capture routing, decision 122 for pending captures. A feature
triggered by walking through a door is the last place to break that pattern,
because the user did not initiate it at all and may not even be shopping.

*Why arrival shows status rather than quantity:* decision 15. "Running low on
soy sauce" is defensible; "you have 40 ml left" standing in an aisle is a number
the app cannot justify and the user cannot check.

### The receipt's own header still wins

A recognised shop supplies a store name only when the receipt does not.

*Why:* the receipt is direct evidence and the geofence is circumstantial. Someone
can buy a coffee at the shop next door, or shop at two places in one trip. Where
both are available the printed header is the better source, and the geofence is
the fallback it never had.

## Risks / Trade-offs

**The permission is the app's first, and asking costs trust** → mitigated by
asking in context rather than at launch, explaining before requesting, and
degrading fully. It is still a real cost and the proposal weighs it explicitly
rather than assuming the feature is worth it.

**Geofence accuracy in dense retail** → shops next to each other will produce
wrong matches, and a shopping centre may be one region. Accepted: both prompts
are offers, so a wrong match costs a dismissed prompt. This is the reason
neither prompt acts.

**Battery and background execution** → region monitoring is cheap; a mistake in
how it is registered is not. Measured in the tasks rather than assumed.

**The cap on monitored regions** → a user with many shops exceeds it. Mitigation:
monitor the nearest, and say so where shops are managed.

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

Rollback removes the geofence registration; the app returns to today's
behaviour and the table is inert.

## Open Questions

- **Whether departure or arrival is the better capture prompt.** Departure is
  argued here because the receipt is in hand and the shopping is not yet put
  away. Arrival might catch the user with more patience. Measurable only in use.
- **How long "shortly after being at a known shop" should be** for the receipt
  matching fallback. A named constant, and a guess until there is usage.
- **Whether a shop should be learnable without a receipt** — a manual "remember
  this place" for somewhere the user shops without keeping receipts. Cheap, and
  it weakens the argument that the list cannot become a place database.
