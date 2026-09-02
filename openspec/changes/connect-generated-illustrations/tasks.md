## 1. Asset architecture and provenance

- [x] 1.1 Add `assets/illustrations/manifest.schema.json` with the same provenance fields as the food manifest, keyed `<set>/<id>`, and an empty `assets/illustrations/manifest.json` declaring it.
- [x] 1.2 Extend `promote()` in `scripts/generate-illustrations.ts` to accept `--set`, route ingredients to `assets/food/` and the other four sets to `assets/illustrations/<set>/`, and still refuse promotion without `--reviewer`.
- [x] 1.3 Add per-set registry writers so promotion rewrites the generated block in the matching `src/media/*.ts` module.
- [x] 1.4 Teach `scripts/asset-inventory.ts` to derive file/manifest/registry status for all five sets, so `npm run art:list` reports the non-ingredient sets truthfully.
- [x] 1.5 Flip `consumerWired` to `true` and drop the stale `blockedBy` notes in `assets/illustration-briefs.json`. Do not touch `style`, `render`, `model`, or `workflowVersion`.

## 2. Registries and pure logic

- [x] 2.1 Create `src/media/onboardingIllustrations.ts` with typed `GOAL_ILLUSTRATIONS` and `APPLIANCE_ILLUSTRATIONS` registries and their generated blocks.
- [x] 2.2 Create `src/media/stateIllustrations.ts` with the four approved state roles as a literal union and its generated block.
- [x] 2.3 Create `src/media/techniqueIllustrations.ts`: the twelve-id vocabulary, the keyword table with its documented false-positive guards, and `resolveTechnique()`.
- [x] 2.4 Add `test/illustration-registries.test.ts` covering technique matching (explicit id, leading verb, ambiguity, no match, the `rest of`/`baking powder`/`per serving` traps, determinism) and manifest↔registry parity with checksum verification for the non-food sets.

## 3. Promote the art

- [x] 3.1 Promote the 116 reviewed ingredient candidates into `assets/food/` with full provenance, then confirm `npm run art:list` reports 116 shipped and nothing `INCONSISTENT`.
- [x] 3.2 Promote the 7 appliance, 4 state, 2 onboarding, and 12 technique candidates into `assets/illustrations/`.
- [x] 3.3 Update the "Tier 3 is empty" tripwire in `test/food-visuals.test.ts` to assert the pack is populated, every entry resolves, and the unshipped fallback path still works.

## 4. Surfaces

- [x] 4.1 Replace the procedural meter and bowl in `app/onboarding/goals.tsx` with the two goal illustrations: equal-height bands flush to the card top, contained, checkbox and selected states left as vector UI.
- [x] 4.2 Verify both goal cards remain independently selectable with either, both, or neither selected, and that titles and details do not wrap or overflow at increased text size.
- [x] 4.3 Add the appliance illustration to each `APPLIANCE_CATALOGUE` row in `app/onboarding/appliances.tsx`, keeping the tick, hit target, and accessible state intact.
- [x] 4.4 Extend `src/components/StateIllustration.tsx` with the image-backed variant and its fallback to the existing procedural shelf.
- [x] 4.5 Wire the four state illustrations to their semantically matching states only — pantry empty, first meal, capture with no proposals, no dinner suggestion — leaving loading and error branches untouched.
- [x] 4.6 Add `src/components/TechniqueIllustration.tsx` and render it on recipe method steps in `app/recipe/[id].tsx`, falling back to the existing numbered text when no technique resolves.
- [x] 4.7 Update the `StateIllustration` assertion in `test/brand-system.test.ts` to protect what it was actually protecting — static, token-driven, reduced-motion-safe — now that the file holds an image variant.

## 5. Documentation

- [x] 5.1 Update `docs/asset-pipeline.md`: the gate is cleared, all five sets are wired, and promotion covers every set.
- [x] 5.2 Update `assets/food/README.md` — the pack is no longer empty — and add `assets/illustrations/README.md` for the second tree.
- [x] 5.3 Update `add-visual-food-identity-system`'s proposal and tasks so its "Tier 3 ships empty" narrative no longer contradicts the shipped pack.

## 6. Verification

- [x] 6.1 `openspec validate connect-generated-illustrations --strict`, `npm run typecheck`, `npm test`, `npm test -- food-visuals`, `git diff --check`.
- [x] 6.2 Run on the Android emulator and visually inspect onboarding goals, appliance selection, pantry with generated ingredient visuals, a pantry item with a user-captured photo, one empty state, and a recipe with several technique illustrations.
- [x] 6.3 Capture screenshots of those states into `docs/ui-overhaul/connected-illustrations/`.
