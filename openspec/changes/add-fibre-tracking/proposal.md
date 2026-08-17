## Why

Fibre does not exist in this app. Not in `Macros`, not in `meal_items`, not in
the estimation prompt, not in the profile's targets. Asking the app which of
your macros is short today can only answer for protein, carbs, and fat, because
those are the only three it has ever recorded.

It is the macro people most often want a nudge about, and it is the one the
pantry is best placed to help with — beans, oats, greens, and wholegrains are
exactly the things sitting in a stocked kitchen.

Prerequisite for `add-macro-gap-suggestions`, and independently useful.

## What Changes

- **`meal_items.fibre_g`, nullable.** Nullable is the important part: every meal
  logged before this change has *unknown* fibre, not zero, and the two must not
  be confused.
- **Fibre is derived after resolution.** The image pass identifies foods and
  quantities; it does not visually estimate fibre. After canonical/barcode
  resolution, Mise derives fibre from structured nutrition data and uses a
  text-only fallback when no structured value exists. Legacy `fibre_g` model
  responses remain parseable but are not the preferred source.
- **A daily fibre target on the profile.** Unlike protein, carbs, and fat, fibre
  is **not a share of calories** — it is an absolute daily figure. So it cannot
  join `macroTargets`, which divides `targetCalories` by a percentage split. It
  needs its own field and its own default.
- **A fourth bar** on the Today screen, alongside the existing three.
- **Days with incomplete data say so.** A day containing any meal with unknown
  fibre reports its fibre as incomplete rather than summing the known ones and
  presenting the result as a total.

## Capabilities

### New Capabilities

- `fibre-tracking`: Recording dietary fibre per meal item, targeting it daily,
  and reporting it honestly when the underlying data is incomplete.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Other micronutrients.** Sodium, sugar, saturated fat, and the rest are the
  same shape of work and can follow the same pattern if they earn it. Adding
  four fields nobody asked for is how a clean schema becomes a nutrition
  database.
- **Backfilling historical meals.** The data was never captured and cannot be
  recovered. Re-estimating old photos would spend money to manufacture figures
  the user never saw and cannot check.
- **Soluble versus insoluble fibre.** One number.
- **Changing the calorie or macro model.** Fibre sits alongside; nothing about
  the existing three changes.

## Impact

**Schema.** The existing fibre migration adds nullable `meal_items.fibre_g`
and a fibre target column on `profile`. If canonical or barcode nutrition
records need new fibre/source fields, those additions must be appended through
one forward-only migration after the live schema ledger is checked.

**Code.**
- `src/api/prompt.ts`, `src/api/parse.ts` — the estimator identifies foods and
  quantities; fibre is derived after resolution.
- `src/logic/nutrition.ts` and resolution services — derive fibre after identity
  resolution, preserving source and confidence.
- `src/types.ts` — `Macros` gains `fibreG`, which is a widely-used type, so the
  compiler will enumerate every site that needs a decision.
- `src/logic/macros.ts` — a separate fibre target, deliberately outside
  `macroTargets`.
- `src/logic/scaling.ts` — summing must distinguish unknown from zero.
- `src/components/MacroBars.tsx`, the Today screen, and the profile sheet.

**Dependencies.** None added.

**Risk.** `Macros` is used in aggregation, the day store, scaling, and the
review screen. Widening it is mechanically simple and touches a lot, and the
temptation under compiler pressure will be to default `fibreG` to `0` at each
site — which is precisely the bug this change exists to avoid. A day with
unknown fibre reading "0 / 30 g" is decision 15's failure in a new place.
