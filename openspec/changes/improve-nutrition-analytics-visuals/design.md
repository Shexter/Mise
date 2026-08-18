## Context

See `proposal.md` — Why. Two independent problems, both scoped to
`app/analytics.tsx` and its rendering components:

1. **Colour.** `src/components/NutritionChart.tsx` hardcodes `color.ink` for
   every line, dot, and bar regardless of metric. `src/constants/theme.ts`'s
   `macroColor` (`protein: paprika, carbs: wheat, fat: olive, fibre: ink`) is
   the only existing per-metric colour mapping, used today by `MacroBars.tsx`
   elsewhere — not by `NutritionChart`. It has no `energy` entry, and its
   `fibre: color.ink` mapping is already a degenerate non-colour.
2. **Spacing.** `app/analytics.tsx` renders roughly eight top-level blocks
   (header, metric picker, two `Card`s, the trend dashboard, the nutrition
   report, and two contributor blocks) as bare `Screen` children with no
   shared gap between them, and reuses `EmptyState` — built for a whole-screen
   empty state with its own illustration and action button
   (`paddingVertical: space.xl` alone, before any card padding) — for a
   one-line, already-card-contained message like "No known contributors."

## Goals / Non-Goals

**Goals:**

- A categorical colour set for the five `DailyNutritionMetric` values
  (`energy`, `protein`, `carbohydrate`, `fat`, `fibre`), validated per theme
  against the same six checks used to find the problem, not eyeballed.
- `NutritionChart` renders each metric's line/dots/bars in its resolved
  colour.
- A single, deliberate spacing rhythm between `analytics.tsx`'s top-level
  sections.
- A compact treatment for small in-card empty messages, distinct from the
  whole-screen `EmptyState`.

**Non-Goals:** see proposal.md. Notably: not touching `MacroBars.tsx` or its
existing `macroColor` usage, not redesigning `EmptyState` itself, not a
broader colour-system overhaul.

## Decisions

### A new, dedicated 5-slot chart palette — not a reuse of `macroColor`'s existing hues

Five new fields on `ThemePalette` (`themePalettes.ts`): `chart1`…`chart5`,
one per theme, plus a new `metricColor: Record<DailyNutritionMetric, string>`
export in `theme.ts` (colocated with the existing `macroColor`) fixing the
semantic order once, centrally:

```ts
export const metricColor: Record<DailyNutritionMetric, string> = {
  energy: color.chart1,
  protein: color.chart2,
  carbohydrate: color.chart3,
  fat: color.chart4,
  fibre: color.chart5,
};
```

*Why not fix `paprika`/`wheat`/`olive` and reuse them:* those three are UI
accents used throughout the app (buttons, `MacroBars`, chips) — retuning
their lightness/chroma to pass as a categorical dataviz palette would ripple
into every screen that already uses them, squarely outside this proposal's
scope. They also cannot be fixed by reordering alone: validating them
directly (see proposal.md's cited failures) shows `olive` fails the chroma
floor and `olive`↔`wheat` fails the normal-vision distinguishability floor
in the app's own default theme, and every check fails in the dark theme —
the values themselves, not their arrangement, are the problem.

*Why 5 dedicated slots and not 2 (filling only the missing `energy` and the
degenerate `fibre`):* keeping `protein`/`carbs`/`fat` on `paprika`/`wheat`/
`olive` would still ship the exact failure this proposal exists to fix for
three of five metrics. A clean, fully-validated 5-slot set is the only way
to guarantee every metric passes.

*Accepted trade-off, stated plainly:* after this change, `NutritionChart`
(Analytics screen) and `MacroBars` (Today screen) will render the same
metric — say, protein — in two different colours. Unifying them is real,
worthwhile follow-up work, but it means retuning `paprika`/`wheat`/`olive`
app-wide, which is exactly the out-of-scope ripple above. Flagged here
rather than silently expanded into.

### Fixed semantic order: energy → protein → carbohydrate → fat → fibre

Matches `DailyNutritionMetric`'s own declared order in
`src/logic/dailyNutritionSummary.ts` (`DAILY_NUTRITION_METRICS`), so the
palette's slot order and the app's own canonical metric order are the same
list read two ways — nothing to keep in sync by hand.

### Colour stays secondary; the shape/dash coverage encoding is untouched

`NutritionChart.tsx`'s existing coverage encoding (solid dot = known, dashed
= partial, diamond = unknown, hollow ring = no-meals) is orthogonal to
metric identity and is not touched. A `metricColor`-coloured stroke/fill
replaces `color.ink` wherever coverage styling doesn't already override it
(e.g. an "unknown" mark stays `color.ink`-outlined regardless of metric — it
already carries no defensible value to colour). Every enabled chart in the
"Trend dashboard" also keeps its own visible `SectionLabel` (`"{metric}
trend"`) — the direct-label channel the validated palette's one WARN-band
pair (see below) requires as its secondary encoding.

### Two worked, fully validated examples — proving the method inside the app's muted aesthetic, not against generic web-safe hues

Ran `node scripts/validate_palette.js` (dataviz skill) against real candidate
hex values for the two hardest/most load-bearing themes: `organic` (the
default, light) and `midnight-organic` (the only dark theme), in the fixed
order above:

**`organic`** (surface `#EBE3D8`, light mode) — `ALL CHECKS PASS`:

| Metric | Hex | Role |
|---|---|---|
| energy | `#A6672E` | muted amber |
| protein | `#8C6BB8` | muted violet |
| carbohydrate | `#1E8F68` | muted teal-green |
| fat | `#A8452F` | muted rust-red |
| fibre | `#0F7C9E` | muted steel-blue |

Worst adjacent CVD ΔE 7.9 (deutan) — inside the legal 6–8 floor band, which
the existing per-chart `SectionLabel` direct-label already satisfies as
secondary encoding. Worst normal-vision ΔE 19.5, well clear of the 15 floor.
All five clear 3:1 contrast against the surface.

**`midnight-organic`** (surface `#272D2A`, dark mode) — `ALL CHECKS PASS`,
no WARNs:

| Metric | Hex | Role |
|---|---|---|
| energy | `#C07F3F` | amber |
| protein | `#9A78CC` | violet |
| carbohydrate | `#2FA890` | teal-green |
| fat | `#C05F4A` | rust-red |
| fibre | `#2E9DBF` | steel-blue |

Worst adjacent CVD ΔE 9.5, worst normal-vision ΔE 21.0 — clear of every
floor with margin, no WARN at all.

Both sets are muted (chroma tuned to just clear the floor, not saturated
web-primary colours) and keep the same five hue families across light and
dark — same visual identity, restepped per surface, matching how the app's
existing `paprika`/`wheat`/`olive` already vary their exact hex per theme
while keeping a consistent *feel*.

*Why only these two themes worked out here, not all six:* these two anchor
the range (the default light theme, and the only dark theme — the hardest
lightness/contrast case). The remaining four (`utility`, `cool-organic`,
`test-lab`, `coolors`) are all light-mode variants of the same problem this
proposal already solved twice; deriving and validating each is mechanical
repetition of the method above, not a further design decision — it's
`tasks.md`'s job, not this document's, and each is checked individually
before being accepted (a theme silently left unvalidated is a regression for
whoever has it selected).

### The in-card empty message stops reusing `EmptyState`

Replace `<Card><EmptyState title="…" detail="…" /></Card>` (in
`app/analytics.tsx`'s contributors block, and anywhere else this screen does
the same) with the `Card`'s own plain content — a `Body` line and a muted
`Caption`, no `EmptyState` wrapper, no extra `paddingVertical: space.xl`,
no centred layout. `EmptyState` itself is untouched; this is a *different*,
lighter treatment for a different situation (a small, already-contained,
low-stakes message), not a change to what `EmptyState` does for its existing
whole-screen callers.

### One shared gap between top-level sections

Wrap `analytics.tsx`'s returned JSX in one container (`View` with
`gap: space.lg`, i.e. 24px — the same unit already used for
`NutritionReport`'s `summaryGrid` spacing, one step above the `space.md`
used for gaps *within* a section) instead of each block silently touching
the next. Chosen over `space.xl` (32px, `EmptyState`'s own oversized value —
avoided deliberately) and over `space.md` (12px, too tight for
visually-distinct Cards).

## Risks / Trade-offs

**Analytics and Today-screen macro colours diverge** → accepted and stated
above; unifying them is real follow-up work this proposal does not attempt.

**Six themes' worth of new hex values is a lot of surface to get wrong** →
mitigated by treating each theme's palette as an individually validated,
individually checked task (`tasks.md`), not one pass assumed to generalize;
the two hardest cases (default light, only dark) are already validated here
as the worked method.

**A CVD-floor-band WARN (6–8) on the default theme's fat↔carbohydrate
adjacency** → legal per the six-check rule only with secondary encoding,
which this screen already has (each chart's own visible `SectionLabel`
identifies its metric) — not a silent gap.

## Migration Plan

None. No schema change, no data migration — this is a presentation-layer
change to already-rendered values. Rollback is deleting the new palette
fields and `metricColor` export and reverting `NutritionChart`'s prop back
to a hardcoded `color.ink`.

## Open Questions

None — the two open questions the proposal flagged (adjust-vs-add, and where
the fixed order lives) are resolved above as design decisions, not deferred.
