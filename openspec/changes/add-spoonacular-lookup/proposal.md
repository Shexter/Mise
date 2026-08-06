## Why

Spoonacular is the best-known food API: recipe search by ingredients, nutrition
per ingredient and per dish, ingredient parsing, and a large recipe corpus. On
its face it answers three things this app cares about — food information,
recipes, and calories.

## Read this before anything else

Spoonacular's terms forbid the thing this app is built to do.

> You may not scrape the Spoonacular API or in any way attempt to copy or store
> the information it provides, **including any derived, hashed, or transformed
> data**.

> With prior written permission … you may cache user-requested data … for a
> **maximum of 1 hour**. After 1 hour, you must delete your cache.

> If you stop using the Spoonacular API … you must **delete all data you ever
> obtained** from the Spoonacular API.

Mise is a permanent food diary. Every logged meal keeps its calories forever,
the pantry keeps quantities for months, and decision 5 makes the whole thing
local-first and offline-capable. A one-hour cache ceiling and a ban on storing
derived data are not a licensing detail to work around — they are the opposite
of the architecture.

Concretely: a calorie figure from Spoonacular could not be written to a meal. A
nutrition figure could not be written to a canonical ingredient. Neither could be
kept once a subscription lapsed, which would mean deleting rows out of a user's
own diary because *we* stopped paying.

**So this change does not adopt Spoonacular as a data source.** It plans the one
role the terms permit, and it plans the gate that confirms even that.

## What Changes

- **An optional live lookup surface**, and nothing else. Search recipes by what
  is in the pantry; read nutrition for a dish; see it now.
- **Nothing it returns is ever written.** Not to the database, not to a file,
  not into a logged meal, not into the catalogue. Enforced structurally and
  tested, not left to discipline.
- **Results live in memory for at most an hour**, then go.
- **The app is identical without it.** No feature depends on it, nothing
  degrades when the key is absent or the subscription ends, and no stored row
  ever references it.
- **The user brings their own key**, as with vision providers.
- **A gate before any of it.** Task 1 establishes in writing whether even this
  narrow use is permitted, and what attribution is required.

## Capabilities

### New Capabilities

- `spoonacular-lookup`: An optional live food and recipe lookup. Covers the
  no-persistence constraint and how it is enforced, session-scoped caching, key
  handling, degradation when absent, attribution, and the boundary against the
  app's own stored data.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Storing anything it returns.** The central constraint, not a limitation to
  be engineered around. "Derived, hashed, or transformed" closes every obvious
  workaround, and attempting one would be a deliberate breach.
- **Populating a logged meal, a pantry item, or the catalogue.** A meal's
  calories must come from the estimator, the catalogue, or the user. Never here.
- **Replacing the vision estimator.** Photograph-to-calories is the app's core
  and stays.
- **Replacing `add-open-data-catalogue`.** FoodData Central is CC0 and *can* be
  stored, which is why it is the nutrition source and this is not.
- **Replacing the dinner decision.** Decision 33 rejected a browsable recipe
  library, and decision 61 made the suggestion path the seasoning mechanism
  because a cooked suggestion states its ingredients into the user's own record.
  A Spoonacular recipe cannot do that, because the statement could not be kept.
- **Offline anything.** By definition.
- **Shipping our own subscription key.** It would leak from the APK and would
  put our billing behind every user's usage.

## Impact

**Schema.** None, deliberately. If this change needs a migration, something has
gone wrong.

**Code.**
- `src/api/spoonacular.ts` — the client, through the existing error taxonomy.
- `src/logic/lookupStore.ts` — an in-memory, TTL-bounded session store.
- `src/api/keyStore.ts` — a second key slot. Noted below.
- A lookup surface, reachable and skippable.

**Dependencies.** None added.

**Depends on** nothing unmerged.

## The honest comparison

Everything asked for here is already served or planned by sources that permit
storage:

| Want | Source | Can it be stored? |
|---|---|---|
| Calories for a photographed meal | the vision estimator (shipped) | yes — it is the user's own record |
| Nutrition per ingredient | FoodData Central, `add-open-data-catalogue` | yes, CC0 |
| Shelf life | FoodKeeper, same change | yes, public domain |
| Recipes from your stock | the dinner decision (shipped) | yes |
| Recipes you found | `add-recipe-links` (planned) | yes |
| Ingredient identity, multilingual | the identity layer + `add-off-taxonomy-seed` | ODbL, gated |

Spoonacular would duplicate most of that under terms that forbid keeping the
answer. That is the argument against adopting it, and it is worth stating
plainly rather than discovering after an integration.

What it genuinely adds is **breadth of recipe corpus** — a large body of real,
tested recipes with real ingredient lists, which the app has no equivalent of.
Whether a browse-only surface over that corpus is worth a subscription and a
second key is a product call, not a technical one.

## The key problem, which is not small

`openspec/config.yaml` makes one convention non-negotiable: *the API key is
confined to `src/api/keyStore.ts`. It never reaches the database, logs, or the
JSON export.* That module currently holds exactly one key.

A Spoonacular subscription is a second credential with a different lifecycle: it
is billed monthly, it lapses, and when it lapses the terms require deleting
everything obtained under it. Adding it means `keyStore` becomes plural — a
change to the one module the project treats as sacred, for a feature that is
optional by design.

That is not a blocker. It is a cost, and it belongs in the decision about
whether to do this at all.
