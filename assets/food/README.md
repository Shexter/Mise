# Curated food illustration pack

Tier 3 of the food visual hierarchy: reviewed illustrations for canonical
ingredients that the user has not photographed. Tiers 1 and 2 (user photo,
product package photo) come from runtime data; tier 4 (category badge) is drawn
from vector tokens in `src/media/foodVisuals.ts` and needs no assets.

**The pack is currently empty**, and the app is correct in that state: every
ingredient falls through to its category badge. Nothing renders broken.

## Adding an asset

An asset is shipped only when all four of these hold. `test/food-visuals.test.ts`
enforces the first three; the fourth is a human gate.

1. The file lives in this directory as `<canonical-id>.png` (or `.webp`).
2. `manifest.json` has an entry keyed by the same canonical id, valid against
   `manifest.schema.json`, whose `outputChecksum` matches the bytes on disk.
3. `CURATED_FOOD_ILLUSTRATIONS` in `src/media/foodVisuals.ts` registers the same
   id via a static `require()`. Metro cannot bundle a dynamic path, so this
   registry is hand-maintained — the test asserts it matches the manifest exactly,
   in both directions, so the two cannot drift.
4. The owner has accepted the surrounding UI through native visual review, per
   the `Art direction follows the implemented app` requirement. Art direction
   follows the app; it does not lead it.

## Provenance is a factual record

`sourceModel`, `promptRecipe`, `seed`, `workflowVersion`, `reviewDate`, and
`reviewedBy` describe what actually produced and approved the file. If a
generation pipeline did not run, there is no entry to write — an unshipped
ingredient is a supported state, and a fabricated provenance record is not.

Placeholder swatches from the initial implementation live in
`docs/brand-explorations/food-visual-placeholders/` and are deliberately not here.
