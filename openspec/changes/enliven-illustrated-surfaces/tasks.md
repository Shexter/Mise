## 1. Art

- [x] 1.1 Rewrite the seven appliance subject briefs to name their colours, drawn from the concept and the Mise palette. Leave `style`, `render`, `model`, and `workflowVersion` untouched.
- [x] 1.2 Add an `action` set to the briefs with the four add-sheet subjects, its suffix aliased to the existing `state` wording, `consumerWired: false`, and a `blockedBy`.
- [x] 1.3 Fix `--force` so it can re-roll an already promoted slot; without it the documented re-roll flag silently does nothing on shipped art.
- [x] 1.4 Regenerate the seven appliances and generate the four actions to staging, then review both contact sheets before promoting anything.

## 2. Pipeline and registries

- [x] 2.1 Add the `action` set to `SET_TARGETS` in `scripts/asset-inventory.ts`.
- [x] 2.2 Create `src/media/actionIllustrations.ts` with its typed registry and generated block.
- [x] 2.3 Extend `test/illustration-registries.test.ts` to hold the action registry to the manifest in both directions.

## 3. Appliance grid

- [x] 3.1 Add `shortLabel` to `ApplianceInfo` and the catalogue, and pin it in `test/meal-prep-contracts.test.ts`.
- [x] 3.2 Rebuild `app/onboarding/appliances.tsx` as a two-column grid: corner tick, illustration, short name, no detail line.
- [x] 3.3 Keep the no-appliances opt-out a full-width row with its explanatory line, and keep it clearing ticked appliances.
- [x] 3.4 Scale the tile label's line height with the system font scale so it cannot clip at a large text size.

## 4. Add sheet

- [x] 4.1 Render the promoted action artwork on the four illustrated methods, falling back to the existing Feather glyph where a method has no entry.
- [x] 4.2 Draw the meal row's scan-framing corners in vector around its artwork.

## 5. Promotion and verification

- [x] 5.1 Promote both sets with a named reviewer, then flip `consumerWired` to `true` for `action`.
- [x] 5.2 `openspec validate enliven-illustrated-surfaces --strict`, `npm run typecheck`, `npm test`, `npm run art:list`, `git diff --check`.
- [x] 5.3 Native review on the emulator: the appliance grid selected and unselected, at default and increased text size, and the add sheet. Screenshots into `docs/ui-overhaul/connected-illustrations/`.
