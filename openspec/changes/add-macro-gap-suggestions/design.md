## Context

See `proposal.md` — Why. `add-dinner-decision` is shipped: it has a
`tonight`/`stretch` request mode, `suggestionService`, prompt/provider facade,
cache rows keyed by mode, dietary filtering, dish scoring, and a shared
cook-this route. `MacroBars` renders the gap; `DailyTarget` and
`macrosOfMeals` produce it; `mealTypeForTime` maps the clock to a meal type.

`CanonicalItem` now carries nullable per-100 g calories, protein, carbohydrate,
and fat. Missing nutrition is an honest unknown, not zero. Fibre belongs to the
independent fibre-tracking change.

## Goals / Non-Goals

**Goals:**

- The gap on screen becomes actionable at the point it is stated.
- The answer is proportionate — to the shortfall and to the hour.
- One extension of the shipped engine, without changing existing requests.
- Macro contribution claims only where catalogue nutrition is known.

**Non-Goals:**

- A second engine, nutrition advice, prompting, calorie gaps, supplements, or
  an unlabelled estimate that pretends to be catalogue data.

## Decisions

### Extend the existing request mode and cache identity

Add a macro-gap request mode, including its targeted macro, to the established
request context and cache identity. It reuses the service's stock load,
API-key handling, dietary exclusion, canonical-id validation, and meal-logging
route. Tonight and stretch retain their existing modes and cache rows.

*Why:* the real system already centralises these safeguards. A parallel engine
would bypass them; encoding the targeted macro in cache identity prevents
protein, carbohydrate, and fat requests from sharing a response. Append a
forward-only migration if the current cache table cannot represent that identity.

### Ranking is macro-first, expiry as tiebreak — the inverse of dinner

`gapScore(item, canonical, macro)` first excludes canonicals whose target-macro
nutrition is unknown, then ranks known contributors by defensible contribution
for available quantity. Expiry breaks ties only within a comparable
contribution band.

*Why the inversion matters:* the dinner decision's objective is clearing stock,
with calories as context. This objective is closing a nutritional gap, with
expiry as a bonus. An expiring cucumber is a good answer to "what should I cook"
and a useless answer to "I need 127 g of protein". Getting this backwards
produces suggestions that are responsive to the wrong question, which is worse
than no suggestion because it looks like an answer.

### Partial coverage is explicit before the model is asked

The local service computes eligible contributors and their best achievable
contribution before prompting. If no known-nutrition stock can support the
target macro, it returns an insufficient-data outcome rather than inventing a
claim. If coverage is partial, the prompt and surface distinguish the known
contribution from the unmeasured remainder.

*Why:* 49 of 77 current catalogue entries have usable nutrition. Treating the
others as zero would rank and explain a false result; treating them as known
would be equally dishonest.

### One request may supply a labelled recipe estimate

The suggestion response adds optional whole-dish estimated calories, protein,
carbohydrate, and fat. At acceptance, local canonical calculation takes
precedence for known ingredients and quantities. The provider estimate fills
only the remaining recipe-level uncertainty and stays labelled as an estimate.
No provider request runs after **I cooked this**.

*Why:* a second call would cost more, fail offline, and can disagree with the
recipe the user accepted. Asking in the initial structured response gives the
user one coherent draft while preserving the traceable local calculation.

### Unknown recipe nutrition remains unknown after acceptance

Meal storage permits nullable calories, protein, carbohydrate, and fat for a
cooked suggestion. At acceptance, every nutrient is calculated locally when
all used canonical quantities can defend it; otherwise the initial provider
estimate for that nutrient is used. If neither source supplies it, the stored
meal value is null. Ingredient identity and pantry depletion still commit.

Daily aggregation propagates null for each affected nutrient. The Today and
meal-detail surfaces state that the value is unavailable rather than showing
zero. A macro-gap request for a macro whose consumed day total is unknown
returns insufficient data, because no defensible shortfall exists.

*Why:* an optional provider estimate cannot be a hidden requirement for logging
food the user actually cooked. Replacing an unknown value with zero would make
both the log and a later macro-gap suggestion false.

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

**Partial catalogue coverage** → a useful pantry item may be absent from the
ranked set. Mitigation: make the limitation visible and never manufacture its
macro contribution.

**Provider estimate is wrong or unavailable** → preserve the local known value,
label the unresolved remainder, and allow ordinary meal logging without a new
request; unresolved nutrients remain null through storage and totals.

**Fibre is not available yet** → defer it until `add-fibre-tracking` supplies
the field and its provenance rules.

**Cache collisions across objectives** → a dinner set served to a macro-gap
request would be wrong and would look like a bug in the model. Mitigation: the
objective is part of the fingerprint, specified as a requirement.

## Migration Plan

Append forward-only migrations for cache identity and nullable core meal
nutrition. The meal migration recreates `meal_items` with nullable nutrient
columns while retaining ids, ingredient identity, ordering, and foreign keys.
Existing numeric values are copied unchanged. Existing cache rows remain valid
for their stored mode; macro-gap starts with empty cache rows.

Rollback is a straight revert; the bars stop being pressable.

## Open Questions

- **Whether "comparable contribution" is a ratio or an absolute band.** A
  measurement once real kitchens are ranked; it changes one function and no
  interface.
