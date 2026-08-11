## Why

Mise's core loops work, but their feedback and recovery states were built as
features landed. The result is functional rather than consistently clear,
calm, and trustworthy during repeated use.

The premium-experience playbook identifies the next product pass: improve the
high-frequency capture and meal-save interactions without weakening the
local-first, accessible, and review-first product rules.

## What Changes

- Add a shared interaction-feedback pattern for successful saves, user-visible
  updates, pending work, and recoverable failures.
- Make capture progress, analysis completion, review, correction, and save read
  as one connected flow. The existing platform camera and picker remain the
  reliable baseline.
- Improve meal-save confirmation so the meal, daily totals, and pantry effect
  become visible together. Each inferred effect remains reviewable and
  reversible where the existing model supports reversal.
- Standardise empty and recovery states for capture and suggestion surfaces.
  Each state explains what is known, what failed or is unavailable, and the
  next useful action.
- Use only context already held on device to improve defaults and explanations.
  The app must not add background tracking, a server profile, or hidden data
  collection.
- Add a premium acceptance pass to UI-facing changes. It covers feedback,
  reduced motion, screen readers, failure, cancellation, return visits, and
  real-device review.

## Non-goals

- Replacing the system camera or media picker with a custom camera.
- Adding a mascot, a generic illustration library, generated assets, or a new
  visual identity in this change.
- Adding location collection, contact access, analytics tracking, an account,
  or a server.
- Changing nutrition, pantry-depletion, venue, or dietary-rule calculations.
- Replacing a user correction, confirmation, or review step with an automatic
  write.

## Capabilities

### New Capabilities

- `premium-interaction-polish`: Consistent, accessible feedback and recovery
  behavior for Mise's capture, review, meal-save, and suggestion experiences.

### Modified Capabilities

None. `openspec/specs/` has no main capability specs yet.

## Impact

- Affected UI: capture, pantry capture, receipt review, meal review, manual
  logging, dinner suggestions, shared toast and empty-state components.
- Affected shared code: motion tokens, reduced-motion handling, accessible
  feedback components, and UI-focused tests.
- Documentation: `docs/premium-experience-playbook.md` and the owner app-test
  checklist gain acceptance evidence.
- No database migration, network API, credential, or dependency is required.

This change implements decisions 5, 7, 15, 23, 92, 95, 122, 162, and 172. It
also preserves the copy and user-control boundaries in decisions 108, 142, and
170.
