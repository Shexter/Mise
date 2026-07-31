## 1. Schema and types

- [ ] 1.1 Append migration 4 to `MIGRATIONS` in `src/db/schema.ts` creating
      `consumption_events` per `docs/identity-layer.md`, with the servings
      multiplier and a reversal marker.
- [ ] 1.2 Add `estimated_decrements_since_anchor` and `last_anchor_at` to
      `pantry_items` in the same migration.
- [ ] 1.3 Add `venue` to `meals`, defaulting existing rows to home. Safe because
      depletion is never retroactive.
- [ ] 1.4 Extend `DROP_ALL` with `consumption_events`.
- [ ] 1.5 Add `ConsumptionEvent` and the `MealVenue` union
      (`home | out | leftovers`) to `src/types.ts`. One closed field, not two
      booleans — a leftovers meal with a servings multiplier must be
      inexpressible.
- [ ] 1.6 Verify the migration runs from `user_version = 3` and that
      `npm run typecheck` passes.

## 2. Unit conversion

Pure logic. No database, no network.

- [ ] 2.1 Extend `src/logic/units.ts` with
      `convert(qty, from, to, canonical): number | null`, where `null` means not
      convertible. The optional return is what enforces the refusal to guess —
      do not add a fallback factor.
- [ ] 2.2 Implement the fixed volume conversions (tbsp, tsp, cup to millilitres).
- [ ] 2.3 Implement ingredient-dependent conversions from the canonical
      ingredient: density for mass to volume, weight per piece, per slice, per
      serving.
- [ ] 2.4 Return `null` whenever a required factor is absent.
- [ ] 2.5 Unit-test each conversion path, and explicitly test that a missing
      factor returns `null` rather than a number.

## 3. The depletion planner

- [ ] 3.1 Implement
      `planDepletion(meal, multiplier, catalogue, canonicals): Decrement[]` in
      `src/logic/deplete.ts`. Pure — it returns intended changes and writes
      nothing.
- [ ] 3.2 Rank candidate pantry items per canonical ingredient: in stock, then
      opened, then nearest expiry, then oldest. Decrement one item, not several.
- [ ] 3.3 Dispatch by food class: reduce amount for staples, increment uses for
      seasonings and condiments, reduce or mark consumed for perishables.
- [ ] 3.4 Scale every decrement by the servings multiplier, including use counts.
- [ ] 3.5 Fall back to counting a use when `convert` returns `null`, leaving the
      remaining amount untouched.
- [ ] 3.6 Emit a decrement with a null pantry item where a consumed ingredient
      matches nothing in the catalogue. Never create a pantry item here.
- [ ] 3.7 Return an empty plan for meals whose venue is `out` or `leftovers`.
- [ ] 3.8 Unit-test the planner against fixture meals covering every class, the
      unconvertible case, the uncatalogued case, both non-home venues, and
      multipliers greater than one.

## 4. Applying and reversing

- [ ] 4.1 Add `applyDepletion` to `src/db/queries.ts`: write consumption events
      and apply the planned changes in one transaction.
- [ ] 4.2 Clamp any decrement that would take an item below empty, set its
      status to out, and record the clamp as drift evidence.
- [ ] 4.3 Increment `estimated_decrements_since_anchor` on each estimated
      decrement.
- [ ] 4.4 Implement reversal: delete a meal's consumption events and restore the
      amounts they recorded.
- [ ] 4.5 Implement edit as reverse-then-reapply inside one transaction — not a
      computed delta between the old and new meals.
- [ ] 4.6 Test that deleting a meal restores every affected item exactly, and
      that editing then re-committing never applies a decrement twice.

## 5. Anchors and confidence

- [ ] 5.1 Zero `estimated_decrements_since_anchor` and stamp `last_anchor_at`
      whenever the user sets fullness or enters a quantity.
- [ ] 5.2 Define `DRIFT_LIMIT` (initially 8) beside the existing threshold
      constants.
- [ ] 5.3 Extend `stockStatus` to mark its result unconfident above
      `DRIFT_LIMIT`, and qualify the wording in the interface rather than
      asserting it.
- [ ] 5.4 Offer a fullness check when an item is both drifted and approaching
      low — on suspicion, never on a schedule.
- [ ] 5.5 Add the receipt re-anchor path: a receipt matching an existing item
      *sets* its amount to the purchased quantity and zeroes drift. Adding to a
      drifted estimate compounds the error instead of clearing it.
- [ ] 5.6 Confirm the boundary with `add-pantry-stock`: a receipt matching an
      existing item re-anchors, while a receipt for a container the user does
      not yet have creates a new pantry item.

## 6. Meal logging surface

- [ ] 6.1 Add the venue control to `app/review.tsx` — home, out, or leftovers —
      defaulting to the value used most recently. Tokens from
      `src/constants/theme.ts`, no literals.
- [ ] 6.2 Add the servings control for home-cooked meals, defaulting to the last
      value recorded for that dish and otherwise to one. It must never block
      committing.
- [ ] 6.3 Persist the per-dish servings default so a repeated dish remembers its
      yield.
- [ ] 6.4 Trigger depletion on commit only, never during review editing.
- [ ] 6.5 Show a brief, dismissible confirmation of what was decremented, so the
      automatic change is visible rather than silent.

## 7. Hidden ingredients

- [ ] 7.1 Read the `canonicalId` added to `assets/hidden-ingredients.json` by
      `add-identity-layer` task 10.1.
- [ ] 7.2 Include quick-picks added to a meal in the depletion plan, using their
      existing `defaultQuantity` and `unit`.
- [ ] 7.3 Confirm an unmapped quick-pick still contributes calories and
      decrements nothing — the pre-existing behaviour, not a regression.

## 8. Verification

- [ ] 8.1 Log a home-cooked meal and confirm the matched staple, seasoning, and
      perishable each move according to their class.
- [ ] 8.2 Log the same meal as eaten out and as leftovers; confirm neither moves
      any stock and both record calories.
- [ ] 8.3 Log a four-serving batch, confirm a fourfold decrement, then log a
      leftover portion and confirm no further decrement.
- [ ] 8.4 Delete a committed meal and confirm every affected item returns
      exactly to its prior state.
- [ ] 8.5 Drive an item past `DRIFT_LIMIT` and confirm its status is qualified
      and a fullness check is offered.
- [ ] 8.6 Confirm adding a new pantry item does not replay historical meals.
- [ ] 8.7 Run `npm run typecheck` and `npm test`, then record the surviving
      `DRIFT_LIMIT` and the servings-prompt rule in `docs/product-decisions.md`.
