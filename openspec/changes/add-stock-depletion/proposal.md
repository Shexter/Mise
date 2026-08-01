## Why

This is the mechanism the entire product rests on (decision 9). Every other
pantry app dies because it asks users to decrement stock by hand, and nobody
does. Mise has a signal nobody else has: the user already photographs what they
eat, for a reason they care about, and that record also says what left the
pantry.

Without this change, the catalogue is a list someone maintains manually — which
is the thing that has failed for every competitor. With it, the catalogue stays
roughly true on its own.

"Roughly" is the operative word, and it shapes the design more than anything
else. Vision portion estimates carry real error, and subtracting an estimate
from a bag of rice twenty-five times compounds it. The answer is not better
estimates; it is knowing how confident the app is and saying less when it is
less sure (decision 15).

Implements decisions 9, 10, 11, and 13.

## What Changes

- **New forward-only migration** adding `consumption_events`, plus drift-tracking
  columns on `pantry_items`.
- **Committing a home-cooked meal decrements matched pantry items.** Depletion
  runs on commit, not while the user is still editing on the review screen.
- **A servings multiplier** (decision 10). Cooking four portions and eating one
  debits the pantry four portions, not one. One tap at log time, defaulting to
  the last value used for that dish.
- **Leftovers log calories but never decrement.** Eating the other three
  portions must not debit the pantry again — it was already debited when the
  batch was cooked. This is the counterpart to the multiplier and the two are
  only correct together.
- **Meals eaten out never decrement** (decision 11), which requires the
  home-or-out flag at log time.
- **Depletion is per food class** (decision 12): mass for staples, use counts
  for seasonings and condiments, mass or consumption for perishables.
- **The hidden-ingredient quick-picks decrement too** (decision 13). Tapping
  "olive oil, 1 tbsp" already adds calories; it will also debit the oil, using
  the `defaultQuantity` and `unit` those entries already carry.
- **Unit conversion refuses to guess.** Where the factors needed to convert a
  logged unit into the stocked unit are absent, the system records the
  consumption without inventing a mass.
- **Drift tracking.** Each item counts estimated decrements since its last
  ground-truth anchor — a receipt, a fullness tap, or a manual quantity. High
  drift softens what the app claims and can prompt a fullness check.
- **Everything is reversible.** Deleting or editing a meal reverses its
  consumption events.

## Capabilities

### New Capabilities

- `stock-depletion`: How logging a meal changes pantry stock. Covers which meals
  decrement and which do not, the servings multiplier and leftovers, per-class
  decrement rules, unit reconciliation and its refusal to guess, the consumption
  event ledger and reversal, drift tracking and its effect on what the app
  claims, and behaviour when a consumed ingredient is not in the catalogue.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Changing calorie estimation.** The prompt, the parser, and the estimate are
  untouched. This change reads the meal that logging already produces.
- **Restock suggestions or shopping lists.** Depletion produces the signal;
  acting on it is a later change.
- **The dinner decision.** Consumes the resulting stock levels; specified
  separately.
- **Retroactively replaying history.** Meals logged before an item was
  catalogued do not decrement it. Replaying would silently rewrite stock the
  user believes they set, and the arithmetic would be built on estimates the
  user never had a chance to correct.
- **Spending.** Untouched here.

## Impact

**Schema.** One migration taking `user_version` from 3 to 4, adding
`consumption_events` and drift columns on `pantry_items`. `DROP_ALL` extended.

**Code.**
- `src/db/queries.ts` — consumption event writes, reversal, and the drift
  counters.
- `src/logic/measures.ts` — **new**, holding cross-type conversion and the
  refusal-to-guess rule. Deliberately not `src/logic/units.ts`: that module is
  body measurements and shares nothing with food measures but the word.
- `src/logic/stockStatus.ts` — gains the drift-aware result, and the
  `usesPerContainer` fix that closes decision 73.
- `src/logic/deplete.ts` — new, pure: given a meal, a multiplier, and a
  catalogue, produce the list of decrements to apply. Testable with no database.
- `app/review.tsx` — the servings control and the home-or-out flag.
- `src/constants/hiddenIngredients.ts` and `assets/hidden-ingredients.json` —
  the quick-picks gain their pantry side.
- `src/types.ts` — `ConsumptionEvent`, `MealVenue`.

**Dependencies.** None added.

**Depends on** `add-identity-layer` (resolving a meal item to a canonical
ingredient) and `add-pantry-stock` (something to decrement). Both must land
first.

**Risk.** This change can make the catalogue *worse* than manual maintenance if
it is confidently wrong. A user who trusts "you have soy sauce" and finds an
empty bottle stops trusting the whole list. The drift tracking exists precisely
so the app can say less when it knows less, and it is specified as a
requirement rather than left to judgement.
