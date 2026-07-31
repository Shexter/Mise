## Context

See `proposal.md` — Why. `docs/identity-layer.md` sketches the `pantry_items`
shape this change implements.

Constraints:

- Depends on `add-identity-layer`. `canonical_items` supplies the food class,
  the per-location shelf life, and the typical package and use amounts that
  every calculation here reads.
- All SQL in `src/db/queries.ts`; migrations appended to `MIGRATIONS`, never
  edited.
- Decision 15 is a hard constraint on the data model, not just on copy: if a
  computed quantity must never be displayed, it must not be reachable by a
  component. Screens receive status, not grams.
- No test runner exists until `add-identity-layer` task 1.1 lands. This change
  assumes it has.

## Goals / Non-Goals

**Goals:**

- A catalogue that is useful before any capture flow exists, so the rest of the
  product can be built and tested against real data entered by hand.
- Expiry and status computed by pure functions that can be tested exhaustively
  without a database.
- The "never show a number" rule enforced structurally rather than by review.

**Non-Goals:**

- Any automatic change to quantity. Stock moves only by explicit user action
  here; `add-stock-depletion` adds the automatic path.
- Multi-unit inventory ("three tins of tomatoes"). One pantry item is one
  physical thing. Three tins are three items, which keeps opened-versus-unopened
  and per-item expiry coherent.
- Location-aware notifications or reminders.

## Decisions

### Locations are a table, not an enum

`locations` carries an id, a display name, a `kind`, and a sort order, seeded
with four rows.

*Why:* the spec requires renaming, adding, and removing. `kind` is the important
part — it is a closed set (`fridge`, `freezer`, `ambient`, `counter`) that the
shelf-life lookup keys off, while `name` is free text the user owns. A "Chest
freezer" and a "Garage freezer" are two locations of kind `freezer`, and both
get freezer shelf life without the lookup knowing either name.

*Alternative considered:* a free-text location string on the item. Rejected —
shelf life could then only be looked up by string matching, and renaming a
location would silently change every expiry date under it.

### Removing a location reassigns rather than cascades

Deleting a location with items requires choosing a destination first.

*Why:* the spec forbids losing items. `ON DELETE CASCADE` would delete them and
`ON DELETE SET NULL` would leave items with no location, which breaks expiry
recomputation. Forcing the choice is the only option that leaves the data
coherent.

### Expiry is computed on write, stored, and recomputed on the events that change it

`expires_at` is a stored column, recalculated when the item is created, marked
opened, moved between locations, or frozen — not derived on every read.

*Why:* the catalogue sorts and filters by expiry, so a stored indexed column is
what makes the main query cheap. The recompute triggers are few and explicit.
*Trade-off:* editing a canonical ingredient's shelf life does not retroactively
change items already computed from it. That is acceptable and arguably correct —
an item's predicted date should not silently shift under the user.

`expiry_source` records whether a date was predicted, read from a label, or
entered by the user, so a recompute never overwrites a date the user supplied.

### Opened life is a minimum, not a replacement

On opening, `expires_at` becomes the earlier of the existing prediction and
opening date plus opened shelf life.

*Why:* opening a tin of tomatoes with two years of unopened life left gives it
five days. But opening a bag of rice with a month left does not extend it to the
opened shelf life of a year. Taking the earlier of the two is right in both
directions; replacing unconditionally is wrong in the second.

### Status is a pure function, and screens never receive quantities

`stockStatus(item, canonical): StockStatus` in `src/logic/stockStatus.ts`. The
Zustand store exposes a view model carrying status, expiry, name, and location —
and not `qty_remaining` or `uses_count`.

*Why:* decision 15 says the app must never show an indefensible number. Enforcing
that by asking reviewers to notice is how it eventually leaks. If components
cannot reach the quantity, they cannot render it. The one exception the spec
allows — echoing a figure the user typed themselves — is carried as a separate,
explicitly-named field so its presence is deliberate.

### Thresholds live beside the match thresholds

`LOW_STAPLE_USES = 3`, `LOW_STAPLE_FRACTION = 0.15`, `LOW_SEASONING_FRACTION =
0.75`, `EXPIRING_SOON_DAYS = 3`, exported from one module.

*Why:* same reasoning as decision 32's thresholds — these are guesses until real
usage exists, and tuning should be one edit. A staple is low when it falls below
whichever is larger of three typical uses or 15% of a typical package, so both a
nearly-empty large bag and a small container behave sensibly.

### One pantry item is one physical thing

No quantity-of-containers column.

*Why:* opened state, expiry, and fullness are all per-container. A `count`
column forces every one of those to become either wrong or an array. Three tins
of tomatoes are three rows, and the interface groups them by canonical
ingredient for display.

*Trade-off:* adding a case of twelve tins creates twelve rows. Acceptable, and
the receipt and barcode flows can create them in a loop.

## Risks / Trade-offs

**Thresholds are guesses** → "running low" firing too early is nagging, too late
is useless. Mitigation: named constants, and the pure status function is exactly
what a fixture table tests exhaustively.

**Shelf-life data quality gates expiry usefulness** → a wrong shelf life
produces confidently wrong dates, which is worse than no date. Mitigation:
`expiry_source` makes predicted dates distinguishable from known ones in the
interface, and a user-entered date always wins.

**Item-per-container inflates row counts** → a big grocery haul creates many
rows. Mitigation: display groups by canonical ingredient, so the interface shows
"Tinned tomatoes ×12" while the data stays one row per tin.

**The catalogue is only as good as it is complete** → a half-entered pantry
gives wrong "do I have this?" answers, which is the question the feature exists
to answer. Mitigation: decision 24 — never gate the app on completeness — plus
making manual add fast enough to be worth doing.

## Migration Plan

One migration taking `user_version` from 2 to 3, adding `locations` and
`pantry_items` with indexes on status, expiry, and canonical id. Seeds the four
default locations in the same migration so a fresh install has them before any
screen loads.

`DROP_ALL` gains both tables. On *Delete all data*, locations return to the
shipped defaults because the migration reseeds them.

Rollback is additive: an older build ignores both tables.

## Open Questions

- **Whether discarded items stay visible.** A discard history is the raw
  material for a "food waste avoided" figure later, and that figure is central
  to how the product is sold. Keeping the rows costs nothing, so they are kept;
  whether they are ever shown is a later interface question that changes no
  schema.
