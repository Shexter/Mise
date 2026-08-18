## Why

The Nutrition Analytics screen (`app/analytics.tsx`) shipped with `add-trend-charts`
but is hard to read on-device: contributor and empty-state cards carry far more
padding than their one or two lines of text need, top-level sections have no
consistent spacing rhythm, and every trend chart — energy, protein, carbohydrate,
fat, fibre alike — renders in the same `color.ink`, so a dashboard of several
charts reads as a stack of identical black smears distinguishable only by the
text label above each one.

This isn't a taste complaint. Running the app's current chart colours
(`macroColor`'s `paprika`/`wheat`/`olive`, plus `ink` for fibre) through a
categorical-palette validator against `src/constants/themePalettes.ts`'s six
themes shows objective, measurable failures in every theme tested: the
default `organic` theme fails the normal-vision distinguishability floor for
olive vs. wheat (ΔE 11.0, below the 15 floor); `midnight-organic`, the app's
one dark theme, fails across lightness, chroma, and distinguishability; `utility`
fails the chroma floor for olive and the contrast floor for wheat. These three
hues were designed as UI accents (buttons, small highlights) and were never
validated as a categorical data-visualization palette — because until now,
nothing in the app asked them to be one.

## What Changes

- **A validated categorical colour set for the five daily nutrition metrics**
  (energy, protein, carbohydrate, fat, fibre), covering all six themes in
  `themePalettes.ts` including the dark theme, each checked against the same
  six-point categorical-palette validation this proposal used to find the
  problem (lightness band, chroma floor, CVD pairwise separation, normal-vision
  distinguishability floor, contrast vs. surface). Colour stays a secondary
  encoding layered on the shape/dash-pattern coverage encoding
  `NutritionChart.tsx` already uses (partial = dashed, unknown = diamond,
  absent = hollow circle) — never a replacement for it.
- **`NutritionChart.tsx` renders each metric in its own validated colour**
  instead of a single hardcoded `color.ink`, so a "Trend dashboard" of several
  enabled metrics is visually distinguishable chart-to-chart, not just by the
  section label above it.
- **A deliberate, consistent spacing rhythm between `app/analytics.tsx`'s
  top-level sections**, replacing the current arrangement where each section
  sits as a bare sibling with no shared gap.
- **A compact empty-state treatment for small, already-contained messages**
  (e.g. "No known contributors" inside an already-padded `Card`), replacing
  the current reuse of `EmptyState`'s whole-screen padding
  (`paddingVertical: space.xl`, meant for a screen-level empty state with its
  own illustration and action button) for a one- or two-line in-card message.

## Capabilities

### New Capabilities

None. This is a visual-quality change to an already-shipped screen and its
rendering components — it changes how existing, already-specified behavior is
*presented*, not what the app does. `openspec/specs/` has no capability
covering chart or screen visual presentation to extend either.

### Modified Capabilities

None. No `openspec/specs/` capability currently governs visual/spacing/colour
presentation as a spec-level requirement — the trend-chart and nutrition-report
behavior this touches (`add-trend-charts`, still in progress and out of
`openspec/specs/`) specifies data correctness and coverage semantics, not
pixel-level presentation, and this proposal does not change that data
correctness. Per this change's `.openspec.yaml`, `skip_specs: true` is set
accordingly.

## Non-goals

- **Touching `add-trend-charts`'s own scope or tasks.** That change (still
  in progress, worked in parallel) owns the trend-chart *feature* — what
  metrics exist, how coverage/aggregation work, what a bucket means. This
  proposal is a visual-quality follow-up layered on top of what it ships,
  scoped to presentation only.
- **A colourful redesign.** The app's own design system is deliberately
  minimal (three accent hues, used sparingly) — this proposal fixes a
  specific, validated failure (chart colours that don't work as a categorical
  palette) without turning the app into a colourful dashboard. Colour remains
  secondary to shape/label encoding everywhere it's already used that way.
- **Any screen other than Nutrition Analytics and its rendering components**
  (`NutritionChart.tsx`, `NutritionReport.tsx`, and the in-card empty-state
  pattern). `MacroBars.tsx`'s existing use of `macroColor` and any other
  consumer of the current three accent hues are out of scope unless changing
  the categorical set requires touching their existing callers to keep them
  compiling.
- **Redesigning `EmptyState` itself.** Its current whole-screen behavior
  (illustration, action button, generous padding) is correct for its
  existing whole-screen callers (e.g. the empty Pantry screen) and is not
  being changed — this proposal adds or chooses a *different*, more compact
  treatment for the small in-card case, not a rewrite of the existing
  component's default behavior.
- **A new product-decision debate about the design system's minimalism.**
  This proposal fixes a validated, mechanical failure (the existing hues
  don't pass as a categorical palette) within the system's existing
  minimal-palette philosophy — it is not reopening whether that philosophy
  is right.

## Impact

**Schema.** None.

**Code.**
- `src/constants/theme.ts` and/or `src/constants/themePalettes.ts` — the
  categorical colour set for the five metrics, validated per theme. Where
  exactly the new values live (adjusted variants of the existing three
  accents, new dedicated chart-hue slots per theme, or a mix) is a design
  decision, not decided here.
- `src/components/NutritionChart.tsx` — accepts and renders a per-metric
  colour instead of hardcoded `color.ink`.
- `app/analytics.tsx` — spacing rhythm between top-level sections; replaces
  its in-card `EmptyState` usage with the compact treatment.
- `src/components/NutritionReport.tsx` — spacing only, if its own internal
  rhythm needs to match the corrected screen-level rhythm.
- `docs/product-decisions.md` — the categorical chart-colour choice this
  proposal makes is exactly the kind of settled, reasoned call the ledger
  exists to record; `tasks.md` includes appending a new entry (next free
  number, taken from `main` at implementation time per the ledger's own
  collision-avoidance rule) rather than letting the reasoning live only in
  this change's `design.md`.

**Dependencies.** None added. Colour-palette validation is a one-time,
build-time/design-time check (this proposal's own research already ran it
via the `dataviz` skill's `validate_palette.js`) — no new runtime dependency.

**Risk.** Low, additive, presentation-only. Touching six themes' worth of
colour values means each must be independently validated before acceptance
(a wrong or unvalidated value in one theme is a regression specific to users
on that theme) — `tasks.md` treats per-theme validation as a discrete,
checked step, not a one-time pass assumed to generalize.
