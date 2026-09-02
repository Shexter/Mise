## Context

`add-visual-food-identity-system` left one deliberate hole: tier 3 shipped empty
because art direction was gated on owner acceptance of the implemented UI. That
acceptance has happened and `.art-staging/` now holds 141 reviewed candidates
across five sets, generated against the locked recipe in
`assets/illustration-briefs.json` (workflow version `2.0.0`, Draw Things CLI
`1.20260430.0`, `flux_2_klein_4b_q8p.ckpt`).

The ingredient set has a wired consumer. The other four are recorded in the
briefs as `consumerWired: false` with a specific `blockedBy` each, and
`promote()` refuses them by design. This change builds those four slots and the
registries behind them.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Ship the 116 reviewed ingredient illustrations through the existing promotion
  pipeline with intact provenance, without weakening the four-tier precedence.
- Give the appliance, state, onboarding, and technique sets real consumers and
  typed registries, so promotion is a pipeline step rather than a manual copy.
- Map recipe steps to technique art deterministically and conservatively, with
  the text-only step as the honest default.

**Non-Goals:**
- Regenerating art or altering the locked style, model, sampler config, or
  workflow version.
- Turning `.art-staging/` into a build input.
- Replacing functional vector micro-UI with raster art.

## Decisions

### 1. Two manifests, not one

- **Decision**: Ingredients keep `assets/food/manifest.json`. The other four sets
  share a new `assets/illustrations/manifest.json` with its own
  `manifest.schema.json`, and files live at `assets/illustrations/<set>/<id>.webp`.
- **Rationale**: The food manifest's entries are keyed by canonical ingredient id
  and carry a required `FoodClass` `category`, validated against `src/types.ts`.
  An appliance or a technique has no food class, and widening the food schema to
  make `category` optional would weaken the check that actually protects tier 3.
  A second manifest keeps both schemas honest. Provenance field names are
  identical across the two, so one reader understands both.
- **Shape**: `{ schemaVersion, description, generatedAt, assets: { "<set>/<id>":
  { set, assetId, fileName, sourceModel, license, promptRecipe, seed,
  workflowVersion, reviewDate, reviewedBy, outputChecksum } } }`. Keys are
  `<set>/<id>` because `blender` exists as both an appliance and, potentially, a
  technique-adjacent id; a flat id space would collide.

### 2. Registries are generated literals, one module per set

- **Decision**: `src/media/foodVisuals.ts` (existing `CURATED_FOOD_ILLUSTRATIONS`),
  `src/media/onboardingIllustrations.ts` (`GOAL_ILLUSTRATIONS`,
  `APPLIANCE_ILLUSTRATIONS`), `src/media/stateIllustrations.ts`
  (`STATE_ILLUSTRATIONS`), `src/media/techniqueIllustrations.ts`
  (`TECHNIQUE_ILLUSTRATIONS` plus the matcher). Each holds a
  `/* generated */`-delimited block that `scripts/generate-illustrations.ts`
  rewrites.
- **Rationale**: Metro bundles only static `require()` literals, so the map cannot
  be derived from the manifest at runtime. Keeping the literals in four named
  modules — rather than inline in seven screens — means a screen never has to
  know an asset path, and one test can hold each registry to its manifest in both
  directions, which is what stops half-promoted art from shipping.
- **Typing**: appliance and technique registries are `Record<ApplianceId, …>` and
  `Record<TechniqueId, …>`, so a missing id is a type error rather than an
  `undefined` at runtime. Goal and state registries are keyed by their own literal
  unions.

### 3. Technique matching: explicit id, then leading verb, then a unique keyword

- **Decision**: `resolveTechnique({ techniqueId, instruction })` returns a
  `TechniqueId | null` by three ordered rules:
  1. `techniqueId`, if it is one of the twelve.
  2. The step's **leading verb**, after skipping a small closed list of leading
     adverbials (`then`, `next`, `meanwhile`, `now`, `first`, `finally`,
     `gently`, `carefully`, `immediately`, `once`).
  3. Otherwise, a whole-phrase scan of the normalised step: if **exactly one**
     technique's phrases appear, use it; if zero or two or more, return `null`.
- **Rationale**: Cooking instructions are imperative, so the leading verb is the
  step's actual action. Rule 3 without the uniqueness constraint would mislead —
  "Add the chopped tomatoes and simmer" mentions two techniques and is a simmer
  step, not a chop step; returning `null` and rendering text is honest, whereas
  picking the first mention would be wrong roughly half the time.
- **Normalisation**: lowercase, diacritics stripped (so `sauté` and `saute` are one
  key), non-alphanumerics collapsed to single spaces, padded with spaces, then
  whole-phrase `includes`. Phrase matching, not stemming: a stemmer would map
  "the rest of the sauce" onto `rest`.
- **False-positive guards** are in the vocabulary rather than in the algorithm:
  `rest` matches only the phrases `rest for`, `to rest`, `resting`, `let it rest`
  and `leave to rest`, never bare `rest`; `bake` excludes `baking`, which appears
  in `baking powder`, `baking soda`, `baking tray`, and `baking paper`; `serve`
  excludes bare `serving`, which appears in `per serving`.
- **Recipes today store no technique id.** `RecipeWithIngredients.steps` is
  `string[]`, so rule 1 is unreachable from `app/recipe/[id].tsx` today. It is in
  the signature because `CookingGuideStep` in `src/types.ts` already models
  `applianceId` and `actionType`, and a stored technique is the natural next field;
  the resolver must prefer it the day it exists rather than being retrofitted.

### 4. State illustrations: image variant with the vector as fallback

- **Decision**: `StateIllustration.tsx` keeps `EmptyPantryIllustration` — the
  approved procedural shelf — and gains `<StateIllustration name=… />`, which
  renders the bundled image and falls back to the procedural shelf (for
  `empty-pantry`) or to nothing (for the other three) if the image fails to load.
- **Wiring**, one per approved role, chosen for semantic match:
  - `empty-pantry` → `app/(tabs)/pantry.tsx`, on the existing branch that already
    distinguishes a loaded-and-empty pantry from a loading one.
  - `first-saved-meal` → `app/(tabs)/index.tsx`, the `Nothing logged yet` card,
    which already guards on `loading && meals.length === 0`.
  - `capture-needs-better-photo` → `app/pantry-capture-review.tsx`, when the
    capture produced no proposals. Deliberately **not** `app/review.tsx`'s error
    branch: a `malformed` `VisionError` means the provider's response was
    unreadable, not the user's photo, and blaming the photo for a provider fault
    would be a lie the illustration tells.
  - `no-dinner-suggestion` → `app/dinner.tsx`, the `suggestions.length === 0`
    branch only. The screen's `loading`, `no_key`, `error`, `met_target` and
    `insufficient_data` branches keep their existing copy and get no artwork.
- **Test tripwire**: `test/brand-system.test.ts` asserts `StateIllustration.tsx`
  contains no `Image`. That assertion was written when the file was procedural
  only; it is updated to keep what it was actually protecting — the illustration
  is static, honours reduced motion by having no motion, and stays token-driven —
  while allowing the image variant. `test/food-visuals.test.ts`'s
  "Tier 3 is empty" test is the tripwire `docs/asset-pipeline.md` names, and is
  rewritten to assert the pack is populated and consistent.

### 5. Blending the paper tile

- **Decision**: artwork is masked to the surrounding radius with `overflow: hidden`
  and no border and no contrasting backing panel. On the goal cards the art band is
  flush to the card's top edge and shares its top corners, so there is no inset
  square at all. `resizeMode="contain"` everywhere the aspect can differ from the
  slot; the sources are square, so containment never letterboxes on a square slot.
- **Rationale**: `docs/asset-pipeline.md` forbids trimming or flood-filling the
  paper — it is part of the accepted art direction. The tile is therefore blended
  by layout, not by editing the source. No new colour token is introduced; the
  paper is simply allowed to be the surface.

### 6. Pipeline extension

- **Decision**: `scripts/asset-inventory.ts` derives status for all five sets from
  the same three facts (file, manifest entry, registry key), reading the
  illustration manifest and the three new registry blocks. `promote()` in
  `scripts/generate-illustrations.ts` takes `--set`, routes to the right manifest,
  directory, and registry writer, and still requires `--reviewer`.
- **Rationale**: the current refusal of non-ingredients was correct while the other
  sets had nowhere to render. Once they do, the alternative to extending `promote()`
  is hand-copying files with hand-written provenance, which
  `assets/food/README.md` explicitly calls worse than no entry.
- The briefs' `consumerWired` flags flip to `true` and the `blockedBy` notes are
  removed, since the blockers described are exactly what this change removes.

## Implementation Seams

- `assets/food/`, `assets/food/manifest.json` — populated tier-3 pack.
- `assets/illustrations/{appliance,state,onboarding,technique}/`,
  `assets/illustrations/manifest.json`, `assets/illustrations/manifest.schema.json`.
- `assets/illustration-briefs.json` — `consumerWired` flags only.
- `src/media/foodVisuals.ts`, `src/media/onboardingIllustrations.ts`,
  `src/media/stateIllustrations.ts`, `src/media/techniqueIllustrations.ts`.
- `src/components/StateIllustration.tsx`, `src/components/TechniqueIllustration.tsx`.
- `app/onboarding/goals.tsx`, `app/onboarding/appliances.tsx`,
  `app/recipe/[id].tsx`, `app/(tabs)/pantry.tsx`, `app/(tabs)/index.tsx`,
  `app/dinner.tsx`, `app/pantry-capture-review.tsx`.
- `scripts/asset-inventory.ts`, `scripts/generate-illustrations.ts`.
- `test/food-visuals.test.ts`, `test/brand-system.test.ts`,
  `test/illustration-registries.test.ts` (new).
- `docs/asset-pipeline.md`, `assets/food/README.md`.

No database schema change: nothing here is persisted.

## Risks / Trade-offs

- **[Risk] Bundle growth.** ~4.1 MB of WebP across 141 files. Accepted: the whole
  point of the build-time pipeline is zero runtime cost, and 512px quality-90 WebP
  is already the compact review derivative rather than the 1024px raw render.
- **[Risk] The paper tile on the dark theme.** The artwork's warm ivory paper is
  fixed in the pixels, so on `Nocturne` it reads as a light tile. Trimming the
  paper is forbidden by the pipeline doc. Mitigated by layout blending and flagged
  for native visual review rather than solved by destroying the source art.
- **[Risk] Technique false positives.** Mitigated by the leading-verb rule, the
  uniqueness constraint, and phrase-level guards, and bounded by the fact that a
  miss costs only the existing text-only step.
- **[Trade-off] Two manifests.** Slightly more pipeline branching in exchange for
  keeping the food schema's `FoodClass` validation strict.
