## Context

See `proposal.md` — Why. Mise has no fasting concept anywhere in the
schema, types, or logic today. This is new ground, not an extension of an
existing module — the design questions here are about drawing the right
boundary around a self-contained feature, not about fitting into an
established pattern.

`src/logic/dates.ts`'s `localDateString()` establishes device-local
midnight as the one place day-boundary logic lives, for meal grouping.
Fasting windows are a different kind of interval — continuous, frequently
spanning that boundary — and must not be forced through the same grouping.

## Goals / Non-Goals

**Goals:**

- A working timer: start, optional target, end, elapsed time, history.
- Zero coupling to pantry, meal, or capture logic — structurally, not just
  by convention.
- Fits existing navigation, theming, and query-layer conventions.

**Non-Goals:**

- Reminders, streaks, recommendations, meal-log integration on fast end.
  See the proposal.

## Decisions

### One table, start/end/target, no day-bucketing

`fasts(id, started_at, ended_at, target_duration_minutes, created_at)`.
`ended_at` null means the fast is active. No `local_date` column, no
grouping by calendar day.

*Why not store it as a per-day record:* a fast commonly starts in the
evening and ends the next morning — bucketing by `local_date` would either
split one fast into two rows or force an arbitrary choice of which day
"owns" it. A single interval with a start and an end has no such ambiguity
and needs no arbitrary rule.

### Exactly one active fast, enforced at the query layer

Starting a fast while one is already active (an existing row with
`ended_at IS NULL`) is rejected before an insert happens, not prevented
only by the UI disabling a button.

*Why at the query layer:* a UI-only guard can be raced or bypassed by a
future caller that doesn't go through the same screen. The invariant "at
most one active fast" is a fact about the data, so the data layer is where
it's enforced — the same reasoning `body_measurements`'s
provider-`PRIMARY KEY` already applies to a different invariant.

### Fasting code never imports depletion or capture modules

The store, queries, and screens for this feature have no dependency on
`src/logic/stockDepletion.ts` (or equivalent), `consumption_events`
queries, or any capture-review screen. This is checked by what the code
imports, not asserted in a comment.

*Why structural rather than a convention:* the proposal's central claim is
that a fast is a timer, not a capture event. A convention ("please don't
touch depletion from here") degrades the first time someone has a good
reason to add a small integration. An import boundary that simply doesn't
exist can't degrade — there's nothing to route around by accident.

*Where the future integration point would live, if ever built:* ending a
fast could prompt a *separate*, explicit action — "log what you ate" —
that goes through the existing capture flow like any other meal. That flow
is untouched by this proposal; the prompt itself is explicitly out of
scope (see Non-Goals) precisely so this change ships without deciding it.

### No target duration is required to start a fast

A fast can be started with `target_duration_minutes: null` — an open-ended
timer the user ends manually, or with a target the app can show progress
against.

*Why not require a target:* Cronometer's own quick-add is "New Fast," not
"New 16-hour fast" — a target is useful context, not a precondition for
starting. Requiring one adds a decision to the fastest, simplest action
this feature offers.

## Risks / Trade-offs

**Scope creep is the named risk of this whole feature** → mitigated
structurally (no depletion/capture imports) rather than by vigilance, per
the decision above.

**No screenshot of Cronometer's actual fasting screen** → this proposal's
shape (timer, target, history) is a reasonable generic fasting-tracker
shape, not a copy of an observed UI. If a later screenshot reveals a
materially different interaction model worth adopting, that's a follow-up
change, not a defect in this one.

## Migration Plan

Append one forward-only migration creating `fasts`. No existing table
changes. `DROP_ALL` gains `DROP TABLE IF EXISTS fasts;`.

Rollback is clean: an older build simply has no fasting feature and never
reads or writes the table.

## Open Questions

- **Exact navigation entry point** (a tab, a More-equivalent settings
  list, or both a quick-add and a dedicated screen) — left to
  implementation, following whatever pattern the rest of the app already
  uses for a self-contained secondary feature.
