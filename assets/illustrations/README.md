# Bundled illustration sets

Reviewed artwork for everything that is not a food ingredient: kitchen
appliances, named empty states, onboarding goal cards, and cooking techniques.
Ingredient art lives in `assets/food/` under its own manifest.

Two manifests rather than one on purpose. A food entry is keyed by canonical
ingredient id and carries a required `FoodClass`, validated against
`src/types.ts`. An appliance or a technique has no food class, and relaxing that
field so both sets could share one schema would weaken the single check that
actually protects tier 3 of the food visual hierarchy.

## Layout

```
assets/illustrations/
  manifest.json          provenance for every file below
  manifest.schema.json   what an entry must satisfy
  appliance/<ApplianceId>.webp
  onboarding/<goal-id>.webp
  state/<state-role>.webp
  technique/<technique-id>.webp
  action/<action-id>.webp
```

Manifest keys are `<set>/<id>`, because the id spaces overlap — `blender` is an
appliance and a plausible technique subject.

## Adding an asset

An asset is shipped only when all four of these hold.
`test/illustration-registries.test.ts` enforces the first three; the fourth is a
human gate.

1. The file lives at `assets/illustrations/<set>/<id>.webp`.
2. `manifest.json` has an entry keyed `<set>/<id>`, valid against
   `manifest.schema.json`, whose `outputChecksum` matches the bytes on disk.
3. The registry for that set registers the same id via a static `require()`.
   Metro cannot bundle a computed path, so these registries are generated rather
   than derived — the test asserts each matches the manifest exactly, in both
   directions, so the two cannot drift.
4. The owner has accepted the surrounding UI through native visual review. Art
   direction follows the app; it does not lead it.

| Set | Registry |
| --- | --- |
| `appliance` | `APPLIANCE_ILLUSTRATIONS` in `src/media/onboardingIllustrations.ts` |
| `onboarding` | `GOAL_ILLUSTRATIONS` in `src/media/onboardingIllustrations.ts` |
| `state` | `STATE_ILLUSTRATIONS` in `src/media/stateIllustrations.ts` |
| `technique` | `TECHNIQUE_ILLUSTRATIONS` in `src/media/techniqueIllustrations.ts` |
| `action` | `ACTION_ILLUSTRATIONS` in `src/media/actionIllustrations.ts` |

## Provenance is a factual record

`sourceModel`, `promptRecipe`, `seed`, `workflowVersion`, `reviewDate`, and
`reviewedBy` describe what actually produced and approved the file. Promote with
the pipeline, which writes them from the sidecar recorded at generation time:

```sh
npm run art:make -- --set appliance --promote all --reviewer "Your Name"
```

Copying a file in by hand and writing the entry yourself produces a record that
looks identical and is not true. `assets/food/README.md` is explicit that a
fabricated provenance record is worse than no entry at all.

## What is deliberately not here

Feather glyphs, the bottom-navigation icons, the Pantry sprig, the category
fallback badges, dish plates, selection ticks, and the add sheet's scan-framing
corners are vector and stay vector. They are functional
micro-UI that has to retint per theme and per state, and a diffusion model cannot
produce a crisp, recolourable 16px chevron. See `docs/asset-pipeline.md`.
