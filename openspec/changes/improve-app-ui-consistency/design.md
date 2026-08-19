## Context

See `proposal.md` — Why/What Changes. This is a mechanical application of a
pattern already designed and shipped in `improve-nutrition-analytics-visuals`
(see that change's `design.md` for the original rationale) across 9 files
that were confirmed, by direct read, to repeat the same two structural
problems. No new pattern is being invented here — this document exists only
to record the per-file specifics an implementer needs to apply the pattern
correctly without re-deriving them.

## Goals / Non-Goals

**Goals:**
- Every confirmed in-card `EmptyState` misuse replaced with the established
  plain `Body`/`Caption` in-card treatment.
- Every confirmed screen without a shared spacing rhythm gets one `gap:
  space.lg` wrapper around its top-level sections.
- The one stray spacing literal resolved onto the `space` scale.

**Non-Goals:** see `proposal.md`'s Non-goals.

## Decisions

### Replacement text keeps each screen's existing title/detail copy verbatim

The fix is structural (drop the `EmptyState` wrapper and its whole-screen
padding), not a copy rewrite. Each of the 5 replacements uses the exact
`title`/`detail` strings the removed `EmptyState` call already had, in the
same `Body` (title) + `Caption muted` (detail) shape the Analytics change
established — e.g. `app/dinner.tsx`'s "That target is already met" /
"There is no remaining gap to solve." keeps that exact wording.

### `app/dinner.tsx` has seven `EmptyState` blocks, not six — the audit missed one

Reading the file directly (not just the audit summary) found a seventh
in-card usage the original sweep didn't list: the plain `suggestions.length
=== 0` fallback (`<Card><EmptyState title="Nothing to suggest right now"
/></Card>`), between the constraint-drop case and the populated-list
branch. It's the same misuse pattern as the other six and is included here.

### Two treatment shapes, chosen by whether the original `EmptyState` had an action — not one uniform replacement

Reading each call site (not assuming from title/detail alone) found that
several of the "misuse" cases still carry a working `actionLabel`/`onAction`
pair: `app/dinner.tsx`'s `no_key`, `error`, dietary-drop, and
constraint-drop cases; `ShoppingListSection.tsx`'s "Your list is clear";
`app/(tabs)/index.tsx`'s "Nothing logged yet"; and `app/recipe/[id].tsx`'s
line-168 case. Dropping the button along with `EmptyState` would be a
genuine behavior regression — action buttons that currently work would stop
rendering — which `proposal.md`'s Non-goals explicitly rules out.

So the replacement has two shapes, both dropping `EmptyState`'s wrapper and
oversized padding, chosen per call site by whether it has an action:

- **No action** (`app/dinner.tsx`'s `met_target`, `insufficient_data`, and
  the newly-found `suggestions.length === 0` case; `app/fasting.tsx`'s "No
  completed fasts"): `Body` (title) + `Caption muted` (detail, if present) —
  exactly the shape already shipped on Analytics.
- **Has an action** (the seven call sites listed above): the same `Body` +
  `Caption muted`, plus the existing `Button` rendered inline with its
  existing `label`/`onPress`/`loading` props carried over unchanged — the
  action keeps working, only the `EmptyState` wrapper and its 32px vertical
  padding are removed.

Both shapes are direct extensions of the one principle Analytics already
established (drop the whole-screen wrapper for a small in-card message);
neither invents new component structure.

### `app/dinner.tsx`'s seven blocks are seven independent replacements, not one shared component

Each block sits in a different conditional branch with different copy (and,
per the above, a different action shape) with no shared markup today.
Introducing a new shared sub-component for seven call sites would be a
refactor beyond this proposal's mechanical scope (see `proposal.md`'s
Non-goals) — each becomes its own inline replacement, mirroring the other
files' single-instance fixes.

### `app/recipe/[id].tsx` needs its two `EmptyState` usages told apart by line, not by search-and-replace

This file has both the confirmed misuse (line 168, in-card ingredients
message) and a confirmed-correct whole-screen usage (line 152) elsewhere in
the same file. Only the line-168 call is touched; the line-152 call, its
surrounding layout, and the `EmptyState` import (still needed for the other
call) stay exactly as they are.

### Spacing-rhythm wrapper follows `app/analytics.tsx`'s exact shape, not a shared layout component

Each of the 4 screens (`locations.tsx`, `nutrient-search.tsx`,
`dietary-rules.tsx`, `recipes.tsx`) gets one `View` with a `sections: { gap:
space.lg }`-equivalent style wrapping its top-level returned children,
matching `app/analytics.tsx:326`'s already-shipped pattern exactly (same
token, same approach: a plain wrapping `View`, not a new shared `Screen`
prop or layout primitive). The per-element `marginTop`/`marginBottom` styles
each screen used instead are removed once the wrapper supplies the gap,
except where a margin was doing double duty beyond top-level rhythm (see
Risks) — checked per screen, not assumed uniform.

### The stray `2` becomes `space.xs` (4px), not a new token

`ItemRow.tsx`'s badge already uses `paddingHorizontal: space.sm` (8px); its
`paddingVertical: 2` is tighter than every existing step on the scale
(`xs:4` is the smallest). `space.xs` is the closest available value and the
badge is a small chip where a couple of extra vertical pixels is
imperceptible — confirmed by reading the badge's surrounding row height
constraints in the same file, not assumed.

## Risks / Trade-offs

**A removed per-element margin was doing more than top-level rhythm** (e.g.
separating two elements *within* a section, not just between top-level
sections) → mitigated by treating each of the 4 spacing-rhythm screens as an
individually checked task (`tasks.md`), reading the full file before
removing any margin, not a blind find-and-replace of every `marginTop`/
`marginBottom` in the file.

**Six independent `app/dinner.tsx` edits touching one file** → higher
surface for a mechanical slip than the single-instance files; mitigated by
listing all six as separate checked tasks and running the full test suite
plus a targeted read-through of the file after all six land.

## Migration Plan

None. No schema change, no data migration — presentation-layer only.
Rollback is reverting each touched file's diff independently (no
cross-file coupling between the 9 files).
