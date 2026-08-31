# Food visual placeholders (not shipped)

These 24 PNGs are **placeholder swatches**, not curated food illustrations. Each
one is a 128×128 image of two flat concentric circles tinted to roughly suggest
its ingredient. They were produced procedurally while `add-visual-food-identity-system`
was being implemented, so the resolver and `<FoodVisual />` had something to render.

They are kept here, outside `assets/food/`, for two reasons:

1. The `visual-food-identity-system` spec requires that exploratory local images
   stay **outside the production asset pack** until the owner accepts the core UI
   through native visual review.
2. They are not art. Shipping them would look worse than the reviewed category
   fallback badges the resolver already renders at tier 4.

## What is *not* true about these files

An earlier revision of `assets/food/manifest.json` recorded a `sourceModel` of
"Draw Things Diffusion / SDXL Turbo Studio Foodpack", along with per-asset diffusion
seeds, prompt recipes, and review dates. None of that describes these images: no
Draw Things pipeline exists in this repo, and no such generation ever ran. That
metadata has been removed rather than corrected, because there is nothing here
worth attributing.

## Producing the real pack

See `assets/food/README.md` for the provenance contract every shipped asset must
satisfy, and `assets/food/manifest.schema.json` for the enforced shape. Real art
replaces these files wholesale; do not promote a placeholder into the pack.
