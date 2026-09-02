**Planning only.** These tasks are deliberately unchecked. Nothing here is
authorized for implementation until the open questions in `proposal.md` and the
decisions in `design.md` are settled with the owner.

## 1. Settle the open questions

- [ ] 1.1 Decide where a first plan is persisted, and whether that carries a forward-only migration.
- [ ] 1.2 Decide whether the cooking guide stays an onboarding sheet or becomes its own route.
- [ ] 1.3 Decide what a saved plan says once the pantry no longer matches it.

## 2. Persistence

- [ ] 2.1 Add the plan schema as a forward-only migration appended to `MIGRATIONS`.
- [ ] 2.2 Add plan read and write queries in `src/db/queries/`, with unit tests over the real SQL.
- [ ] 2.3 Persist the plan when the kitchen branch completes, and expose it through `cookingPreferencesStore`.

## 3. Hand-off

- [ ] 3.1 Replace `first-plan`'s finish action with the two-door bridge: start cooking now, or look around first.
- [ ] 3.2 Widen the Pantry resume banner to cover a completed setup holding an unstarted plan, and make it dismissible.
- [ ] 3.3 Make the banner disappear once the plan is started or discarded.

## 4. Step 3 — start with what you already have

- [ ] 4.1 Rebuild the screen camera-led: framed scan area with vector viewfinder corners, **Scan ingredients** primary.
- [ ] 4.2 Add suggested starter chips over broad canonical ingredients, using their existing tier-3 art.
- [ ] 4.3 Keep **Add by hand** and the catalogue path reachable, so no key and no camera still finishes the step.

## 5. Step 4 — your first prep plan

- [ ] 5.1 Rebuild as hero dish, meta chips, ingredient summary, numbered guide.
- [ ] 5.2 Render technique illustrations per step through `resolveTechnique()`, and make a mix of illustrated and text-only steps look deliberate.
- [ ] 5.3 Consider a `techniqueId` on authored template steps so step art is exact rather than inferred.

## 6. Verification

- [ ] 6.1 `openspec validate guide-into-first-prep-plan --strict`, `npm run typecheck`, `npm test`.
- [ ] 6.2 Native review of both steps and the hand-off, including the no-key and no-camera paths.
