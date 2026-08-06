## Why

The moment a pantry app is most useful is the moment it is least reachable: you
are standing in a shop, and you cannot remember whether you have soy sauce.

And the moment groceries are easiest to capture is the one right after — walking
out with the bags, receipt in hand, before anything is put away. Decision 60 says
the pantry populates itself, and the receipt is how; but nothing prompts, so it
happens when the user remembers.

Both are the same missing fact: **the app does not know you are at a shop.**

There is a third, quieter payoff. `src/logic/normalise.ts` already takes an
optional store and consults that store's brand prefixes first — the machinery
for store-aware receipt matching exists and currently depends on the receipt
naming its own store legibly. Knowing which shop the receipt came from makes it
work when the header is smudged.

## This reverses a stated non-goal, deliberately

`add-venue-inference` lists location as a non-goal, and the reasoning was:

> Position would be a strong signal and a poor trade — it needs a permission the
> app has never asked for, against a privacy story (decision 5) that is one of
> its better properties. Not worth it for a default.

That reasoning was correct **for what it was weighing**: a permission, against
slightly better odds on a control the user can already fix in one tap.

This change weighs the same permission against something much larger — being
reminded of what you are out of while you can still buy it, and being prompted
to capture a shop while the receipt is in your hand. The trade is different, so
the conclusion can be different, and saying that out loud is the point.

Three things keep decision 5 intact rather than merely traded away:

- **Position never leaves the device.** Geofencing is an OS service; there is no
  server to send it to and this change does not add one.
- **No location history is stored.** The app stores *where a shop is*, not where
  the user has been. Those are different databases and only one of them is a
  liability.
- **The permission is optional and everything works without it.** Every feature
  here has a manual equivalent that already exists.

What it does **not** do is reopen venue inference. Once the permission exists,
"is this meal being eaten at a restaurant" becomes answerable from position, and
that is a genuinely different question that should be decided on its own merits
rather than inherited because the permission happens to be there.

## What Changes

- **The app learns your shops from your receipts**, not from a downloaded
  database. Import a receipt with location granted, and the shop is remembered.
- **Arriving at a known shop surfaces what you are out of** — running low and
  out, from stock the app already tracks.
- **Leaving a known shop offers to capture the shop**, routing to the existing
  capture surface.
- **A recognised shop names itself to receipt matching**, so store-brand prefix
  stripping works without a legible header.
- **Nothing is automatic.** The app prompts; it never adds, decrements, or
  captures on its own.

## Capabilities

### New Capabilities

- `shop-locations`: Knowing when the user is at a shop they use. Covers learning
  shops from receipts rather than a database, what is stored and what is
  refused, arrival and departure prompts, feeding store identity to receipt
  matching, and working fully without the permission.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Any location leaving the device.** No server, no analytics, no third party.
  Decision 5.
- **A location history.** The app records shop positions, never visits. It
  cannot answer "where was I on Tuesday" and must not become able to.
- **A downloaded points-of-interest database.** Self-populating from the user's
  own receipts, per decision 60's spirit — and it avoids a licensing question,
  since the obvious source is ODbL (see decision 144).
- **Background capture, or automatic anything.** No silent stock changes, no
  automatic receipt import, no notifications the user did not ask for beyond the
  two prompts described.
- **Venue inference from position.** Explicitly out of scope. See above.
- **Shopping list management.** "What you are out of" is computed from stock the
  app already has. A curated, editable list is a different change.
- **Requiring the permission.** Everything degrades to what exists today.

## Impact

**Schema.** One migration: known shops, with a name, a coarse position, and a
link to the store name receipts use.

**Code.**
- `src/logic/shops.ts` — new, pure: matching a position to a known shop, and
  computing what is worth buying.
- `src/db/queries.ts` — shop CRUD, and the running-low-or-out query.
- `src/logic/receiptService.ts` — record the shop on import when granted.
- `src/logic/normalise.ts` — no change; it already takes a store.
- A permission request, a settings surface, and the two prompts.

**Dependencies.** `expo-location`, for geofencing. The first new runtime
dependency in several changes, and the reason the trade above is written out.

**Depends on** `add-receipt-import` (merged) for the shop-learning path and for
the store-aware normalisation this feeds.

## Why the shop list is learned rather than downloaded

The obvious implementation fetches nearby supermarkets from a places database.
That is worse on three counts.

It needs the network at exactly the moment the user is in a shop, which is
where signal is worst. It imports a licensing question the project has already
decided to be careful about — the best open source is ODbL, and decision 144 is
currently holding a whole change behind exactly that. And it knows about
thousands of shops the user will never visit, while knowing nothing about the
Asian grocer on the corner that has no useful listing and is precisely where
decision 4's audience shops.

Learning from receipts inverts all three. It works offline, it carries no
licence, and it learns the shops this person actually uses — including the ones
no database has. It also costs nothing to bootstrap, because importing that
first receipt is something the user was doing anyway.

The cost is that the feature does nothing until the first receipt from a shop is
imported. That is honest, it is explainable in one sentence, and it means the
feature gets better exactly as the app gets more useful.
