## Context

See `proposal.md` — Why, and `docs/dinner-decision.md` for the long-form design
this implements.

Reconciled against the code as it stands, which turned up two gaps the original
design assumed away:

- **`meal_items` has no canonical link.** Name, quantity, unit, macros, and
  nothing else. Depletion resolves every item by string. A recipe knows exactly
  which ingredient it means, and there is currently nowhere to put that.
- **There is no meal-history query.** `getMealsForDate` and `getLoggedDates`
  only. Personalisation — cuisine lean, repeat dishes, recently eaten — has no
  source today.

What does exist and is reused: `price_cents` on `pantry_items` (decision 35's
value-at-risk input), `daysUntil` and `expiresAt` for urgency, `isFreezable` in
`src/logic/expiry.ts`, the provider facade and error taxonomy, and
`src/api/resolve.ts` as the precedent for a non-vision model call.

## Goals / Non-Goals

**Goals:**

- Every suggestion is defensible: it clears something real, fits something real,
  or resembles something the user really cooks.
- Cooking a suggestion produces better depletion data than any photograph can.
- Suggestion quality is measurable rather than tuned by feel.

**Non-Goals:**

- A recipe library, tested recipes, scraping, shopping lists. See the proposal.
- Nutrition accuracy beyond the existing estimator.

## Decisions

### The engine reads stock through its own query, not through `PantryEntry`

`PantryEntry` deliberately omits `qtyRemaining`, `usesCount`, and `priceCents`.
The engine needs all three to rank urgency, so it reads from `queries.ts`
directly.

*Why this is not a loophole:* decision 15 constrains what is **displayed**, not
what is **computed**. The engine computes with quantities and prices and renders
neither — the reason chip says "saves $8 of stock", which is a price the user
actually paid at a till, not an estimated remaining mass. Keeping the display
model narrow while giving the engine a wider read is the correct shape, and
widening `PantryEntry` to serve the engine would be the mistake.

### Buckets and a stated constraint, not a sorted list

The payload carries `use_first`, `use_soon`, and `available` as separate groups,
with an explicit instruction that every suggestion must use a `use_first` item.

*Why:* decision 34. Models do not reliably read list position as priority, and in
a long list the urgent items sit in the middle of a wall of text. A stated rule
produces the behaviour; ordering only hopes for it.

### Urgency is scored locally, before the model sees anything

`urgency(item, canonical)` in `src/logic/suggest.ts` — pure, from days
remaining, `price_cents`, and freezability.

*Why:* it decides bucket membership, so it must be deterministic and testable.
Asking the model to weigh urgency would make the one genuinely arithmetic part
of the feature non-reproducible, and it is the part decision 35 depends on.

### `meal_items.canonical_id` is nullable, and null means "resolve by name"

*Why:* the two sources differ in what they honestly know. A photograph produces
"soy sauce" and genuinely cannot say which bottle; resolving by name is correct
there. A recipe produces `soy-sauce-light` and says so; re-deriving that by fuzzy
string matching discards the precision that made decision 61's argument work in
the first place.

Making it nullable rather than required means existing rows need no backfill and
today's behaviour is exactly the null case.

*Consequence for the in-flight change:* `add-stock-depletion` is being built now
and resolves by name. This change adds the preference for a carried identity on
top, which is why `stock-depletion` appears as a modified capability rather than
this change reaching into that one mid-flight.

### Cooking a suggestion produces an ordinary meal

Not a separate code path. The suggestion's ingredients become `meal_items` with
their canonical ids attached, the servings figure becomes decision 10's
multiplier, and the meal is committed through the existing flow.

*Why:* depletion, calorie totals, reversal, and editing all already work on
meals. A parallel "cooked recipe" path would need every one of those rebuilt and
would drift. The recipe's advantage is that its item quantities are *stated*
rather than estimated — that is a data-quality difference, not a structural one,
and it needs no new machinery.

*Consequence:* eating one portion of a four-serving batch is already handled —
the multiplier debits four, and decision 51's leftovers venue stops the
remaining portions debiting again.

### Personalisation is computed locally and passed as signals, not as raw history

`getRecentMeals(days)` feeds a pure summariser producing cuisine lean, frequent
dishes, and a recently-eaten list. Those summaries go in the payload; the raw
history does not.

*Why:* sending sixty days of meals is expensive, and most of it is noise for this
question. Summarising locally also keeps the personalisation logic testable
without a model, and means the user's full eating history never leaves the
device — only a characterisation of it does.

### Suggestions are cached in a table, keyed by a stock fingerprint

A row holds the generated set, the date, and a hash of the inputs that would
change the answer — urgent stock, remaining calories, recently eaten.

*Why:* decision 40 requires reuse rather than regeneration, and a fingerprint
answers "has anything material changed" without re-deriving the whole payload.
A pure date key would miss stock consumed during the day; a full re-plan on every
open would defeat the purpose.

### Prompt quality is treated as measurable work

A fixture corpus of kitchen states, with assertions about the *shape* of what
comes back — every suggestion uses an urgent item, none repeats a recently-eaten
dish, at least one is familiar and one is not.

*Why:* the honest risk here is not a crash, it is four days of stir fry. Shape
assertions are checkable without a model in the loop, using a recorded response,
and they catch the failure that actually kills this feature.

## Risks / Trade-offs

**Generic suggestions kill the feature** → the failure mode is boredom, not
error, and it will not show up in any test that only checks for crashes.
Mitigation: the constraint set is what makes suggestions specific, and the
fixture corpus asserts on shape rather than on absence of exceptions.

**A wrong canonical on a cooked suggestion debits the wrong stock** → and does
so with more confidence than the name path, because it skips resolution
entirely. Mitigation: the ids come from the model against a candidate list drawn
from actual stock, and the review step before committing shows what will be
debited.

**Cost per generation is real** → three suggestions with a full kitchen payload
is not a small call. Mitigation: caching by fingerprint, payload compression for
staples and seasonings, and an explicit refresh being the only on-demand path.

**Suggestions may propose unsafe handling** → reheating, raw egg, undercooked
protein. Mitigation: decision 64 already forbids food-safety claims; the framing
is "idea", and the tasks require the prompt to avoid instructing on food safety
rather than attempting to get it right.

**This change depends on an in-flight one** → `add-stock-depletion` must land
first, and its interfaces may shift while this is written. Mitigation: the
dependency is narrow — `planDepletion` and the meal commit path — and the
modified-capability delta is the only place the two touch.

## Migration Plan

One forward-only migration appended to `MIGRATIONS`:

- `meal_items.canonical_id`, nullable, referencing `canonical_items`.
- A suggestion cache table with its input fingerprint.

`DROP_ALL` gains the cache table. Existing meal items keep a null canonical,
which is exactly today's behaviour, so no backfill and no rollback step.

Rollback is additive: an older build ignores the column and the table.

## Open Questions

- **How many days of history to summarise.** Sixty is the working figure.
  Changeable with no interface impact once real usage exists.
- **Whether "make it to Sunday" shares the suggestion cache or keeps its own.**
  It has a different objective and a different fingerprint; deferrable until the
  mode is built, and it changes no schema either way.
