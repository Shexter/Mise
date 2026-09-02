# Proposal: Connect the generated illustration collection

## Why

`add-visual-food-identity-system` built the whole tier-3 machinery — resolver,
`<FoodVisual />`, manifest schema, checksum tests — and then shipped the pack
empty, because its `Art direction follows the implemented app` requirement gates
production art on owner acceptance of the implemented UI through native visual
review. That gate has now been cleared: the Draw Things pipeline has run against
the locked recipe and 141 reviewed candidates sit in `.art-staging/`.

The ingredient set has somewhere to go the moment it is promoted. The other four
sets do not. `assets/illustration-briefs.json` records each of them as
`consumerWired: false` with an explicit `blockedBy`, and
`scripts/generate-illustrations.ts` refuses to promote a non-ingredient on
purpose, because only tier 3 has a wired consumer. Building those four slots —
and the typed registries behind them — is what this change does.

Relevant decision ledger entries: the local-first, no-runtime-generation
constraint that motivated the build-time pipeline, and the pantry-evidence rule
that a user's own photograph is the authority for their own item.

## What Changes

- **Ingredient pack ships.** 116 reviewed ingredient illustrations are promoted
  into `assets/food/`, each with a full provenance record in
  `assets/food/manifest.json` and a static `require()` in
  `CURATED_FOOD_ILLUSTRATIONS`. The documented four-tier precedence is unchanged,
  so a user-captured pantry photograph still outranks the generated art.
- **A second manifest for non-food sets.** Appliance, state, onboarding, and
  technique art lands in `assets/illustrations/<set>/` under
  `assets/illustrations/manifest.json`, which carries the same provenance fields
  as the food manifest. Food keeps its own manifest: its entries are keyed by
  canonical ingredient id and carry a `FoodClass`, which the other sets have no
  equivalent of.
- **Four typed registries, no scattered requires.** `src/media/foodVisuals.ts`
  (existing), `src/media/onboardingIllustrations.ts`,
  `src/media/stateIllustrations.ts`, and `src/media/techniqueIllustrations.ts`.
  Metro cannot bundle a computed path, so every registry is a generated block of
  static literals and no screen writes a `require()` of its own.
- **Onboarding goal cards** render the two generated card illustrations instead
  of the procedural meter and bowl. Selection checkboxes stay crisp vector UI.
- **Appliance rows** carry their matching illustration, keyed off the seven
  `APPLIANCE_CATALOGUE` ids. The illustration is added beside the tick, never in
  place of it.
- **`StateIllustration` gains an image-backed variant** for the four approved
  state roles, wired only to semantically matching states, with the existing
  procedural shelf retained as the fallback when a bundled image cannot resolve.
- **A bounded technique registry** of twelve ids maps recipe cooking-guide steps
  to art by explicit id first, then a leading-verb match, then a single
  unambiguous keyword match — and renders the existing text-only step when no
  safe match exists.
- **The promotion pipeline learns the other four sets**, so a future agent
  promotes through `npm run art:make -- --promote` with recorded provenance
  rather than copying undocumented files by hand.

## Capabilities

### New Capabilities
- `generated-illustration-registries`: typed, provenance-backed bundled
  illustration registries for the appliance, state, onboarding, and technique
  sets, plus the deterministic technique matcher that feeds the last of them.

### Modified Capabilities
- `visual-food-identity-system`: the art-direction gate is cleared and tier 3
  now ships real assets, so the requirement has to state what replaces the gate —
  that `.art-staging/` never becomes a runtime dependency and that promotion
  remains a reviewed, provenance-recording step.

## Non-goals

- Regenerating art, re-rolling candidates, or changing the locked Draw Things
  recipe, model, sampler configuration, or shared style. The workflow version
  stays at `2.0.0`.
- Making `.art-staging/` a build or runtime input. It stays git-ignored review
  scratch; only promoted files under `assets/` are bundled.
- Replacing any functional vector micro-UI — Feather glyphs, navigation icons,
  the Pantry sprig, category fallback badges, or dish plates — with raster art.
- Generating per-step art for arbitrary free-text recipe instructions. The
  technique vocabulary is bounded at twelve on purpose.
- Any new compact dashboard layout, navigation change, or onboarding flow change.
  The fibre tracker on Today and the five-position bottom navigation stay as they
  are.

## Impact

- `assets/food/` gains 116 `.webp` files and a populated `manifest.json`.
- New `assets/illustrations/` tree with 25 `.webp` files, `manifest.json`, and
  `manifest.schema.json`.
- New `src/media/onboardingIllustrations.ts`, `src/media/stateIllustrations.ts`,
  `src/media/techniqueIllustrations.ts`; `src/media/foodVisuals.ts` registry
  block populated.
- `src/components/StateIllustration.tsx` gains an image-backed variant;
  new `src/components/TechniqueIllustration.tsx`.
- `app/onboarding/goals.tsx`, `app/onboarding/appliances.tsx`,
  `app/recipe/[id].tsx`, `app/(tabs)/pantry.tsx`, `app/(tabs)/index.tsx`,
  `app/dinner.tsx`, `app/pantry-capture-review.tsx` render the new artwork.
- `scripts/asset-inventory.ts` and `scripts/generate-illustrations.ts` learn the
  non-ingredient sets; `docs/asset-pipeline.md` and `assets/food/README.md`
  updated to match.
- Bundle grows by roughly 4.1 MB of WebP.
