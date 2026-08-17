## Why

Mise's add and edit flows expose every secondary field at once, so a user
editing one ingredient must scroll through quantities, units, nutrition, and
metadata before reaching the next item. This makes dense capture surfaces feel
like forms instead of quick, focused corrections.

## What Changes

- Add a shared collapsible editor pattern for user-created and user-correctable
  records.
- Render each item as a compact summary row by default, showing its primary
  identity and an expand affordance.
- Expand an item only after the user taps it; show quantity, unit, nutrition,
  location, expiry, notes, and other secondary fields inside the expanded body.
- Start newly created items expanded when immediate entry is required, then
  allow them to collapse after review or save.
- Keep only one editor expanded at a time within a repeated list unless a flow
  explicitly needs side-by-side comparison.
- Apply the pattern consistently to pantry, meal, barcode, receipt, recipe,
  shopping-list, and other add/edit surfaces without changing persisted data.
- Preserve validation, correction provenance, accessibility, keyboard handling,
  and save semantics while changing presentation.

## Capabilities

### New Capabilities

- `collapsible-editors`: Compact, accessible summary rows and on-demand detail
  editors for repeated add/edit surfaces.

### Modified Capabilities

None.

## Non-goals

- No database or API schema changes.
- No removal of editable fields or reduction in nutrition accuracy.
- No change to the Today/home information hierarchy.
- No forced collapse while the user has unsaved invalid input.
- No animation requirement that would block reduced-motion users.

## Impact

- Shared UI component(s) and interaction state for collapsible editor rows.
- Pantry, meal review/edit, barcode review, receipt review, recipe ingredient,
  shopping-list, and related sheets/screens.
- Existing tests gain interaction, accessibility, keyboard, reduced-motion, and
  large-text coverage.

This follows the product decisions that keep add flows user-owned and
corrections explicit (decisions 24, 27, and 95); collapsing changes visibility,
not ownership or persistence.
