# Foods hub (Custom Meals / Recipes / Foods, Repeat Items, Oracle Nutrient Search)

**Screenshots:** `foods-hub-upper.jpg, foods-hub-lower.jpg`
**Cronometer tier:** free

## What it does

One tab collects every food-authoring and food-discovery tool: **Custom
Meals** (bundle recipes/foods into one loggable unit), **Custom Recipes**
(create manually, or "Import Recipe" from a URL), **Custom Foods** (manual
entry for anything not in the database), **Repeat Items** (schedule foods/
meals/recipes/supplements to auto-log on a cadence), **Suggest Food**
("personalized food suggestions to help meet your daily nutrition
targets"), and **Oracle Nutrient Search** ("search for foods high in
specific nutrients to meet your needs").

## UI pattern observed

Vertical stack of cards, each with an icon, one-line description, and a
primary button where the action is immediate (Create Meal / Create Recipe /
Import Recipe / Create Food); the discovery-oriented ones (Repeat Items,
Suggest Food, Oracle Nutrient Search) are plain chevron rows into a
sub-screen instead.

## Implied data model

A recipe importer needs a URL-scraping or LLM-extraction path (unspecified
which, from the screenshot alone). "Repeat Items" needs a schedule/cadence
record separate from the food/meal/recipe it points at. Oracle Nutrient
Search needs the nutrient database queryable by "which foods are high in
X," i.e. an inverted index over nutrient values, not just food name.

## Gap-check against Mise

- **Already have:** custom pantry/canonical items exist; `add-recipe-links`
  already covers importing a recipe from a shared link/screenshot — so
  "Import Recipe" substantially overlaps with work already scoped there.
- **Partially have:** `add-macro-gap-suggestions` is Mise's version of
  "Suggest Food" / Oracle Nutrient Search — reasoning about what to eat to
  close a gap. Cronometer splits it into two surfaces (a general suggestion
  engine, and a directed "high in nutrient X" search); Mise currently only
  has the general one, scoped to macros.
- **Missing entirely:** "Repeat Items" (scheduled auto-logging) has no
  equivalent in Mise and doesn't obviously map onto anything in the
  decision ledger — pantry depletion assumes an actual capture event, not
  a scheduled phantom one.
- **Conflicts with a non-negotiable:** Repeat Items auto-logging a meal
  without a capture event would need to *not* touch pantry depletion (or
  it needs its own explicit stock decrement), since Mise's whole model is
  "the meal log IS the depletion signal" — an auto-logged meal with no
  photo/receipt/barcode behind it breaks that chain unless scoped
  carefully.

## Verdict

**Adapt (Oracle Nutrient Search)** — extend `add-macro-gap-suggestions`
with a directed "what's high in fibre/iron/etc." mode once micronutrient
data exists (depends on `full-micronutrient-report.md`'s adopt call).

**Reject (Repeat Items)** — conflicts with Mise's core thesis that logging
IS the depletion signal; a scheduled phantom log either lies about what
was eaten or needs to bypass pantry decrement entirely, and neither is
worth the complexity for what it saves (a few taps on a recurring food).

**Linked OpenSpec change:** `add-macro-gap-suggestions` (extend), `none
yet` for a directed nutrient search mode.
