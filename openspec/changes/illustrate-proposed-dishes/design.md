## Context

`app/onboarding/first-plan.tsx` renders its plan header with `DishVisual`, the
procedural plate built in `add-visual-food-identity-system`. That component
exists for a good reason, stated in its own design: *"Borrowing an ingredient's
picture states something false — a stir-fry is not a chicken breast."*

Nothing here disputes that. The question is narrower: is the set of dishes on
this screen bounded? It is. `STARTER_MEAL_PREP_TEMPLATES` holds seven authored entries,
each with a fixed id, title, and ingredient list.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Painted artwork for the seven dishes the app proposes.
- A boundary the next agent cannot misread as "generate art for any dish".

**Non-Goals:**
- Art for unbounded dishes.
- Art for ingredient combinations.
- Any change to `DishVisual` itself.

## Decisions

### 1. Authored dishes are generable; proposed-by-a-model dishes are not

- **Decision**: generate one illustration per `STARTER_MEAL_PREP_TEMPLATES` entry, and
  nothing else. Dinner suggestions and saved recipes keep `DishVisual`.
- **Rationale**: the pipeline's rule is about *unboundedness*, not about dishes
  as a category. Twelve techniques were generable for the same reason: a closed,
  authored vocabulary. Seven templates are the same shape of problem. A dinner
  suggestion's title comes from a provider and could be anything, so it stays
  procedural — and it must, because art for a dish nobody drew would have to be
  either wrong or absent.
- **The failure this guards against** is an agent reading "we ship dish art now"
  and generating a picture for whatever dish title happens to be in front of it.
  Three things make that hard to do by accident: the registry is keyed by
  template id so a free-text title cannot address it, `dishIllustrationFor()`
  returns `null` rather than a near-match, and the briefs carry a note saying not
  to add a subject for a dish with no template id.

### 2. Keyed by template id, not by title

- **Decision**: `DISH_ILLUSTRATIONS` is keyed by `rice-cooker-chicken-rice`, not
  by "One-Pot Chicken & Fragrant Rice".
- **Rationale**: the id is what the plan was built from and is stable; the title
  is copy and will be edited. Keying on the title would silently drop the art the
  first time someone rewords a dish, and the screen would fall back to a plate
  with no error anywhere.

### 3. The style is the ingredient style, verbatim

- **Decision**: `suffixBySet.dish` aliases `suffixBySet.ingredient` rather than
  introducing new wording.
- **Rationale**: a dish is food, photographed the same way the ingredients are —
  three-quarter view, warm ivory paper, oval grounding shadow. Writing a second
  near-identical suffix invites the two to drift. Aliasing means one edit changes
  both, which is the correct coupling: if the food style changes, dishes are food.

### 4. Fallback is `DishVisual`, not a blank

- **Decision**: the header asks `dishIllustrationFor(templateId)` and renders
  `DishVisual` when it returns `null`.
- **Rationale**: `DishVisual` is a reviewed, complete state, not an error state.
  A plan with no template art — which will be every plan outside the seven —
  should look designed rather than degraded, and it already does.

## Implementation Seams

- `assets/illustration-briefs.json`, `assets/illustrations/dish/`,
  `assets/illustrations/manifest.json`, `manifest.schema.json`.
- `scripts/asset-inventory.ts` — `dish` in `SET_TARGETS`.
- `src/media/dishIllustrations.ts`.
- `app/onboarding/first-plan.tsx` — header only.
- `test/illustration-registries.test.ts`.

No database schema change.

## Risks / Trade-offs

- **[Risk] The boundary erodes.** The next person may read this as permission to
  illustrate dishes generally. Mitigated by the id-keyed registry, the `null`
  return, the briefs note, and a paragraph in `docs/asset-pipeline.md` that
  states the rule and its one exception together rather than in two places.
- **[Risk] A template is reworded and its art no longer fits.** Keying on the id
  means the art survives a retitle, which is right for a reworded name and wrong
  for a rewritten dish. A template whose ingredients change materially needs its
  art re-rolled, and `--force` now supports that.
- **[Trade-off] Seven more images in the bundle.** ~200 KB. The alternative is a
  placeholder-looking plate at the top of the first screen someone sees after
  setting up their kitchen.
