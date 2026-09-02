# Curated food illustration pack

Tier 3 of the food visual hierarchy: reviewed illustrations for canonical
ingredients that the user has not photographed. Tiers 1 and 2 (user photo,
product package photo) come from runtime data; tier 4 (category badge) is drawn
from vector tokens in `src/media/foodVisuals.ts` and needs no assets.

**The pack ships 116 reviewed illustrations.** The owner cleared rule 4 below
through native visual review, and `connect-generated-illustrations` promoted the
reviewed candidates. Tier 4 is still reachable and still correct: an ingredient
with no exact art, and an illustration that fails to load on the device, both
fall through to the category badge. Nothing renders broken.

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
   follows the app; it does not lead it. This was cleared for the current pack;
   a pack in a new style needs it cleared again.

Appliance, state, onboarding, and technique artwork lives in
`assets/illustrations/` under its own manifest — see the README there. Those
entries have no `FoodClass`, which is why they are not in this manifest.

## Provenance is a factual record

`sourceModel`, `promptRecipe`, `seed`, `workflowVersion`, `reviewDate`, and
`reviewedBy` describe what actually produced and approved the file. If a
generation pipeline did not run, there is no entry to write — an unshipped
ingredient is a supported state, and a fabricated provenance record is not.

Placeholder swatches from the initial implementation live in
`docs/brand-explorations/food-visual-placeholders/` and are deliberately not here.

Promote with the pipeline, never by hand:

```sh
npm run art:make -- --promote <ids> --reviewer "Your Name"
```

See `docs/asset-pipeline.md`.
