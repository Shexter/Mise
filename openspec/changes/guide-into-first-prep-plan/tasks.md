**Planning only.** These tasks are deliberately unchecked. Nothing here is
authorized for implementation until the open question in `proposal.md` and the
decisions in `design.md` are settled with the owner.

**Reconciled 2026-09-07.** The persistence and hand-off sections that used to
stand here — settle where a plan lives, add the plan migration and queries,
persist on completion, replace the finish action with a two-door bridge, widen
the Pantry banner — were removed, not completed. They are owned by
[`lead-with-weekly-meal-planning`](../lead-with-weekly-meal-planning/) §3.1–3.4
and §7.4–7.5, and `design.md` records where each one landed. Nothing in this
file has been ticked.

## 1. Settle the remaining question

- [ ] 1.1 Decide whether authored template steps carry a `techniqueId`, and if so add it to `CookingGuideStep` before planner snapshots start being written.

## 2. Step 3 — start with what you already have

- [ ] 2.1 Rebuild the screen camera-led: framed scan area with vector viewfinder corners, **Scan ingredients** primary into the existing `/pantry-capture` route.
- [ ] 2.2 Add suggested starter chips over broad canonical ingredients, using their existing tier-3 art; selecting one adds reviewable stock, not a stated fact about the kitchen.
- [ ] 2.3 Keep **Add by hand** and the catalogue path reachable, so no key and no camera still finishes the step.
- [ ] 2.4 Keep the microphone action a visible sibling of camera and manual entry per decision 180; verify it needs no scroll at 411 dp.

## 3. Step 4 — your first prep plan

- [ ] 3.1 Rebuild as hero dish, meta chips (appliance, portions, time), ingredient summary, numbered guide.
- [ ] 3.2 Render technique illustrations per step through `resolveTechnique()`, and make a mix of illustrated and text-only steps look deliberate rather than half-loaded.
- [ ] 3.3 Build the layout against fields present on both the current in-memory plan and a planner-supplied scheduled meal, so the data source can be swapped without a second rewrite.

## 4. Verification

- [ ] 4.1 `openspec validate guide-into-first-prep-plan --strict`, `npm run typecheck`, `npm test`. Record exact results.
- [ ] 4.2 Native review of both steps, including the no-key and no-camera paths, at 411 dp and at large text, in a light and the dark palette.
- [ ] 4.3 Confirm no plan storage, no migration, and no change to the kitchen branch's destination or the Pantry resume banner was introduced here.
