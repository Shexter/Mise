# Proposal: Illustrate the dishes Mise proposes

## Why

The first meal-prep plan leads with a procedural `DishVisual` — a plate divided
into coloured wedges by the food classes of its ingredients. Beside painted
ingredient thumbnails and painted technique steps it reads as a placeholder,
and it is the first thing on the screen.

The standing rule is that per-dish art is not generable, and
`docs/asset-pipeline.md` says so plainly: *"Dishes are unbounded; per-dish art
is not generable."* That is true, and it is not true of this screen.

**The onboarding plan never proposes an arbitrary dish.** It proposes one of
seven entries in `STARTER_MEAL_PREP_TEMPLATES` — a list the project authored, with fixed
titles and fixed ingredients. Seven is a bounded set, and a bounded set of
authored dishes can be drawn once and shipped, exactly like the twelve
techniques. What stays unbounded is a recipe someone saved and a dinner a
provider proposed, and those keep the procedural plate.

So the rule does not need overturning. It needs the line drawn in the right
place: **the app's own authored dishes get art; anything the app did not write
down keeps the plate it composes from data.**

## What Changes

- **A `dish` illustration set of seven**, one per meal-prep template, reusing the
  locked ingredient style verbatim. No new style wording, no workflow bump.
- **A registry keyed by template id**, not by dish title. A title is free text
  and could drift or collide; the id is what the plan was actually built from.
- **The first-plan header renders the template's artwork**, falling back to
  `DishVisual` when a plan has no template art — which is what every non-template
  dish will always do.
- **`DishVisual` is untouched and stays the answer everywhere else**: dinner
  suggestions, saved recipes, and any future dish the app did not author.
- **`docs/asset-pipeline.md` gets the boundary written down**, so the next agent
  reading "dishes are unbounded" also reads why seven of them are not, and does
  not take it as licence to generate art for arbitrary dish names.

## Capabilities

### Modified Capabilities
- `visual-food-identity-system`: the dish requirement gains the authored-template
  carve-out and keeps its prohibition on borrowing an ingredient's picture.
- `generated-illustration-registries`: adds the dish set and its fallback.

## Non-goals

- **Art for combinations of ingredients.** Thirteen starter ingredients have
  8,191 non-empty subsets; most are not dishes and nobody would cook them. The
  generable set is the dishes the app proposes, which is seven.
- Art for saved recipes or provider-proposed dinners. Those are unbounded and
  keep `DishVisual`.
- Changing which templates exist, their titles, ingredients, or matching.
- Changing the locked style, model, sampler configuration, or workflow version.
- Removing or weakening `DishVisual`, which remains the fallback and the only
  answer for unbounded dishes.

## Impact

- `assets/illustration-briefs.json` — new `dish` set; `dish` suffix aliased to
  the existing ingredient wording.
- `assets/illustrations/dish/*.webp` and its manifest entries.
- `assets/illustrations/manifest.schema.json` — `action` and `dish` added to the
  set enum, which `action` was missing.
- `src/media/dishIllustrations.ts` — new registry and `dishIllustrationFor()`.
- `app/onboarding/first-plan.tsx` — header artwork with its fallback.
- `docs/asset-pipeline.md`, `assets/illustrations/README.md`.
