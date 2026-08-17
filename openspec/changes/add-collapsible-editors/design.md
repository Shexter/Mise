## Context

Several screens currently place repeated items and all of their fields in one
long scroll surface. The same correction contract is shared across capture
channels, so the interaction should be shared without merging their data
models.

## Design

### Shared editor row

Create a reusable `CollapsibleEditorRow` (name may follow the repository's
existing component convention) with:

- a pressable summary header;
- primary identity text, optional concise status, and chevron;
- expanded content supplied by the caller;
- controlled `expanded` state and an `onToggle` callback;
- accessible expanded/collapsed state and a useful label;
- no hard-coded colours, spacing, or typography outside theme tokens.

The component owns presentation and disclosure semantics; each feature owns its
fields, validation, save behavior, and provenance.

### State policy

Repeated lists hold one `expandedId` (or a small explicit set where comparison
is essential). New rows receive the initial expanded id. After a successful
save, the caller may collapse the row and retain the summary. Tapping another
row collapses the previous one before expanding the new row.

An invalid or dirty expanded row must not be collapsed by an automatic list
refresh. Explicit user collapse remains allowed, but the row must retain its
draft state when reopened.

### Summary contract

Collapsed summaries show only the main detail needed for recognition:

- pantry/ingredient: ingredient name;
- barcode/product: product name and optional brand;
- meal/recipe: meal or recipe title;
- receipt/shopping item: line/item name and a compact status when useful.

Quantity, pieces, units, nutrition, location, expiry, and notes belong in the
expanded body unless one is the primary identity for that specific surface.

### Accessibility and motion

Headers use a minimum touch target, `accessibilityRole="button"`, an accessible
name, and `accessibilityState={{ expanded }}`. Reduced-motion users receive an
instant disclosure change; others may receive a short theme-consistent layout
transition. Focus/keyboard behavior must keep the active field visible and must
not reset when another row collapses.

### Rollout order

1. Shared component and interaction tests.
2. Pantry add/edit and meal item editors.
3. Barcode and receipt review rows.
4. Recipe ingredients and shopping-list entries.
5. Remaining add/edit sheets, then acceptance matrix across themes, text size,
   screen readers, keyboard, and reduced motion.

No migration is expected.

## Risks and mitigations

- Hidden fields may reduce discoverability → clear chevron, concise summary,
  and consistent tap target.
- Collapsing may lose draft input → keep draft state in the caller and never
  collapse dirty invalid rows during refresh.
- Long text may clip → allow identity text to wrap to two lines and test large
  text before accepting the layout.
