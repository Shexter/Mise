# Current implementation handoff

Updated 9 August 2026 in `/Users/timothylauw/Documents/Github Repos/Mise`.

Use this document when a new conversation continues implementation. Verify the
live repository state before acting because Git and task counts can change.

## Owner instructions

- Do not archive an OpenSpec change until the owner tests it in the app.
- Prefer Expo Go for normal UI testing. Build a new APK only when native or
  standalone behavior needs verification.
- Preserve all existing worktree changes. Do not reset, discard, or replace
  them during an update from `main`.
- Do not inspect or expose API keys. Real-provider checks require the owner to
  configure a key through the app.

The Android and Expo Go procedure is in
[`docs/building-android-apks.md`](./building-android-apks.md).

## Git state at handoff

- Branch: `main`
- Current committed revision: `b507334`
- `origin/main` matched `b507334` before the current venue work started.
- Commit `b507334` contains the open-data catalogue work, logged-meal editing,
  history calendar, keyboard and scrolling fixes, tests, and the build guide.
- The `add-venue-inference` implementation is local and uncommitted.

Before changing or publishing anything, run:

```sh
git status --short --branch
git fetch origin --tags --prune
git rev-list --left-right --count HEAD...origin/main
```

Fetch is safe with a dirty worktree. Commit or otherwise preserve the venue
work before any rebase or merge.

### Current uncommitted venue files

Modified:

- `app/manual.tsx`
- `app/review.tsx`
- `docs/implementation-queue.md`
- `openspec/changes/add-venue-inference/design.md`
- `openspec/changes/add-venue-inference/proposal.md`
- `openspec/changes/add-venue-inference/tasks.md`
- `src/api/parse.ts`
- `src/api/prompt.ts`
- `src/db/queries.ts`
- `src/db/schema.ts`
- `src/logic/resolution.ts`
- `src/types.ts`
- `test/migrations.test.ts`

New:

- `src/logic/venue.ts`
- `src/logic/venueService.ts`
- `test/venue-parse.test.ts`
- `test/venue-query.test.ts`
- `test/venue-ui.test.ts`
- `test/venue.test.ts`

This handoff document is also new.

## OpenSpec state

Do not archive these changes yet:

| Change | Progress | Remaining evidence |
| --- | ---: | --- |
| `add-open-data-catalogue` | 62/67 | Five owner checks in the app |
| `edit-logged-meals` | 26/32 | Six Expo Go checks |
| `add-history-calendar` | 39/46 | Seven history-navigation checks |
| `add-venue-inference` | 26/38 | Twelve photograph, provider, and app checks |

`openspec list --json` is the live source for task counts. The implementation
order and gates are in [`docs/implementation-queue.md`](./implementation-queue.md).

## Venue inference implementation

The implementation has reached the automated boundary.

- `src/api/prompt.ts` asks for optional `venue_assessment` in the existing meal
  estimate request. No second provider request exists.
- `src/api/parse.ts` accepts `home` or `out`. Missing or invalid values become
  `null` without invalidating calories or macros.
- `src/logic/venue.ts` combines the model assessment, pantry stock ratio,
  outstanding portions, and learned dish default.
- `STOCK_MATCH_THRESHOLD` is `0.75`. It is provisional until measured against
  real photographs and pantry states.
- Any conflict among active signals resolves to `home`. This bias protects the
  pantry depletion loop from missed decrements.
- `src/logic/venueService.ts` performs on-device orchestration. Its identity
  lookup is read-only: no provider call, alias write, or match-queue write.
- Migration 11 adds `dish_venue_defaults`. A later correction replaces the
  previous value for the normalized dish name.
- Photo and manual flows infer venue. Cooked suggestions keep their known
  `home` venue and never teach a default.
- The visible segmented control remains authoritative. A user tap prevents
  later asynchronous inference from replacing the choice.
- Moving a photo meal away from `home` resets the servings multiplier to one.
- Pantry depletion still starts only after the user saves the meal.

The next schema change must append migration 12. Never edit migration 11 after
this work is committed.

### Venue checks still required

1. Collect at least 15 representative meal photographs.
2. Include home kitchens, restaurant tables, takeaway at home, and packed lunch
   settings.
3. Pair several photographs with pantry state.
4. Record one provider response per photograph.
5. Measure accuracy by venue before changing the `0.75` threshold.
6. Test home, restaurant, takeaway, batch, exhausted batch, and manual flows in
   the app.
7. Confirm every venue remains a one-tap change.
8. Record the measured accuracy and retained threshold in
   `docs/product-decisions.md`.

Do not mark tasks 1.1-1.3, 2.4, or 7.1-7.8 complete without this evidence.

## Automated verification

The following checks passed after the venue implementation and documentation
update:

```sh
npm run typecheck
npm test
openspec validate add-venue-inference --strict
git diff --check
```

Result: 47 test files and 526 tests passed. Vitest prints a future Vite config
warning and Node prints experimental SQLite warnings. Neither warning failed the
suite.

Run the checks again after any edit. Run every strict OpenSpec validation for a
change whose artifacts were modified.

## Next implementation queue

1. `add-energy-sources` is next and ready. Preserve the existing onboarding
   path as the preselected route.
2. `add-openai-provider` is ready and has no migration.
3. `add-unified-capture` is ready and closes the receipt-import dependency.
4. `add-barcode-capture` waits for unified capture.
5. `add-recipe-links` is ready.
6. `add-fibre-tracking` is ready. Missing fibre must remain unknown, not zero.

Do not implement `add-macro-gap-suggestions` from its current tasks. Its plan is
stale relative to the shipped dinner engine and nullable canonical nutrition.
Update that OpenSpec change first.

Run migration-bearing changes one at a time. `src/db/schema.ts` is a serialized
ledger, not a parallel-safe integration point.

## Earlier owner reports and current disposition

- Olive oil calorie autofill works.
- Dark soy sauce lacked automatic calories. The catalogue now uses the reviewed
  CoFID row: 79 kcal, 3.0 g protein, and 17.9 g carbohydrate per 100 g. Trace
  fat remains unknown instead of becoming zero.
- Meal entry keyboard coverage and post-photo scrolling were addressed in
  commit `b507334`. They still need owner acceptance in the app.
- Logged meals on Today can now open an editor. Editing and pantry reversal or
  reapplication remain pending owner acceptance.
- Historical dates now have week paging and a month calendar. They remain
  pending owner acceptance.
- The reported gray dot near the top-right of Today has no confirmed diagnosis
  recorded here. Reproduce it before changing UI code.

## Safe continuation sequence

1. Read this file and `docs/implementation-queue.md`.
2. Run the Git state commands above.
3. Preserve the uncommitted venue scope.
4. Run the automated verification commands.
5. If continuing venue work, gather real evidence and update only the remaining
   tasks.
6. If starting the next change, use `/opsx:apply add-energy-sources` and read all
   context files returned by OpenSpec.
7. Do not archive any owner-acceptance change until the owner confirms testing.
