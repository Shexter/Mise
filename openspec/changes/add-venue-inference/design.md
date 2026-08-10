## Context

See `proposal.md` — Why, and its closing note on why the two mistakes are not
equally costly.

Baseline when this change was planned: `app/review.tsx` held `venue` in state,
defaulting to `'home'` and then to whatever was chosen last; `MEAL_VENUES` and
`MealVenue` already existed in `src/types.ts`; `src/api/prompt.ts` said nothing
about venue; and `consumption_events` already recorded `servings_mult`.

## Goals / Non-Goals

**Goals:**

- The user changes the venue rarely, and can always change it instantly.
- No new request, no new permission, no new latency.
- The bias under uncertainty is chosen deliberately rather than falling out of
  the implementation.

**Non-Goals:**

- Removing the control, applying a guess silently, GPS, new venue values,
  inferring servings. See the proposal.

## Decisions

### A cooked suggestion is a fact, and facts do not get inferred

`src/logic/suggestionService.ts:218` hardcodes `venue: 'home'` on the
cooked-a-suggestion path. That shipped with `add-dinner-decision` after this
change was planned, and it is correct — inference must not touch it.

*Why it needs saying rather than being obvious:* this change adds a preselection
step in front of the review screen, and the natural implementation applies it to
every meal arriving there. Running a probabilistic guess over a meal whose origin
the app *knows* is a strict downgrade — certainty replaced by a weighted
opinion, occasionally wrong about a dinner the user cooked from the app's own
suggestion.

*Why it teaches nothing either:* the learned per-dish default must not record
from this path. The suggestion engine only ever produces meals the user cooked,
so the path can only ever emit `home`. Learning from it fills the table with a
value carrying no information about the user's habits, which then ranks
alongside real evidence — a dish someone cooks once from a suggestion and
otherwise always buys would acquire a home default from the single occasion the
app already knew about.

*Generalises:* any path where the venue is known by construction — importing a
restaurant receipt, say — takes the same treatment. The requirement is written
about known venues rather than about suggestions specifically.

### The venue assessment rides in the existing estimate request

One optional field in `src/api/prompt.ts`'s schema, parsed optionally.

*Why:* the model is already looking at the photograph in order to name the food.
Whether the plate is on a restaurant table is visible in the same image, and a
second request would double the cost and latency of every photo log to answer
something the first request is already positioned to answer. Same reasoning as
decision 94 for capture routing.

*Why optional in the parser:* the calorie path is the app's core. A model that
omits the field, or an older cached response, must still produce a meal.

### Four peer signals, combined through a pure function

`inferVenue(assessment, stockMatch, outstandingPortions, learnedDefault)` in
`src/logic/venue.ts`. The learned default is optional, so the original
three-input call remains valid.

*Why pure:* the combination rule is the interesting part and it is a decision
table. The cases include model says out but everything matched stock, model
silent but a batch is outstanding, and nothing known at all. Camera and network
tests are the wrong level for a deterministic function.

### Stock match is a ratio, not a boolean

The share of the meal's items resolving to canonicals currently in stock.

*Why:* "some ingredients matched" is the common case for both venues — a
restaurant dish contains chicken and you own chicken. A ratio separates *made
from my pantry* from *coincidentally contains things I also own*, and a
threshold on it is tunable where a boolean is not.

### Outstanding portions come from the events already written

A batch logged with a multiplier of four, against how many meals of that dish
have since been logged as leftovers.

*Why:* decision 10 already records that a batch made four portions, and decision
51 already records leftovers as a venue. The arithmetic between them was never
read, and reading it is what lets the app offer leftovers unprompted rather than
waiting for the user to remember the option exists.

### Uncertainty resolves to home, deliberately

See the proposal's closing section. Stated here because it is the kind of default
that otherwise gets changed later by someone who assumes it was arbitrary: a
missed decrement breaks decision 3's promise and the user finds out mid-cook,
while a phantom decrement is corrected by decision 55's receipt re-anchor and
softened by decision 53's drift counter in the meantime.

### The learned default is per dish name, and is a signal rather than an override

A small table keyed on the normalised dish name.

*Why per dish:* venue is a property of what you are eating far more than of the
day. Someone cooks at home most nights and always buys the same Friday takeaway;
a global sticky default gets that wrong every week, and a per-dish one gets it
right without being told.

*Why a signal rather than an override:* a learned "out" should not survive a
photograph that plainly shows a home kitchen and a meal made entirely of stock.
Ranking it with the others keeps the strong evidence winning.

## Risks / Trade-offs

**A wrong home guess debits stock that never left** → mitigated by design rather
than avoided: the guess is visible and preselected, correcting it is one tap, the
depletion confirmation already shows what moved, and receipt re-anchoring
repairs the amount on the next shop.

**Venue assessment quality is unmeasured** → the model has never been asked this
here. Mitigation: it is one of three signals rather than the decision, and the
tasks measure per-venue accuracy against fixtures before it is trusted.

**Per-dish learning entrenches an early mistake** → correct a dish once by
accident and it guesses wrong thereafter. Mitigation: a later correction replaces
the earlier one, and strong contrary evidence outranks a learned default.

**Manual entries have no photograph** → no assessment, so only local signals
apply. Mitigation: that is the uncertain case, and it resolves to home, which is
right for a typed entry far more often than not.

## Migration Plan

One forward-only migration adding a table of learned per-dish venue defaults.
Nothing on `meals` changes; existing meals keep the venue they were saved with.

`DROP_ALL` gains the table.

Rollback is additive: the control returns to its sticky default.

## Implementation Status

Implemented locally on 9 August 2026. The change is not archived pending owner
acceptance.

- Migration 11 adds `dish_venue_defaults`; `DROP_ALL` removes it.
- `venue_assessment` is optional and travels in the existing estimate request.
- `STOCK_MATCH_THRESHOLD` is `0.75`. This value is provisional until the real
  photograph corpus exists.
- Local ingredient resolution is read-only during preselection. It makes no
  provider request, writes no alias, and enqueues no unresolved match.
- Any disagreement among active signals resolves to `home`.
- Photo and manual flows infer. The cooked-suggestion flow remains known
  `home` and teaches no default.
- TypeScript, 526 tests, `git diff --check`, and strict OpenSpec validation pass.

Progress is 26 of 38 tasks. The remaining tasks require real photographs, a
configured provider, or owner testing in Expo Go or a standalone build.

## Open Questions

- **The stock-match threshold.** `0.75` is the implemented provisional value.
  The honest figure must come from real meals. The named constant changes no
  interface.
- **How long an outstanding batch stays outstanding.** Portions unaccounted for
  after a fortnight were probably thrown away rather than eaten. A cleanup rule
  over one query, addable later.
