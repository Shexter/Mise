## 1. Schema and types

- [x] 1.1 Append a migration adding nullable `meal_items.fibre_g` and
      `profile.fibre_target_g` defaulted to 30. Existing rows keep null, which
      is correct — their fibre is genuinely unknown.
- [x] 1.2 Widen `Macros` in `src/types.ts` with `fibreG: number | null`.
      **Nullable, not `number`.** The compiler will now flag every site; do not
      silence any of them with `?? 0`.
- [x] 1.3 Add the fibre target to the `Profile` type.
- [x] 1.4 Verify the migration runs from the current head and `npm run typecheck`
      lists the sites needing a decision.

## 2. Estimation

- [x] 2.1 Remove fibre as a required image-estimation field; keep food identity
      and quantity as the post-resolution inputs.
- [x] 2.2 Keep `src/api/parse.ts` backward-compatible with legacy `fibre_g`
      responses without treating them as the preferred source.
- [x] 2.3 Test parsing with the field present, absent, and null.

## 2a. Post-resolution fibre derivation

- [x] 2a.1 Add fibre fields/source metadata to canonical and barcode-product
      nutrition records where the source can defend them.
- [x] 2a.2 Implement post-resolution derivation: product, catalogue, text-only
      fallback, then nullable unknown.
- [x] 2a.3 Keep fibre provenance/confidence separate from photo confidence and
      identity confidence.
- [x] 2a.4 Test mixed greens, structured-source precedence, quantity scaling,
      text-only fallback, and no-source unknown behavior.

## 3. Aggregation

- [x] 3.1 Make `macrosOfMeals` in `src/logic/scaling.ts` return `fibreG: null`
      when any contributing item is unknown, and a number only when all are
      known.
- [x] 3.2 Do **not** skip unknowns and sum the rest. That produces a lower bound
      wearing a total's clothing.
- [x] 3.3 Add the fibre target to `src/logic/macros.ts` as its own value,
      outside `macroTargets` — fibre is grams per day, not a share of calories.
- [x] 3.4 Unit-test: all-known sums, any-unknown yields null, and an empty day.

## 4. Storage

- [x] 4.1 Persist and read `fibre_g` through `src/db/queries.ts`, preserving
      null.
- [x] 4.2 Include the fibre target in the daily target row so a past day keeps
      the target that was active then, matching how calories already behave.
- [x] 4.3 Test that a meal saved without fibre reads back as unknown, not zero.

## 5. Surface

- [x] 5.1 Add a fourth bar to `src/components/MacroBars.tsx`. Tokens from
      `src/constants/theme.ts`, no literals.
- [x] 5.2 Give an incomplete day a visually distinct treatment — not a bar at
      zero. A day the app cannot total must not look like a day the user ate no
      fibre.
- [x] 5.3 Add the fibre target to the profile sheet as an editable figure.
- [x] 5.4 Present the target as the user's own, making no health claim about the
      default (decision 64's spirit).

## 5a. The gap that must not be computed

`add-macro-gap-suggestions` turns a shortfall into a suggestion. A fibre
shortfall computed from an incomplete day would say "you need 12 g more fibre"
when the truth is that the app does not know what you have had — which is the
one sentence this whole change exists to prevent, arriving through a different
door.

- [x] 5a.1 Make the shortfall calculation return no fibre gap when the day's
      fibre is null. Not a gap of zero, and not a gap computed from the known
      part.
- [x] 5a.2 Say why rather than showing nothing. "Fibre isn't fully known for
      today" is a state the user can act on by editing a meal; a silently absent
      row is not.
- [x] 5a.3 Leave the other macros' gaps unaffected — an unknown fibre figure says
      nothing about protein.
- [x] 5a.4 Test an incomplete day, a complete day with a gap, and a complete day
      with none.

## 5b. Export

- [x] 5b.1 Confirm `exportEverything` carries `fibre_g`, adding it if the export
      enumerates columns.
- [x] 5b.2 Confirm unknown exports as null, not `0`. The export is the copy the
      user keeps; a zero there outlives the app's own careful handling.
- [x] 5b.3 Test an export containing both a meal with fibre and one without.

## 6. Verification

- [ ] 6.1 Log mixed greens with a real key and confirm food/quantity are first
      identified, then fibre is derived after resolution and stored.
- [ ] 6.2 **Open a day whose meals predate this change and confirm its fibre
      reads unknown, not "0 / 30 g".** This is the requirement the whole change
      exists to protect.
- [ ] 6.3 Confirm a day mixing known and unknown meals reads incomplete.
- [ ] 6.4 Confirm changing the calorie target leaves the fibre target unchanged.
- [x] 6.5 Grep the diff for `?? 0` and `|| 0` on any fibre path and justify or
      remove each one.
- [x] 6.6 Run `npm run typecheck` and `npm test`, then record the default target
      in `docs/product-decisions.md`.
