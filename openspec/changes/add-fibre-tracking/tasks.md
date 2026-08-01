## 1. Schema and types

- [ ] 1.1 Append a migration adding nullable `meal_items.fibre_g` and
      `profile.fibre_target_g` defaulted to 30. Existing rows keep null, which
      is correct — their fibre is genuinely unknown.
- [ ] 1.2 Widen `Macros` in `src/types.ts` with `fibreG: number | null`.
      **Nullable, not `number`.** The compiler will now flag every site; do not
      silence any of them with `?? 0`.
- [ ] 1.3 Add the fibre target to the `Profile` type.
- [ ] 1.4 Verify the migration runs from the current head and `npm run typecheck`
      lists the sites needing a decision.

## 2. Estimation

- [ ] 2.1 Add `fibre_g` to the schema block in `src/api/prompt.ts`.
- [ ] 2.2 Make `src/api/parse.ts` treat it as optional — a response omitting it
      yields unknown fibre, never a parse failure. The calorie path must not
      regress because a secondary field is missing.
- [ ] 2.3 Test parsing with the field present, absent, and null.

## 3. Aggregation

- [ ] 3.1 Make `macrosOfMeals` in `src/logic/scaling.ts` return `fibreG: null`
      when any contributing item is unknown, and a number only when all are
      known.
- [ ] 3.2 Do **not** skip unknowns and sum the rest. That produces a lower bound
      wearing a total's clothing.
- [ ] 3.3 Add the fibre target to `src/logic/macros.ts` as its own value,
      outside `macroTargets` — fibre is grams per day, not a share of calories.
- [ ] 3.4 Unit-test: all-known sums, any-unknown yields null, and an empty day.

## 4. Storage

- [ ] 4.1 Persist and read `fibre_g` through `src/db/queries.ts`, preserving
      null.
- [ ] 4.2 Include the fibre target in the daily target row so a past day keeps
      the target that was active then, matching how calories already behave.
- [ ] 4.3 Test that a meal saved without fibre reads back as unknown, not zero.

## 5. Surface

- [ ] 5.1 Add a fourth bar to `src/components/MacroBars.tsx`. Tokens from
      `src/constants/theme.ts`, no literals.
- [ ] 5.2 Give an incomplete day a visually distinct treatment — not a bar at
      zero. A day the app cannot total must not look like a day the user ate no
      fibre.
- [ ] 5.3 Add the fibre target to the profile sheet as an editable figure.
- [ ] 5.4 Present the target as the user's own, making no health claim about the
      default (decision 64's spirit).

## 6. Verification

- [ ] 6.1 Log a meal with a real key and confirm fibre is estimated and stored.
- [ ] 6.2 **Open a day whose meals predate this change and confirm its fibre
      reads unknown, not "0 / 30 g".** This is the requirement the whole change
      exists to protect.
- [ ] 6.3 Confirm a day mixing known and unknown meals reads incomplete.
- [ ] 6.4 Confirm changing the calorie target leaves the fibre target unchanged.
- [ ] 6.5 Grep the diff for `?? 0` and `|| 0` on any fibre path and justify or
      remove each one.
- [ ] 6.6 Run `npm run typecheck` and `npm test`, then record the default target
      in `docs/product-decisions.md`.
