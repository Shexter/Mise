## Context

See `proposal.md` for motivation and `specs/logged-meal-editing/spec.md` for behavior. Today already passes an `onPress` callback into `src/components/MealRow.tsx`, but `app/(tabs)/index.tsx` routes it to an empty `scrollToMeal` function. `src/db/queries.ts` can fetch, insert, delete, and restore meals but cannot update one. Depletion already has the correct conceptual primitive—reverse recorded events and reapply planned events—but meal persistence and depletion must share a transaction for an edit.

Decisions 9, 11, and 51 make venue and servings edits pantry-affecting. Decision 79 requires an existing `canonicalId` to survive editing unless the user deliberately selects a different catalogue ingredient. Decisions 76 and 82 require visible post-save state and reversal of what was actually applied, not what was originally intended.

## Goals / Non-Goals

**Goals:**

- Reuse the existing meal model and depletion ledger rather than create an edit-only record type.
- Make a saved edit all-or-nothing across the meal, items, pantry quantities, drift counters, and consumption events.
- Reuse established keyboard-aware, scrollable form components and theme tokens.
- Keep navigation stable for both today and a deliberately selected past date.

**Non-Goals:**

- No schema migration: the existing meal, meal-item, pantry, and consumption-event tables can represent the edited result.
- No image re-analysis, photo replacement, date/time editing, or history/version table.
- No attempt to fill catalogue nutrition that is absent from the committed seed.

## Decisions

### 1. Add a dedicated route keyed by meal id

Add `app/meal/[id].tsx`. `app/(tabs)/index.tsx` pushes this route from the existing row callback. The editor fetches the authoritative record with `getMeal(id)` rather than passing a mutable meal object through route parameters.

This keeps deep-link and stale-row handling explicit and avoids serialising item arrays into a URL. Reusing `app/manual.tsx` was considered, but that screen constructs a new meal, defaults date and source, and owns catalogue-driven single-item behavior; branching it into create and update modes would couple two different persistence lifecycles.

### 2. Edit a local draft and commit only on Save

The screen copies the fetched `MealWithItems` into controlled draft state. It reuses `Field`, `Segmented`, `Stepper`, `CanonicalPickerSheet`, and the keyboard-aware scroll/footer pattern. Item rows open an item editor that exposes the fields in the spec; newly added items receive ids only when the transaction is prepared, and stored item ids may be retained when their rows remain.

Back navigation compares a normalized draft snapshot with the loaded snapshot. An unchanged draft exits directly; a changed draft presents a discard confirmation. No database or depletion call occurs while fields are being edited.

### 3. One query-layer transaction replaces both persistence and depletion state

Add an edit input and a transactional update entry point in `src/db/queries.ts`. Before opening the transaction, the service resolves the corrected items into planned decrements without writing. Inside one exclusive SQLite transaction, the query-layer operation:

1. verifies that the target meal still exists;
2. reads the existing consumption events;
3. reverses those recorded events, including applied quantities and drift;
4. updates the meal’s editable columns while preserving identity and immutable metadata;
5. replaces the meal-item rows with the validated ordered draft;
6. applies the new planned decrements; and
7. inserts the replacement consumption events.

The transaction uses the existing reversal and application helpers, refactored to accept the current transaction handle where necessary. No computed old-versus-new delta is introduced: reverse-then-reapply is already the established rule and handles additions, removals, identity changes, venue changes, and multiplier changes uniformly.

A day-store `updateMeal` action coordinates validation/planning, invokes this transaction, invalidates meal-dependent suggestion data using the same policy as a newly logged meal, refreshes the selected date, and reports the resulting depletion summary. Calling the existing meal update and `redepleteForMeal` as two sequential transactions was rejected because a failure between them could leave the meal and pantry disagreeing.

### 4. Preserve immutable provenance and normalize venue semantics

The edit input cannot change `id`, `loggedAt`, `localDate`, `source`, `confidence`, `createdAt`, or `photoUri`. A non-home venue always stores `servingsMult = 1`. Existing `canonicalId` values stay attached to their item unless the user explicitly changes or clears the catalogue selection; editing only the display name must not silently re-resolve a known identity.

This prevents an edit from laundering provenance or moving history into another day. Date/time changes can be designed separately if later required.

### 5. Return to the same selected date and show evidence before confirmation

After commit, `useDayStore.refresh()` reloads the currently selected date and recalculates totals from its meals. The editor returns to Today without forcing `following = true`, so a meal opened from a past selected date returns to that date. The success toast appears only after the refreshed row and totals are available.

`MealRow` changes its accessibility hint from delete-only guidance to state that activation edits and swiping deletes. Swipe-to-delete remains independent.

## Risks / Trade-offs

- **[Risk] Refactoring depletion helpers to participate in a caller-owned transaction can change delete/undo behavior.** → Keep their public behavior stable and run existing depletion, delete, undo, clamp, and drift tests unchanged, then add edit-specific rollback tests.
- **[Risk] Replacing all item rows can lose stable ids.** → Retain ids for surviving stored items and assign new ids only to additions; test ordering and identity preservation.
- **[Risk] A stale editor could overwrite a meal changed elsewhere.** → Re-check existence inside the transaction. Concurrent editors are unlikely in a local single-user app; version columns and conflict merging are not justified here.
- **[Risk] The form can exceed a phone viewport and numeric keyboards can obscure fields.** → Use the established `KeyboardAvoidingView` plus `ScrollView` and pinned-footer pattern, with Android resize configuration already present.
- **[Trade-off] No edit history is retained.** → The corrected meal becomes authoritative. This matches current local-first deletion semantics and avoids a migration for a history surface not requested.

## Migration Plan

No database migration is required. Ship the route, transaction, store action, and row navigation together. Rollback removes the route and navigation entry; meals saved by the feature remain ordinary rows readable by the previous build.
