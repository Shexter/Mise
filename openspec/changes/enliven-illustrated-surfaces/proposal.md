# Proposal: Bring the appliance step and the add sheet up to the concept

## Why

`connect-generated-illustrations` gave the appliance step real artwork, and the
owner's native review found the result bland: every appliance rendered as steel
grey, laid out as a vertical list of wide rows, each carrying a phrase of
explanatory copy.

The accepted concept for this step is a **two-column grid of coloured cookware**
— a sage air fryer, a cream rice cooker, a slate slow cooker, an olive
microwave — with a tick in the corner of each card and nothing but the
appliance's name beneath it. Someone picking their kitchen tools recognises a
rice cooker by sight; "Grains & one-pot steaming" is a caption for a thing they
already identified.

Two causes, and only one of them is layout:

1. The appliance briefs describe shape but never colour, so
   `natural material-accurate muted colors` in the locked style resolves every
   appliance to brushed steel.
2. The row layout gives each appliance a 56px thumbnail in a list built for
   text, so the artwork is an accessory to a label rather than the thing being
   chosen.

## What Changes

- **Appliance subject briefs name their colours.** Each of the seven gets an
  explicit palette drawn from the concept — sage, olive, warm cream, slate
  blue-grey, terracotta. The locked shared style, model, sampler configuration,
  and render settings are untouched, so this needs no workflow-version bump:
  `docs/asset-pipeline.md` permits changing a subject phrase and forbids
  changing the style.
- **The seven illustrations are regenerated and re-promoted** through the
  pipeline at the same derived seeds, with fresh provenance recording the new
  prompts.
- **The step becomes a two-column grid.** Each card is a tick in the top-left
  corner, the illustration, and a short name. The explanatory `detail` line is
  dropped from this surface.
- **`ApplianceInfo` gains `shortLabel`.** A grid cell cannot carry
  "Slow cooker / Pressure cooker" without wrapping to three lines. The long
  `label` stays authoritative for prose surfaces — the cooking guide's
  "Use: Cooktop / Stovetop" and the settings sheet — so no existing copy
  changes.
- **The "No appliances / no-cook ideas" option stays a full-width row.** It is
  not an appliance, it has no artwork, and it is the opt-out rather than a
  seventh thing to compare.
- **A fifth generated set, `action`,** gives the centre add sheet its concept
  artwork: a plated meal, a paper receipt, a jar and tin, and a table
  microphone, replacing four Feather glyphs.
- **The meal row gains vector scan-framing corners.** The concept draws the
  four corner brackets of a viewfinder around the meal. They are drawn by the
  component in vector, not painted into the artwork, because framing corners are
  functional chrome that has to stay crisp at any size and retint per theme —
  and the locked style asks for no border, so painting them in would fight the
  recipe rather than follow it.

## Capabilities

### Modified Capabilities
- `generated-illustration-registries`: the appliance requirement now specifies a
  grid of coloured cookware rather than illustrated rows, states that the
  artwork carries recognition while the tick carries selection, and adds the
  add-sheet action set with its vector framing corners.

## Non-goals

- Changing the locked Draw Things style, model, sampler configuration, render
  size, or workflow version. Only subject phrases change, plus one new set that
  reuses an existing style suffix verbatim.
- Regenerating the ingredient, state, onboarding, or technique sets.
- Changing which methods the add sheet offers, their order, their routes, or
  which one it leads with.
- Changing which appliances exist, their ids, their long labels, or anything
  that reads them — appliance ownership records and meal-prep filtering are
  untouched.
- Replacing the tick with painted artwork.

## Impact

- `assets/illustration-briefs.json` — seven appliance subject phrases.
- `assets/illustrations/appliance/*.webp` and its manifest entries, regenerated.
- `src/types.ts` — `ApplianceInfo.shortLabel`.
- `app/onboarding/appliances.tsx` — grid layout.
- `test/meal-prep-contracts.test.ts` — `shortLabel` contract.
- `assets/illustrations/action/*.webp`, a new `action` set in the briefs, and
  `src/media/actionIllustrations.ts`.
- `src/components/AddSheet.tsx` — illustrations and framing corners.
- `scripts/asset-inventory.ts` — the `action` set in `SET_TARGETS`.
- `scripts/generate-illustrations.ts` — `--force` can re-roll a promoted slot.
