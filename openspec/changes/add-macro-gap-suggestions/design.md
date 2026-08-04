## Context

See `proposal.md` — Why. This is the third objective for the engine
`add-dinner-decision` builds, not a parallel feature.

What already exists: `MacroBars` renders the gap, `DailyTarget` and
`macrosOfMeals` produce it, `mealTypeForTime` in `src/logic/dates.ts` already
maps the clock to a meal type, and `add-dinner-decision` supplies the payload
shaping, prompt, cache, and cook-this path.

## Goals / Non-Goals

**Goals:**

- The gap on screen becomes actionable at the point it is stated.
- The answer is proportionate — to the shortfall and to the hour.
- One engine, three objectives.

**Non-Goals:**

- A second engine, nutrition advice, prompting, calorie gaps, supplements.

## Decisions

### The objective is a parameter, not a branch

`suggest(objective, context)` where objective is
`dinner | stretch | macro_gap`. It selects the ranking function and an
instruction block; everything else — payload shaping, model call, parsing,
caching — is shared.

*Why:* three near-identical code paths would drift within two changes, and the
parts that must stay identical are the parts that took the most care: the
use-first constraint, the canonical-id contract, the refusal to invent
ingredients. A parameter keeps one copy of each.

*Why it belongs in `add-dinner-decision` from the start:* retrofitting a
parameter after a single-purpose engine exists means unpicking assumptions
baked into its signature. The identity layer did this correctly with ownership
bias — the mechanism shipped with an empty data source, and the later change
filled it without touching the shape.

### Ranking is macro-first, expiry as tiebreak — the inverse of dinner

`gapScore(item, canonical, macro)` ranks by contribution to the targeted macro,
then by urgency among comparable contributors.

*Why the inversion matters:* the dinner decision's objective is clearing stock,
with calories as context. This objective is closing a nutritional gap, with
expiry as a bonus. An expiring cucumber is a good answer to "what should I cook"
and a useless answer to "I need 127 g of protein". Getting this backwards
produces suggestions that are responsive to the wrong question, which is worse
than no suggestion because it looks like an answer.

### Scale comes from the gap and the clock, not a fixed shape

The payload states the shortfall, the hour, and `mealTypeForTime`'s answer, with
an instruction to size the suggestion accordingly.

*Why:* 127 g of protein short at 11pm and the same gap at 6pm are different
questions. Fixing the output at "a meal" makes the app useless at one of those
times, and the information needed to tell them apart is already computed.

### An unclosable gap is a first-class outcome

The engine reports the best achievable contribution alongside the shortfall, and
the interface states it.

*Why:* this is decision 15's family. Offering a 20 g suggestion against a 127 g
gap, framed as "here's what to eat", implies the problem is solved. The number
is real; the impression is false. Saying "this adds 20 g of the 127 you're
short" is the same suggestion told honestly, and it costs nothing.

### Pull-only, and it is a rule rather than a default

No prompt, no notification, no badge. The bar is pressable.

*Why:* a macro is below target most days — that is what a target means. An app
that remarks on it daily is decision 14's nagging in a new place, and the
mechanism that makes fullness checks tolerable ("on suspicion, not on a
schedule") applies with more force here, because the shortfall is not even a
problem most of the time.

## Risks / Trade-offs

**A technically-correct useless answer** → "eat 400 g of chicken" closes the gap
and helps nobody. Mitigation: the scale rule, and fixtures asserting that a late
small gap yields a small item rather than a slab of protein.

**Users read suggestions as advice** → the app suggests food containing a macro;
it is not telling anyone what they should eat. Mitigation: framing, and decision
64's rule against health claims applies unchanged.

**Fibre is the obvious case and does not exist yet** → the macro most people
want this for is the one the app does not record. Mitigation: `add-fibre-tracking`
is the prerequisite, and this change works for protein, carbohydrate, and fat
without it, so the two ship independently.

**Cache collisions across objectives** → a dinner set served to a macro-gap
request would be wrong and would look like a bug in the model. Mitigation: the
objective is part of the fingerprint, specified as a requirement.

## Migration Plan

No schema change. The suggestion cache gains an objective in its fingerprint,
which is a value change rather than a shape change, so nothing migrates.

Rollback is a straight revert; the bars stop being pressable.

## Open Questions

- **Whether "comparable contribution" is a ratio or an absolute band.** A
  measurement once real kitchens are ranked; it changes one function and no
  interface.
