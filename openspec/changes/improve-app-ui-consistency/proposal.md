## Why

`improve-nutrition-analytics-visuals` fixed two structural presentation bugs on
one screen: the whole-screen `EmptyState` component (designed for an
illustration + action button + `paddingVertical: space.xl`, 32px) was being
reused for one-line in-card messages, double-padding them; and top-level
screen sections had no shared spacing rhythm, each carrying its own ad-hoc
margin instead.

A follow-up, read-only audit of the rest of `app/**` and `src/components/**`
found the same two patterns repeated on several other screens, plus one stray
spacing literal outside `src/constants/theme.ts` — the project's own hard
rule ("every colour, font, and spacing value comes from `theme.ts`. No
literals.") caught by review, not by `npm run typecheck`. This is the same
class of evidence-based, non-subjective fix as the Analytics change, applying
an already-shipped, already-decided pattern mechanically to more files rather
than making new design calls.

## What Changes

- **Eleven in-card `EmptyState` misuses replaced** (across 5 files) with an
  in-card treatment that drops `EmptyState`'s wrapper and its whole-screen
  `paddingVertical: space.xl` padding, for messages that are one or two
  lines inside an already-padded `Card`. Where the original `EmptyState`
  call had a working `actionLabel`/`onAction`, its `Button` is kept,
  rendered inline instead of through `EmptyState` — no button is removed;
  see `design.md`'s Decisions for which cases keep a button and which don't:
  - `app/dinner.tsx` — 7 separate `<Card><EmptyState /></Card>` blocks
    across its `no_key`, `error`, `met_target`, `insufficient_data`,
    dietary-drop, constraint-drop, and empty-suggestions states (the audit
    that scoped this change found 6; reading the file found a 7th,
    `suggestions.length === 0`, using the same pattern).
  - `src/components/pantry/ShoppingListSection.tsx` — the "Your list is
    clear" case.
  - `app/(tabs)/index.tsx` — the "Nothing logged yet" Today's-meals case.
  - `app/fasting.tsx` — the "No completed fasts" History case.
  - `app/recipe/[id].tsx` — the "Add the ingredients when you have them"
    case (this file also has a genuine whole-screen `EmptyState` usage at a
    different line, which stays untouched).
- **Four screens gain a shared top-level spacing rhythm** — one wrapping
  `View` with `gap: space.lg` around their top-level sections, replacing
  independent per-element `marginTop`/`marginBottom` styling, matching the
  pattern already shipped on `app/analytics.tsx`, `app/(tabs)/settings.tsx`,
  and `app/(tabs)/pantry.tsx`:
  - `app/locations.tsx`
  - `app/nutrient-search.tsx`
  - `app/dietary-rules.tsx`
  - `app/recipes.tsx`
- **One stray spacing literal fixed**: `src/components/review/ItemRow.tsx`'s
  `badge` style has `paddingVertical: 2`, a raw pixel value not on the app's
  `space` scale (`xs:4, sm:8, md:12, base:16, lg:24, xl:32, xxl:48, xxxl:64`).
  Replaced with the nearest scale value, `space.xs` (4px), the smallest step
  the badge can use without visibly growing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Like `improve-nutrition-analytics-visuals`, this changes only how
already-specified behavior is *presented* — no `openspec/specs/` capability
governs visual/spacing/colour presentation, and no user-facing behavior
changes (same messages, same data, same navigation). `skip_specs: true` is
set in `.openspec.yaml` accordingly.

## Non-goals

- **A new spacing/sizing token or `EmptyState` redesign.** This applies the
  pattern `improve-nutrition-analytics-visuals` already decided and shipped;
  it does not revisit that decision or invent a new one.
- **One-off element sizing literals** (icon/avatar/button dimensions like
  `Fab.tsx`'s `44x44`, `MealRow.tsx`'s `44x44`, `Choice.tsx`'s `20x20`).
  These are element dimensions, not spacing-scale values, and are a separate,
  broader question — whether the app needs a dedicated `size` token scale —
  that this proposal does not decide.
- **Any screen not listed above.** The audit specifically confirmed the
  following `EmptyState` usages are genuine whole-screen empty states and
  are correct as-is: `app/nutrient-search.tsx`, `app/match-queue.tsx`,
  `app/(tabs)/pantry.tsx` (has its own illustration + action),
  `app/receipt-history.tsx`, `app/meal/[id].tsx`,
  `app/recipe/[id].tsx`'s other usage, `src/components/HistoryCalendarSheet.tsx`,
  `src/components/match/CanonicalPickerSheet.tsx`,
  `src/components/dietary/DietaryRuleList.tsx`, and
  `src/components/recipes/SavedRecipesSection.tsx`. None of these are touched.
- **Any behavior, data, or logic change.** Every screen touched keeps its
  existing conditions, copy, and navigation — only the wrapping presentation
  changes.

## Impact

**Schema.** None.

**Code.**
- `app/dinner.tsx`, `src/components/pantry/ShoppingListSection.tsx`,
  `app/(tabs)/index.tsx`, `app/fasting.tsx`, `app/recipe/[id].tsx` — replace
  in-card `EmptyState` usage with plain `Body`/`Caption`.
- `app/locations.tsx`, `app/nutrient-search.tsx`, `app/dietary-rules.tsx`,
  `app/recipes.tsx` — wrap top-level sections in one `gap: space.lg`
  container, removing the per-element margins it replaces.
- `src/components/review/ItemRow.tsx` — replace the raw `2` with
  `space.xs`.

**Dependencies.** None added.

**Risk.** Low, additive, presentation-only, mechanically applying an
already-validated pattern. Per-file risk is that removing a per-element
margin changes visual rhythm in a way the shared `gap` doesn't fully replace
(e.g. a margin that was doing double duty against a sibling that isn't part
of the gap container) — `tasks.md` treats each screen as an individually
checked step, not a single mechanical find-replace assumed to generalize.
