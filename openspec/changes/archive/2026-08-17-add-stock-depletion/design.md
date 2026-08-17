## Context

See `proposal.md` — Why. This depends on `add-identity-layer` for resolving a
meal item to a canonical ingredient, and on `add-pantry-stock` for something to
decrement.

What already exists and is reused unchanged:

- `meals` and `meal_items` carry per-item name, quantity, and unit. The
  estimation prompt already asks for a per-item breakdown rather than one lumped
  total, which is what makes this possible at all.
- `likely_hidden_ingredients` and the quick-pick grid already capture the oils
  and sauces a camera cannot see, with a typical amount per entry.
- `src/logic/units.ts` exists but is **not** the home for this work — it holds
  body measurements (`cmToFeetInches`, `kgToLb`, `formatHeight`) and shares
  nothing with food measures but the word "units".

The governing constraint is that every input is an estimate. Vision portion
figures carry substantial error, and the design's job is to stay useful under
that error rather than to pretend it away.

## Goals / Non-Goals

**Goals:**

- The catalogue stays roughly true with no maintenance effort from the user.
- The app's confidence is represented in the data, so it can say less when it
  knows less.
- Every automatic change is explainable and reversible.

**Non-Goals:**

- Accuracy in grams. The output is a restock signal; being 20% wrong about when
  rice runs out is fine, and chasing precision here buys nothing.
- Inferring consumption from anything other than a logged meal. No time-based
  decay, no "you probably used some".
- Deciding *what to do* about low stock. That is restock suggestions, later.

## Decisions

### Depletion is a pure function that returns intentions, not a procedure that mutates

`planDepletion(meal, multiplier, catalogue, canonicals): Decrement[]` in
`src/logic/deplete.ts`. Applying the returned list is a separate, thin
transaction in `queries.ts`.

*Why:* the interesting logic — class dispatch, unit conversion, ownership
matching, the refusal to guess — is all decision-making, and it is far easier to
test exhaustively as a function from inputs to a list of intended changes than
as a sequence of database writes. It also makes the reversal path trivial,
because a `Decrement` negated is its own undo.

### Reversal is replay-based, not compensating

Editing a committed meal deletes its consumption events, restores the amounts
they recorded, then applies a freshly planned set.

*Why:* computing a compensating delta between old and new meals means getting
the diff right for added items, removed items, changed quantities, and a changed
multiplier simultaneously. Reverse-then-reapply has one code path and cannot
drift out of agreement with itself. The events table exists precisely to make
this cheap.

*Trade-off:* an item touched by an edited meal briefly returns to its prior
amount mid-transaction. Invisible, since it happens inside one transaction.

### Leftovers are a meal venue, not a flag on items

`MealVenue = 'home' | 'out' | 'leftovers'`, one field.

*Why:* the servings multiplier and leftovers are the two halves of one
correction and are only right together — the multiplier debits the whole batch
up front, and leftovers must therefore debit nothing later. Modelling them as
one closed field makes it impossible to express the incoherent combination
(a leftovers meal with a multiplier of four).

*Alternative considered:* a boolean `is_leftovers` alongside the home/out flag.
Rejected: two booleans allow four states, of which one is nonsense.

### Unit conversion is a total function returning an optional result

`convert(qty, from, to, canonical): number | null`. `null` means "not
convertible", and the caller falls back to counting a use.

*Why:* the spec forbids inventing factors, and the cheapest way to enforce that
is to make "I don't know" a value the type system forces the caller to handle.
A function that returns a number has no way to express uncertainty, and the
tempting default — assume 1 g/ml, or a 100 g piece — silently produces confident
nonsense in the exact place decision 15 says the app must not.

Fixed conversions (tbsp, tsp, cup to ml) live in the function. Ingredient-
dependent ones (density, weight per piece, per slice, per serving) come from the
canonical ingredient, and their absence is what returns `null`.

### Matching prefers the item the user actually opened

For each consumed canonical ingredient, candidate pantry items are ranked by: in
stock, then opened, then nearest expiry, then oldest. One item is decremented,
not several.

*Why:* this mirrors the ownership bias the identity layer already applies to
name resolution, and the nearest-expiry tiebreak is deliberate — cooking from
the oldest stock is what the user would do and what the dinner decision will
later recommend, so the model should assume it.

*Alternative considered:* spreading a decrement across several matching items.
Rejected — it makes every item slightly wrong instead of one item mostly right,
and it makes reversal ambiguous.

### Drift is a counter, and it gates what the interface asserts

`estimated_decrements_since_anchor` on `pantry_items`, incremented on each
estimated decrement and zeroed by any anchor: a receipt, a fullness setting, a
user-entered quantity.

Above `DRIFT_LIMIT` (initially 8), `stockStatus` returns its result marked
unconfident, and the interface qualifies rather than asserts.

*Why:* this is what makes decision 15 honest rather than aspirational. "Running
low" after two estimated decrements and after twenty are different claims, and a
product whose whole pitch is trustworthiness should not state them identically.
It is also the trigger for asking a fullness question at the one moment the
question is worth asking — which is how the spec's "prompt on suspicion, not on
a schedule" rule gets implemented.

*Why a count rather than a computed error bound:* an error bound implies a
rigour the inputs do not support. A count is honest about being a heuristic.

### Receipts re-anchor by resetting, not by adding

When a receipt records a purchase of an ingredient already in the catalogue, the
matching item's amount is *set* to the purchased quantity and its drift counter
zeroed.

*Why:* this is the self-correcting loop the product depends on — receipts set
truth, meal logs interpolate between them. Adding the purchase to a drifted
estimate compounds the error instead of clearing it. Setting discards the
accumulated drift, which is the point.

*Note:* a user who buys a second bottle while the first is half full gets a
reset rather than a sum. The catalogue models one item per container, so the
correct behaviour is a new pantry item for the new bottle — resetting applies
when the receipt matches an existing item rather than creating one. This
boundary is where the two changes meet and is called out in the tasks.

### A decrement demotes `qty_source` away from `user`

`pantry_items.qty_source` distinguishes a figure the user typed from one the app
estimated. `pantryStore` gates its `userEnteredQty` field on it, rendering the
raw `qty_remaining` back as "your entry" only when the source is `user`.

So the first estimated decrement against a user-entered quantity must flip
`qty_source` to `estimated`.

*Why this is not a detail:* leave it as `user` and the pantry screen shows a
decremented estimate labelled as the figure the user typed. That is decision 15
violated through the write path — the view model was carefully built so no
component could render an indefensible number, and this would hand it one that
looks defensible. It is the same class of failure as the confirm-band leak in
`add-identity-layer`: a value laundering its provenance by travelling through a
route that restores trust it no longer deserves.

*Consequence:* a user who typed a quantity loses their echo after the first
meal that touches the item. Correct — it is no longer their figure. Setting
fullness or typing a new quantity restores it, and both are already anchors that
zero drift.

### Uncatalogued consumption is recorded with a null item

A consumption event with a canonical ingredient and no pantry item.

*Why:* it costs nothing, and it is the raw material for two later features —
offering to add frequently-eaten items, and answering "what do I actually cook
with" for the dinner decision. Discarding the row would throw away signal the
app already has.

## Risks / Trade-offs

**A confidently wrong catalogue is worse than no catalogue** → the failure that
ends the product is a user trusting "you have soy sauce" and finding an empty
bottle. Mitigation: drift tracking, qualified claims, and the refusal to invent
conversions — all specified as requirements rather than left to judgement.

**The servings question is friction on the most-used screen** → asked badly, it
taxes every meal log. Mitigation: optional, defaulted, remembered per dish, and
never blocking commit. If it proves annoying in use, the fallback is to ask only
when the meal has enough distinct items to look like cooking rather than
assembling.

**Compounding error on slow-burn staples** → a 5 kg rice bag decremented by
estimate twenty-five times could be far off. Mitigation: this is precisely what
receipt re-anchoring is for, and drift tracking makes the uncertainty visible
before it misleads.

**Reverse-then-reapply on edit is destructive if interrupted** → a crash
mid-transaction could leave stock restored but not reapplied. Mitigation: one
SQLite transaction around both halves.

**Hidden-ingredient quick-picks may not map to a canonical** → the link is
optional, added by `add-identity-layer` task 10.1. Mitigation: an unmapped
quick-pick contributes calories as it does today and decrements nothing, which
is the pre-existing behaviour and not a regression.

## Migration Plan

One migration taking `user_version` from 3 to 4:

- `consumption_events` per `docs/identity-layer.md`, plus the multiplier and a
  reversal marker.
- `pantry_items` gains `estimated_decrements_since_anchor` and `last_anchor_at`.
- `meals` gains `venue`, defaulting existing rows to home — the pre-existing
  assumption, and harmless since depletion is never retroactive.

`DROP_ALL` gains `consumption_events`.

Rollback is additive. An older build ignores the new table and the new columns;
stock stops moving automatically and the catalogue reverts to manual, which is
`add-pantry-stock`'s behaviour.

## Open Questions

- **The initial `DRIFT_LIMIT`.** Eight is a guess. It is a named constant and
  tuning it changes no interface, no schema, and no task.
- **Whether to ask for servings on every home-cooked meal or only on meals that
  look cooked.** Both are one condition in the same place. Deferred until there
  is real usage to judge the friction against; the fallback is described above.
