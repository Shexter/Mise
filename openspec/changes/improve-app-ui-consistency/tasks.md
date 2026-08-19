## 1. Fix `app/dinner.tsx`'s seven in-card `EmptyState` misuses

Each is an independent replacement (see `design.md`'s Decisions — no shared
sub-component). Drop the `<EmptyState>` wrapper and its 32px vertical
padding; keep the existing `Body` title text and `Caption muted` detail text
verbatim. Where the original call has `actionLabel`/`onAction`, keep the
existing `Button` rendered inline with the same `label`/`onPress` (and
`loading` where present) — no action is removed.

- [x] 1.1 `no_key` case (`~line 226`): keep the "Open Settings" action.
- [x] 1.2 `error` case (`~line 234`): keep the "Try again" action.
- [x] 1.3 `met_target` case (`~line 244`): no action — plain `Body`/`Caption`.
- [x] 1.4 `insufficient_data` case (`~line 246`): no action — plain
      `Body`/`Caption` (both `title`/`detail` variants).
- [x] 1.5 Dietary-drop case, `suggestions.length === 0 && droppedForDiet > 0`
      (`~line 254`): keep the "Try again" action.
- [x] 1.6 Constraint-drop case,
      `suggestions.length === 0 && droppedForConstraint > 0` (`~line 263`):
      keep the "Try again" action.
- [x] 1.7 Plain-empty case, `suggestions.length === 0` (`~line 272`,
      "Nothing to suggest right now" — found by reading the file directly;
      not in the original audit list): no action — plain `Body`.
- [x] 1.8 Remove the `EmptyState` import from `app/dinner.tsx` once all
      seven call sites are converted (confirm no other usage remains in the
      file first).

## 2. Fix the remaining in-card `EmptyState` misuses (one file each)

- [x] 2.1 `src/components/pantry/ShoppingListSection.tsx:130` — "Your list
      is clear": keep the "Add an item" action (`onAction={() =>
      setAdding(true)}`).
- [x] 2.2 `app/(tabs)/index.tsx:235-242` — "Nothing logged yet": keep the
      "Take a photo" action.
- [x] 2.3 `app/fasting.tsx:129-134` — "No completed fasts": no action —
      plain `Body`/`Caption`.
- [x] 2.4 `app/recipe/[id].tsx:168` — "Add the ingredients when you have
      them": keep the "Back to recipes" action. Leave this file's other
      `EmptyState` usage (line 152, the whole-screen "Recipe not found"
      case) and its `EmptyState` import untouched — it is still needed.
- [x] 2.5 For each file where `EmptyState` is no longer used after its fix
      (`ShoppingListSection.tsx`, `app/(tabs)/index.tsx`, `app/fasting.tsx`),
      remove the now-unused `EmptyState` import.

## 3. Add a shared top-level spacing rhythm to four screens

For each, wrap the screen's top-level returned sections in one `View` with
a `gap: space.lg` style (matching `app/analytics.tsx:326`'s shipped
pattern exactly), then remove the per-element `marginTop`/`marginBottom`
styles the wrapper now makes redundant. Read the full file before removing
any margin — some may be doing more than top-level rhythm (see `design.md`'s
Risks) and should be kept if so.

- [x] 3.1 `app/locations.tsx` — wrap `ScreenTitle`, the `Caption` subtitle,
      the locations `Card`, and the `addBlock` `View` in the new gap
      container; drop `styles.title`'s and `styles.subtitle`'s `marginTop`/
      `marginBottom` and `styles.addBlock`'s `marginTop` (keep
      `addBlock`'s own internal `gap: space.sm`). Leave the two `Sheet`
      overlays (rename, remove-and-reassign) outside the gap container —
      they are modals, not top-level layout content.
- [x] 3.2 `app/nutrient-search.tsx` — wrap the header `View`, the subtitle
      `Caption`, the `ChoiceList`, and the conditional results/loading/empty
      block in the new gap container; drop `styles.header`'s `marginTop`,
      `styles.subtitle`'s `marginTop`/`marginBottom`, `styles.results`'s and
      `styles.loading`'s `marginTop`. Leave `styles.footnote`'s `marginTop`
      — it separates a caption from the `Card` immediately above it *within*
      the results section, not between top-level sections.
- [x] 3.3 `app/dietary-rules.tsx` — wrap `ScreenTitle`, the subtitle
      `Caption`, and `<DietaryRuleList/>` in the new gap container; drop
      `styles.title`'s and `styles.subtitle`'s `marginTop`/`marginBottom`.
- [x] 3.4 `app/recipes.tsx` — wrap the header `View` and
      `<SavedRecipesSection/>` in the new gap container; drop
      `styles.header`'s `marginBottom` (its `marginTop` can stay or move to
      the `Screen`'s existing top spacing — verify visually there is no
      double gap once the wrapper is added).

## 4. Fix the stray spacing literal

- [x] 4.1 `src/components/review/ItemRow.tsx:85` — replace the badge's
      `paddingVertical: 2` with `paddingVertical: space.xs` (4px), and add
      the `space` import if not already present in this file's `theme`
      import.

## 5. Quality gates

- [x] 5.1 Run `npm run typecheck` and the full Vitest suite.
- [x] 5.2 Grep the 5 touched `EmptyState`-fix files to confirm no orphaned
      `EmptyState` import remains where the last usage in that file was
      removed, and that files keeping a usage (`app/recipe/[id].tsx`) still
      import it.
- [ ] 5.3 Owner device check: visit `app/dinner.tsx`'s `met_target` and
      `no_key`/`error` states (or another with an action) and confirm the
      button still works and the card no longer has oversized padding;
      visit `app/locations.tsx`, `app/nutrient-search.tsx`,
      `app/dietary-rules.tsx`, and `app/recipes.tsx` and confirm the top-level
      spacing reads as one deliberate rhythm with no doubled or missing gaps;
      confirm the grocery-item badge in `ItemRow.tsx` looks unchanged at a
      glance.
