## Why

Mise has no concept of a fast — not a start time, not a window, not a
history. A user who eats on a time-restricted schedule has nowhere to
record it and nothing telling them how long they've gone.

Competitor teardown: `competitor-analysis/cronometer/other/
quick-input-and-settings-hub.md` and `CRONO-ADAPTATION-PLAN.md` item 4.
Note on evidence: the screenshots captured show "Fasting" in Cronometer's
More/settings list and "New Fast" in its global quick-add sheet — the
actual fasting screen itself was not among the captured screenshots. This
proposal is scoped from the reasonable shape a fasting timer takes (start,
target duration, active/complete state, history), not from an observed
Cronometer UI, and should be read as such.

Initially verdicted Reject in the teardown as scope creep unrelated to
pantry depletion; reinstated on review. The boundary that made it a
plausible reject is exactly what this proposal holds onto: a fast is a
timer, not a capture event, and must never be allowed to touch pantry or
meal logic.

## What Changes

- **A fasting-window timer**: start now, optionally with a target duration;
  end it manually; see elapsed time while active.
- **A completed-fast history**: past fasts with their actual start, end,
  and duration.
- **One active fast at a time.** Starting a new one while another is active
  is not a valid state this proposal creates a path to.
- **A fast is not tied to `local_date`.** `src/logic/dates.ts` groups
  meals by device-local midnight; a fast is a continuous interval that
  routinely crosses that boundary and is stored as one row with a start and
  an end, never split at midnight.
- **No reminders, no notifications, no streaks.** Mise has no push
  notification system today (nothing in the codebase uses
  `expo-notifications`), and this proposal doesn't introduce one. No
  gamification layer either — a fast either happened or it didn't; nothing
  here scores that.
- **Explicitly, structurally separate from capture and depletion.** A fast
  starting or ending writes to its own table and nothing else. It never
  creates, modifies, or reverses a `pantry_items` row, a `consumption_
  events` row, or a meal. This is a boundary, not a convention — enforced
  by the fact that nothing in the fasting code path imports depletion
  logic, not by a comment asking future contributors to be careful.

## Capabilities

### New Capabilities

- `fasting-tracking`: Starting, ending, and reviewing time-restricted
  eating windows — a self-contained timer and history with no connection
  to pantry depletion, meal logging, or the capture pipeline.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Any coupling to meal logging or pantry depletion.** See What Changes —
  this is the load-bearing constraint of the whole proposal.
- **Reminders, notifications, or streaks.** No push system exists in this
  app today; not introduced here. No scoring, no gamification.
- **Suggesting or logging a meal when a fast ends.** A plausible future
  integration point (per `CRONO-ADAPTATION-PLAN.md` item 4's open
  question), deliberately not built here — ending a fast writes only to
  the fasting table.
- **Fasting-window recommendations or health guidance.** The app records
  what the user did. It does not suggest a window, a schedule, or claim any
  health benefit — the same boundary `add-energy-sources` already drew for
  itself around diagnosis and advice.
- **Editing a past fast's times after the fact**, beyond what's needed for
  correcting an obvious mis-tap (e.g. forgot to end one). If this turns out
  to be needed, it's small follow-up work, not part of this proposal's
  scope.

## Impact

**Schema.** One new table: `fasts` — id, `started_at`, `ended_at` (nullable;
null means active), `target_duration_minutes` (nullable), `created_at`.
Appended as one forward-only migration; `DROP_ALL` gains the table so
*Delete all data* removes fasting history along with everything else.

**Code.**
- `src/db/queries.ts` — start, end, and list-history queries. All SQL for
  this feature lives here, per the project's non-negotiable convention.
- `src/types.ts` — a `Fast` type.
- A new store (`src/store/fastingStore.ts` or similar) and screen(s),
  reachable from the tab/settings structure, following existing navigation
  conventions rather than introducing a new pattern.
- Theme tokens from `src/constants/theme.ts` throughout, no literals — same
  as every other surface.

**Dependencies.** None added.

**Risk.** Low, structurally — the entire risk surface of this feature is
"does it stay out of pantry/meal logic," which is enforced by having
nothing in its code path import that logic, not by a runtime check that
could be bypassed.
