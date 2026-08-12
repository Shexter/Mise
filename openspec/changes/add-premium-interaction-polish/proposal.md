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
- Apply the strongest transferable Cronometer diary patterns without turning
  Today into a dashboard: keep one glanceable energy/macro/fibre summary and
  factual meal subtotals on Today, then place contributor detail, configurable
  historical charts, and the structured report-style view on a dedicated local
  Nutrition Analytics page. Unknown nutrition stays unknown; Mise adds no
  nutrition score, grade, diagnosis, or good/bad verdict.
- Make Pantry the home for both kitchen stock and the user's saved recipes.
  Add a clear Stock / Recipes subsection switch inside Pantry and reuse the
  existing recipe list, intake, detail, attribution, and local-storage flows.
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
- Adding micronutrients Mise does not store, adherence scores, streak pressure,
  diagnosis, clinical recommendations, reference ranges not owned by the user,
  or claims that the report replaces professional medical advice.
- Replacing a user correction, confirmation, or review step with an automatic
  write.

## Capabilities

### New Capabilities

- `premium-interaction-polish`: Consistent, accessible feedback and recovery
  behavior for Mise's capture, review, meal-save, and suggestion experiences.

### Modified Capabilities

None. `openspec/specs/` has no main capability specs yet.

## Impact

- Affected UI: Today, daily meal details, a new local Nutrition Analytics
  surface, Pantry's Stock / Recipes subsections, capture, pantry capture,
  receipt review, meal review, manual logging, dinner suggestions, shared
  toast, chart, and empty-state components.
- Affected shared code: motion tokens, reduced-motion handling, accessible
  feedback components, and UI-focused tests.
- Documentation: `docs/premium-experience-playbook.md` and the owner app-test
  checklist gain acceptance evidence.
- No nutrition-data migration, network API, credential, account, or server is
  required. Chart preferences may use the existing local key-value boundary;
  the implementation should prefer a small in-repo chart primitive before
  adding a dependency.

This change implements decisions 5, 7, 15, 23, 92, 95, 122, 162, and 172. It
also preserves the copy and user-control boundaries in decisions 108, 142, and
170.
