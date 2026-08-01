## Why

Decision 61 changed what this is. It was going to be a recipe feature — pleasant,
optional, the kind of thing every food app has. It is now **the mechanism that
keeps the seasoning promise**, which is one of the three things the product was
founded to do.

The reasoning, from reviewing `add-pantry-stock`: reliable seasoning depletion
cannot be read from a photograph of finished food. Gochujang in a stew is
indistinguishable from tomato paste, and a vision model will never report two
grams of white pepper. Decision 13's typical-use fallback only fires when the
model *names* the ingredient, which for invisible ingredients is exactly when it
does not.

But a suggestion the user cooks from **states its own ingredients**. Two
tablespoons of gochujang is a fact, not an estimate. So "I cooked this" is a
higher-quality data path into depletion than the camera will ever be, and this
change is what creates it.

It also carries the retention argument. Decision 41's "make it to Sunday" is a
recurring weekly problem people actually need help with, where the pantry list
is a reference they consult. And decision 35's value-at-risk weighting produces
the strongest sentence the product can say: *"saves $8 of stock."*

Long-form design in [`docs/dinner-decision.md`](../../../docs/dinner-decision.md).
Implements decisions 33 through 41, and 61.

## What Changes

- **A dinner decision surface**: three suggestions, each with a calorie figure
  and a reason it is on the list. Not a browsable recipe library.
- **Expiry-driven selection with a hard constraint.** Stock is bucketed —
  `use_first`, `use_soon`, `available` — and every suggestion must use at least
  one `use_first` item. Decision 34: sorting hopes for the behaviour, a stated
  rule produces it.
- **Urgency weighted by value at risk** (decision 35). `price_cents` is already
  on `pantry_items`; 300 g of pork belly and half a cucumber expiring the same
  day are not equally urgent.
- **Personalisation from meal history** — cuisine lean, repeat dishes, recently
  eaten, and decision 37's two-familiar-one-stretch ratio.
- **Calories as context, never a filter** (decision 36), with the macro gap as
  the better signal.
- **"I cooked this" pre-fills a meal from the recipe** and runs depletion
  against stated quantities rather than estimated ones. This is decision 61, and
  it is the point.
- **New nullable `meal_items.canonical_id`.** A recipe knows exactly which
  ingredient it means; without somewhere to put that, the knowledge is discarded
  and re-derived by fuzzy string matching, which throws away the precision that
  made the recipe path worth having.
- **A recent-meal-history query.** `src/db/queries.ts` has `getMealsForDate` and
  `getLoggedDates` and nothing that reads a window, so personalisation currently
  has no source.
- **"Make it to Sunday"** (decision 41): the same engine with a different
  objective — N dinners requiring no shopping, stating the gap honestly.
- **Daily caching** (decision 40), so opening a tab does not spend money.

## Capabilities

### New Capabilities

- `dinner-decision`: Choosing what to cook tonight from what is in the kitchen.
  Covers stock bucketing and the use-first constraint, urgency weighting,
  personalisation from meal history, calorie and macro context, the suggestion
  contract and its reason tags, cooking a suggestion into a logged meal, the
  stretch-to-a-date planning mode, and caching.

### Modified Capabilities

- `stock-depletion`: gains a requirement that a consumed ingredient with a known
  canonical resolves through that identity rather than by name matching. Vision
  meals keep resolving by name, correctly — they genuinely do not know.

## Non-goals

- **A recipe library, or browsing.** Decision 33. "What could I make" is free
  from any chatbot and goes generic by the fourth day.
- **Tested recipes.** These are ideas with a starting point, presented as such.
  Quantities and technique will sometimes be wrong, and the fix is framing.
- **Scraping or licensing recipe content.** The model generates from the user's
  own stock; nothing is fetched.
- **Shopping lists.** `missing` items are surfaced honestly and feed a later
  change.
- **Nutrition accuracy beyond the existing estimator.** A suggestion's calorie
  figure is the same class of estimate as a photo's, and a photo of the finished
  dish overrides it.
- **Meal planning across a week as a calendar.** "Make it to Sunday" produces a
  set of dinners, not a scheduled plan.

## Impact

**Schema.** One migration adding nullable `meal_items.canonical_id`, plus a
suggestion cache table. Additive; existing rows are untouched and a null
canonical means "resolve by name", which is today's behaviour.

**Code.**
- `src/api/suggestPrompt.ts` and `src/api/suggest.ts` — through the existing
  provider facade and error taxonomy, following `src/api/resolve.ts`.
- `src/logic/suggest.ts` — new, pure: bucketing, urgency scoring, payload
  shaping, personalisation signals. Testable with no network.
- `src/db/queries.ts` — recent-meal history, suggestion cache, and reading stock
  *with* price and quantity.
- `app/(tabs)/` — the dinner decision surface.

**Dependencies.** None added.

**Depends on** `add-pantry-stock` (merged) and `add-stock-depletion` (in
flight — cooking a suggestion runs depletion).

**Risk.** The suggestion quality problem is not technical. A generically-worded
prompt produces stir fry, fried rice, and pasta bake forever, and the feature
dies of boredom by the fourth day regardless of how correct the plumbing is.
What prevents that is the constraint set — expiring stock, real history,
remaining calories — and the tasks treat prompt quality as measurable work with
a fixture corpus rather than something to tune by feel.

## A note on decision 15

The suggestion engine reads `price_cents` and `qty_remaining` to rank urgency.
That does not conflict with never displaying an indefensible quantity: decision
15 constrains **display**, not computation. The engine computes with the
numbers and renders none of them — a reason chip says "saves $8 of stock", which
is a price the user actually paid and the app can defend, never an estimated
remaining mass.

This distinction needs stating because `PantryEntry` deliberately omits both
fields, so this change must read stock through a separate query rather than the
pantry view model. That is correct, not a workaround.
