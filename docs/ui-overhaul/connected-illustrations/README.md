# Connected illustrations — native review

Device captures from the `connect-generated-illustrations` change, which promoted
the 141 reviewed Draw Things candidates out of `.art-staging/` and wired the four
previously unwired sets to real consumers.

Unlike the concept images elsewhere in `docs/ui-overhaul/`, **these are native
screenshots of the running app**, not proposals. Pixel 10a emulator (API 36),
debug build over Metro, 1 September 2026.

## Captures

| # | Screenshot | What it shows |
| --- | --- | --- |
| 01 | [Goals, both selected](01-onboarding-goals-both-selected.png) | Generated goal artwork replaces the procedural meter and bowl. Both cards selectable at once; equal-height contained illustrations; checkbox and border remain vector. |
| 02 | [Goals, meal prep only](02-onboarding-goals-meal-prep-only.png) | The same two cards with the calorie goal deselected — selection is independent per card, and the artwork is unchanged by it. |
| 03 | [Goals at 1.6× text](03-onboarding-goals-large-text.png) | Titles and details wrap to three lines and stay fully readable at an enlarged system text size. |
| 04 | [Appliances](04-onboarding-appliances.png) | Each `APPLIANCE_CATALOGUE` row carries the illustration promoted for its own id. |
| 05 | [Rice cooker vs slow cooker](05-onboarding-appliances-rice-and-slow-cooker.png) | The two deliberately distinct final rerolls, side by side, plus two selected rows with their ticks intact. The “No appliances” row correctly has no artwork. |
| 06 | [Pantry with generated visuals](06-pantry-generated-ingredient-visuals.png) | Tier 3 live: chicken breast, salmon, firm tofu, eggs and yellow onion each resolve to their promoted illustration. |
| 07 | [User photo overrides the illustration](07-pantry-user-photo-overrides-illustration.png) | The same list with a retained photograph on the chicken breast row. Tier 1 wins; its neighbours still show tier 3. |
| 08 | [Empty pantry](08-pantry-empty-state.png) | The image-backed `empty-pantry` state, shown only once the pantry has loaded and is genuinely empty. |
| 09 | [First saved meal](09-today-first-saved-meal-state.png) | The `first-saved-meal` artwork in Today’s “Nothing logged yet” card. |
| 10 | [Recipe technique steps](10-recipe-technique-steps.png) | Seven of nine method steps illustrated — chop, sauté, simmer, boil, grill, rest, serve. |
| 11 | [Dinner error, no artwork](11-dinner-error-has-no-illustration.png) | Counter-evidence: the suggestion **error** branch renders its existing copy with no illustration. Artwork is wired to the empty branch only. |

From `enliven-illustrated-surfaces`, which recoloured the appliance set and
illustrated the add sheet after the owner's review of the captures above:

| # | Screenshot | What it shows |
| --- | --- | --- |
| 12 | [Appliance grid](12-appliance-grid-coloured-cookware.png) | The recoloured cookware in a two-column grid — cream stovetop and oven, olive microwave, sage air fryer, cream rice cooker, slate slow cooker. Tick in the corner, short name, no explanatory line. Two tiles selected. |
| 13 | [Add sheet](13-add-sheet-illustrated-methods.png) | The four ways into Mise as painted objects, with vector viewfinder corners around the meal. "Cook something" keeps its Feather glyph, which is the registry's designed fallback for a method with no promoted artwork. |

## What 10 and 11 are really showing

Screenshot 10 is as much about the two steps with **no** picture as the seven
with one. “Heat a splash of oil in a heavy-based pan” and “Add the tomatoes,
then season well” match no technique in the bounded vocabulary, so they render
as the numbered text they always were. `resolveTechnique()` returns `null`
rather than reaching for an approximately-related picture.

Screenshot 11 is the same principle for states. A provider failure is not an
empty result and not a bad photograph, so it gets no artwork.

## Reproducing these

The pantry photograph in 07 is a synthetic stand-in staged directly into the
device database for the capture, and was removed afterwards along with the demo
recipe behind 10. The emulator was left holding its original data.

## Known visual notes

- The artwork's warm ivory paper is baked into the pixels, so a contained
  illustration reads as a slightly lighter tile against `color.surface`. It is
  most visible in 08 and 09, least in 06. `docs/asset-pipeline.md` forbids
  trimming or flood-filling that paper, so the tile is blended by layout —
  masked to the surrounding radius, no border, no contrasting backing panel —
  rather than by editing the source art.
- Every capture is on the default `organic` light theme. The paper will read as
  a light tile on the `Nocturne` dark theme; that remains open for owner review.
