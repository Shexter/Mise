## 1. Schema and types

- [x] 1.1 Append a migration creating `fasts`: `id`, `started_at`,
      `ended_at` (nullable), `target_duration_minutes` (nullable),
      `created_at`.
- [x] 1.2 Add `DROP TABLE IF EXISTS fasts;` to `DROP_ALL`.
- [x] 1.3 Add a `Fast` type to `src/types.ts`.
- [x] 1.4 Verify the migration runs from the current head and
      `npm run typecheck` passes.

## 2. Query layer

- [x] 2.1 Add start/end/list-history/get-active queries to
      `src/db/queries.ts` — all SQL for this feature lives here, per the
      project's non-negotiable convention.
- [x] 2.2 The start query rejects (or the calling code checks before
      inserting, atomically) when an active fast already exists — enforced
      at this layer, not only by a disabled UI button.
- [x] 2.3 Test: starting with no target, starting with a target, ending an
      active fast records duration correctly, attempting to start a second
      fast while one is active is rejected.
- [x] 2.4 Test a fast whose start and end fall on different device-local
      dates is stored and read back as one interval, not split.

## 3. Structural isolation (the load-bearing constraint)

- [x] 3.1 Confirm no file added by this change imports anything from
      pantry depletion, consumption-event, or capture-review modules.
- [x] 3.2 Add a lint rule or dependency-check test (matching whatever
      mechanism the codebase already uses for similar boundaries, if any)
      asserting the fasting module has no such import — so the boundary is
      enforced by tooling, not only by this task list.
- [x] 3.3 Test explicitly: starting and ending a fast against a populated
      pantry and meal history produces zero changes to `pantry_items`,
      `meals`, `meal_items`, or `consumption_events`.

## 4. UI

- [x] 4.1 Add a start/active-timer/end screen or sheet, and a history list,
      following existing navigation conventions (see design.md's open
      question on placement).
- [x] 4.2 All colour/font/spacing from `src/constants/theme.ts` — no
      literals.
- [x] 4.3 Elapsed-time display updates while a fast is active without
      requiring a manual refresh.
- [x] 4.4 Test accessibility: large text, screen reader labels for
      start/end/elapsed state, reduced motion for any timer animation.

## 5. Quality gates

- [x] 5.1 Run `npm run typecheck`, the full Vitest suite, and strict
      OpenSpec validation.
- [x] 5.2 Confirm *Delete all data* removes fasting history along with
      everything else, via the `DROP_ALL` addition in task 1.2.
- [ ] 5.3 Owner device check: start a fast, background the app, return, end
      it, confirm history is correct, and confirm pantry/meal state is
      provably unaffected across the whole flow.
