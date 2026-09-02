# Illustration pipeline

How Mise's illustrations get made, reviewed, and shipped. Written for agents
picking the work up cold.

The list of what still needs making is **computed, not written down**. Run:

```sh
npm run art:list
```

Do not maintain a to-do file by hand — it drifts from the catalogue the day
someone adds an ingredient.

---

## What is and is not generated

This matters more than anything else here. Getting it wrong wastes a lot of
compute on assets that can never ship.

### Generated (1024×1024 raw PNG, reviewed as a 512×512 `.webp`)

All five sets are wired and shipped. `npm run art:list` is the authority; this
table is the map.

| Set | Count | Consumer | Registry |
| --- | --- | --- | --- |
| Ingredient illustrations | 116 | `FoodVisual` tier 3 | `CURATED_FOOD_ILLUSTRATIONS` in `src/media/foodVisuals.ts` |
| Appliance illustrations | 7 | `app/onboarding/appliances.tsx` | `APPLIANCE_ILLUSTRATIONS` in `src/media/onboardingIllustrations.ts` |
| Named state illustrations | 4 | `StateIllustration` | `STATE_ILLUSTRATIONS` in `src/media/stateIllustrations.ts` |
| Onboarding goal illustrations | 2 | `app/onboarding/goals.tsx` | `GOAL_ILLUSTRATIONS` in `src/media/onboardingIllustrations.ts` |
| Cooking technique illustrations | 12 | `app/recipe/[id].tsx` | `TECHNIQUE_ILLUSTRATIONS` in `src/media/techniqueIllustrations.ts` |

### Never generated (vector, stays vector)

- **Feather glyphs** — `chevron-right`, `check`, `x`, `plus`, `camera`, `mic`
  and ~18 more. These are functional micro-UI at 16–20px. A diffusion model
  cannot produce a crisp, recolourable 16px chevron, and these have to retint
  per theme and per state.
- **Bottom-navigation glyphs** — `src/components/icons/NavIcons.tsx`. Hand-drawn
  SVG, with outline and filled variants for active state.
- **The Pantry sprig** — `src/components/icons/Sprig.tsx`.
- **Category fallback badges** — `CATEGORY_FALLBACK_TOKENS` in
  `src/media/foodVisuals.ts`. Tier 4 is a *reviewed* state, not a missing one:
  it is what every food falls back to, so it must theme cleanly.
- **Dish plates** — `DishVisual` composes a plate procedurally from a dish's
  food-class mix. Dishes are unbounded; per-dish art is not generable.

If you are about to generate something in the second list, stop.

---

## The hard gate

`assets/food/README.md` rule 4: an asset ships only once **the owner has
accepted the surrounding UI through native visual review**. Art direction
follows the implemented app; it does not lead it.

**That gate has been cleared.** The owner accepted the implemented surfaces
through native review, and `connect-generated-illustrations` promoted all 141
reviewed candidates. The tripwire test that asserted an empty pack —
`test/food-visuals.test.ts`, "Tier 3 is empty until art direction is accepted" —
now reads "Tier 3 ships the reviewed pack, and every unshipped food still
resolves", holding the other half of the same promise: a populated tier 3 must
not break the fallback that used to catch everything.

The gate is cleared, not removed. What replaces it is the promotion boundary:
candidates live in the git-ignored `.art-staging/` tree, nothing renders from
there, and shipping still means `--promote` with a named reviewer. A new pack in
a new style would need the same owner review over again.

---

## Prerequisites

```sh
brew install draw-things-cli imagemagick
draw-things-cli models ensure --model flux_2_klein_4b_q8p.ckpt
```

The approved broccoli was generated with Draw Things CLI `1.20260430.0`,
`flux_2_klein_4b_q8p.ckpt`, 1024×1024 output, 4 steps, CFG 1, and the sampler
configuration in `assets/illustration-draw-things-config.json`. The model file
SHA-256 is recorded in `assets/illustration-briefs.json`.

That exact broccoli command was rerun and produced the same PNG byte-for-byte.
Do not upgrade the CLI, replace the model, change the sampler configuration, or
rewrite the shared style halfway through a pack. A deliberate recipe change
requires a new pilot contact sheet, owner review, and workflow-version bump.

### Gold-master broccoli command

This is the original command that produced the accepted broccoli. Keep the
prompt verbatim. It is the visual reference for every generated ingredient.

```sh
draw-things-cli generate \
  --model flux_2_klein_4b_q8p.ckpt \
  --prompt "A single fresh broccoli crown, refined hand-painted 2D editorial food illustration, delicate dark ink outlines, natural deep green and sage colors, warm ivory paper background, three-quarter view, centered composition, soft oval grounding shadow, generous negative space, charming premium cookbook artwork, no text, no label, no packaging, no plate, no utensils, no border, not photorealistic" \
  --width 1024 \
  --height 1024 \
  --seed 240524 \
  --output "$HOME/Pictures/Mise-ingredient-pilot/broccoli.png" \
  --terminal-image
```

The repository pipeline adds the pinned four-step, CFG-1 sampler configuration
and offline flags. Those additions reproduce this command byte-for-byte with
the recorded Draw Things version and model checksum.

On a new machine, verify the complete recipe before generating a batch:

```sh
npm run art:make -- --verify-gold
```

The command must reproduce the recorded broccoli SHA-256 exactly. A mismatch
means the tool, model, sampler configuration, prompt, or render path has drifted;
stop rather than generating a mixed-style pack.

---

## The loop

### 1. See what is outstanding

```sh
npm run art:list              # summary by set, with blockers
npm run art:list -- --todo    # bare ids, one per line
npm run art:list -- --json    # full slots, for scripting
```

Status is derived, never stored. An asset counts as shipped only when all three
of these agree — the same three `test/food-visuals.test.ts` enforces:

1. `assets/food/<id>.webp` exists on disk
2. `assets/food/manifest.json` has its entry, checksum matching the bytes
3. `CURATED_FOOD_ILLUSTRATIONS` in `src/media/foodVisuals.ts` `require()`s it

Anything half-done is reported as `INCONSISTENT`, which is a bug to fix rather
than a slot to regenerate.

### 2. Generate a batch to staging

```sh
npm run art:make -- --set ingredient --limit 8
npm run art:make -- --only broccoli,eggs --force --salt 1   # re-roll two
```

Output lands in `.art-staging/<set>/` (git-ignored) plus a contact sheet at
`.art-staging/<set>-contact-sheet.png`. Nothing touches `assets/food/`.

Work in batches of ~8 and look at the sheet. Generating all 116 before looking
means re-rolling 116.

Seeds are derived from the canonical id, so a re-run reproduces the same image.
The approved broccoli uses its original fixed seed, `240524`. To get a different
candidate for one id, bump `--salt`; a salt always opts out of the fixed seed.

Generation refuses to run for a set whose consumer is not wired — those assets
would render nowhere. `--ignore-blocked` overrides, but build the slot first.

### 3. Review

Open the contact sheet. Reject anything that:

- carries text, a watermark, a logo, or a signature
- reads ambiguously at 44px — that is the size it renders at in a pantry row
- loses the warm ivory paper texture or restrained oval grounding shadow
- looks like flat clip-art, vector geometry, emoji, sticker art, or a stock icon
- uses one dead fill instead of hand-painted tonal variation
- is not recognisably the ingredient

Re-roll rejects with `--only <id> --force --salt N`.

### 4. Promote what passed

```sh
npm run art:make -- --promote broccoli,eggs --reviewer "Your Name"
npm run art:make -- --set technique --promote all --reviewer "Your Name"
```

This copies the file in, writes a full provenance entry (model, exact prompt,
seed, workflow version, review date, reviewer, sha256), and regenerates the
registry block. `--reviewer` is required: `assets/food/README.md` is explicit
that approval is a person, not a timestamp, and a fabricated provenance record
is worse than no entry.

`--set` picks which of the five sets the ids belong to (default `ingredient`),
and routes the file, the manifest entry, and the registry rewrite accordingly.
`--promote all` promotes every staged slot in that set.

Ingredients land in `assets/food/` under `assets/food/manifest.json`. The other
four sets land in `assets/illustrations/<set>/` under
`assets/illustrations/manifest.json`. Two manifests rather than one because a
food entry is keyed by canonical ingredient id and carries a required
`FoodClass`; an appliance has no food class, and relaxing that field to share one
schema would weaken the check that actually protects tier 3.

Then:

```sh
npm test -- food-visuals
npm test -- illustration-registries
npm run typecheck
```

---

## Style

Prompts are assembled from `assets/illustration-briefs.json` — the one authored
file in the pipeline. It holds the locked shared suffixes, natural palette
guidance, exact gold-master prompt and seed, and subject briefs.

Agents may change only the subject phrase for an ingredient. They must not
replace “hand-painted editorial food illustration” with “flat vector”, remove
paper grain or the grounding shadow, add a separate negative prompt, or reduce
the 1024px generation size. Those changes produced the rejected clip-art look.

Edit briefs there, never inline in the script. If you change `style`, bump
`workflowVersion` so already-shipped assets remain traceable to the wording that
actually produced them.

The house style is the approved broccoli: delicate varied ink, natural muted
colour, visible hand-painted tonal detail, warm ivory paper, three-quarter view,
a restrained oval shadow, and generous negative space. No mascots, medical
imagery, body-evaluating imagery, readable packaging text, logos, or branding.

---

## Paper background

The warm ivory paper and grounding shadow are part of the accepted art
direction. Do not flood-fill, trim, or remove them. The pipeline keeps the
1024px raw PNG in staging and derives a 512px quality-90 WebP for contact-sheet
review and eventual promotion. Theme treatment for this intentional paper tile
belongs to native visual review; it must not be “fixed” by destroying the source
art.

---

## Adding a new set

1. Add its briefs to `assets/illustration-briefs.json` under `sets`, with
   `consumer`, `consumerWired: false`, and a `blockedBy` explaining what is
   missing.
2. Build the UI slot that renders it.
3. Flip `consumerWired` to `true`.
4. Add the set to `SET_TARGETS` in `scripts/asset-inventory.ts` — its asset
   directory, manifest, registry module, registry const, manifest key, and
   require path. `promote()` and `npm run art:list` both read that one table, so
   nothing else in the pipeline needs editing.
5. Create the registry module with an `export const <NAME>: Record<…,
   ImageSourcePropType> = {};` line for the writer to rewrite, and add its parity
   check to `test/illustration-registries.test.ts`.

Never hand-copy a file into `assets/` with a hand-written manifest entry. That is
the fabricated provenance `assets/food/README.md` calls worse than no entry at
all — and `npm run art:list` will report the result as `INCONSISTENT` anyway.
