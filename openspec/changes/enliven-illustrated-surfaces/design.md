## Context

The owner's native review of `connect-generated-illustrations` accepted the
artwork but rejected two surfaces as bland against the concept: the appliance
step (steel-grey pictures in a text-shaped list) and the centre add sheet (four
Feather glyphs where the concept has painted objects).

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Coloured cookware, reached by changing subject briefs only.
- A recognition-shaped grid for appliances instead of a reading-shaped list.
- The add sheet's four ways in, illustrated.

**Non-Goals:**
- Touching the locked style, model, sampler configuration, or render settings.
- Changing appliance ids, ownership records, meal-prep filtering, or the add
  sheet's methods, order, routes, or led row.

## Decisions

### 1. Colour belongs in the subject, not the style

- **Decision**: name each appliance's palette in its subject phrase. The shared
  appliance suffix keeps `natural material-accurate muted colors` unchanged.
- **Rationale**: that suffix is why every appliance came out steel — it is
  material-accurate about a stainless appliance. `docs/asset-pipeline.md` allows
  changing a subject phrase and requires a pilot, owner review, and a
  workflow-version bump for a style change. Naming "sage-green", "warm cream",
  "slate blue-grey" in the subject is the sanctioned lever, and the more
  specific instruction wins over the general one — the onboarding set already
  proves it, having produced a four-colour gauge under the same recipe.
- Palette is drawn from the concept and the Mise tokens: sage, olive, warm
  cream, slate blue-grey, terracotta. No appliance gets a colour the app's own
  surfaces do not already use.
- Seeds are unchanged (derived from the id, salt 0), so each appliance is a
  re-render of its own slot rather than a fresh roll of the dice.

### 2. A grid, because this is recognition and not reading

- **Decision**: two columns, tick in the top-left corner of each tile, 96px
  illustration, short name beneath. The `detail` line is dropped here.
- **Rationale**: someone knows their own rice cooker by sight. In a row layout
  the picture is a 56px accessory to a label, and "Grains & one-pot steaming" is
  a caption for a thing already identified. The grid makes the picture the thing
  being chosen and halves the vertical run, so all seven are comparable without
  scrolling past the fold.
- `detail` stays on `ApplianceInfo` and stays rendered in the settings sheet,
  where the list is a reference rather than a first-run choice.
- **`shortLabel` is a new field, not a rename.** A tile has one line;
  "Slow cooker / Pressure cooker" wraps to three. The long `label` is still what
  the cooking guide says in prose ("Use: Cooktop / Stovetop"), so renaming it
  would have changed copy on a surface nobody asked to change.
- The no-appliances opt-out stays a full-width row. It is not an appliance, it
  has no artwork, and it is the one choice whose consequence a picture cannot
  carry.

### 3. Framing corners are vector, the meal is paint

- **Decision**: `AddSheet` renders the `log-meal` artwork inside four
  absolutely-positioned corner brackets built from borders on empty views.
- **Rationale**: the corners are viewfinder chrome — the same mark the concept
  puts around the starter-pantry scan area. Chrome has to stay crisp at any size
  and retint per theme, which a raster corner cannot do; and the locked style
  suffix ends in `no border`, so painting them in would be prompting against the
  recipe. Drawing them in vector gets the concept's look without either
  compromise, and it means the corners can later frame a different illustration
  without regenerating anything.

### 4. `--force` may re-roll a promoted slot

- **Decision**: the generation filter now keeps `done` slots when `--force` is
  passed.
- **Rationale**: a bug this change was the first to hit. `inventory()` marks a
  slot `done` once file, manifest, and registry agree, and generation dropped
  every `done` slot *before* `--force` was applied — so the documented re-roll
  flag silently did nothing on shipped art, and the only route to changing it
  was hand-deleting files, which is exactly the undocumented copying the
  pipeline exists to prevent.

## Implementation Seams

- `assets/illustration-briefs.json` — appliance subjects, new `action` set,
  `action` suffix aliased to the existing `state` wording.
- `assets/illustrations/{appliance,action}/`, `manifest.json`.
- `src/types.ts` — `ApplianceInfo.shortLabel`.
- `src/media/actionIllustrations.ts` — new registry.
- `app/onboarding/appliances.tsx`, `src/components/AddSheet.tsx`.
- `scripts/asset-inventory.ts`, `scripts/generate-illustrations.ts`.
- `test/meal-prep-contracts.test.ts`, `test/illustration-registries.test.ts`.

No database schema change.

## Risks / Trade-offs

- **[Risk] Named colour fights material accuracy.** A prompt asking for a
  sage-green air fryer under a suffix asking for material-accurate colour could
  return a grey one anyway. Mitigated by contact-sheet review before promotion;
  if the subject lever proves insufficient the escalation is a pilot and a
  workflow-version bump, not a quiet style edit.
- **[Trade-off] `shortLabel` is a second name per appliance.** Two names can
  drift. The contract test pins the short one to be no longer than the full one
  and free of slashes, so a drift that matters fails the suite.
- **[Risk] Seven tiles plus an opt-out is a taller step than six.** Accepted:
  the grid is still shorter than the seven-row list it replaces.
