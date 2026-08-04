## Context

See `proposal.md` — Why. Fibre is absent from every layer: `Macros` in
`src/types.ts` has calories, protein, carbs, and fat; `meal_items` has the same
three macro columns; `src/api/prompt.ts` asks for exactly those; and
`macroTargets` in `src/logic/macros.ts` divides `targetCalories` by a percentage
split, which is a shape fibre does not fit.

## Goals / Non-Goals

**Goals:**

- Fibre recorded where known, and provably distinguishable from zero where not.
- No day ever displays a fibre total it cannot actually compute.

**Non-Goals:**

- Other micronutrients, backfilling history, soluble/insoluble split. See the
  proposal.

## Decisions

### `fibreG` is `number | null` throughout, not `number`

`Macros.fibreG: number | null`, and the column is nullable.

*Why:* this is the whole change. The compiler will flag every aggregation,
every component, and every constructor of a `Macros`, and at each one the
tempting fix is `?? 0`. That default is exactly the bug — a day the app cannot
total would then read "0 / 30 g", which is a confident claim about food the user
ate and the app never measured. Decision 15's failure, in a new place.

Making the type nullable means the compiler asks the question at every site
rather than letting one silent default through.

### Summing propagates unknown rather than skipping it

`macrosOfMeals` returns `fibreG: null` when any contributing item is unknown,
and a number only when all are known.

*Why:* skipping unknowns and summing the rest produces a figure that is
arithmetically real and semantically a lie — it looks like a total and is
actually a lower bound. Propagating null makes the interface handle the case it
actually has.

*Alternative considered:* returning a total plus a "complete" flag, so the
partial sum is available. Rejected for now — nothing needs the lower bound, and
offering it invites displaying it.

### The fibre target is its own column, outside `macroTargets`

`profile.fibre_target_g`, defaulted at 30.

*Why:* `macroTargets` takes a calorie figure and a split whose parts sum to one.
Fibre is grams per day irrespective of intake, so forcing it in would mean
either a fake percentage or a function that means two different things depending
on which field is read. A separate column is honest about it being a different
kind of number.

*Why 30:* a common general adult guideline, and a round default the user can
change. The app makes no health claim about it (decision 64's spirit) — it is a
target the user owns, not advice.

### The prompt gains a field and the parser tolerates its absence

`fibre_g` is added to the schema block in `src/api/prompt.ts`; `parse.ts` treats
it as optional.

*Why:* the parser must not become stricter than it was. A model that omits the
field, or an older cached response, should yield a meal with unknown fibre
rather than a failed estimate — the calorie path is the app's core and must not
regress because a secondary field is missing.

## Risks / Trade-offs

**`?? 0` creeps in under compiler pressure** → widening `Macros` touches many
files at once, and zero silences the error. Mitigation: the spec makes
unknown-versus-zero a testable requirement, and a test asserts a pre-fibre day
does not read as zero.

**Estimate quality for fibre is unknown** → the model has never been asked for
it here, and fibre is harder to eyeball than protein. Mitigation: it is an
estimate like the others and is presented the same way; nothing depends on it
being precise, and `add-macro-gap-suggestions` treats it as a signal rather than
a measurement.

**A fourth bar crowds the day view** → four bars where three were balanced.
Mitigation: layout only, and the incomplete state needs a distinct treatment
anyway, so the component is being touched regardless.

## Migration Plan

One forward-only migration adding nullable `meal_items.fibre_g` and
`profile.fibre_target_g` defaulted to 30. Existing meal items keep null, which
is the correct value — their fibre genuinely is unknown.

`DROP_ALL` is unchanged; no new tables.

Rollback is additive: an older build ignores both columns.

## Open Questions

- **Whether the default should vary by sex or age.** Guidelines do differ. A
  single editable default is enough to ship, and changing it later alters one
  constant with no interface impact.
