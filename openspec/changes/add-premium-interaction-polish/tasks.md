## 1. Shared feedback foundation

- [x] 1.1 Define the typed success, pending, and recoverable-error feedback
      request contract in `src/components/Toast.tsx`, retaining its existing
      optional action, undo, replacement, and expiry semantics.
- [x] 1.2 Update the toast host to announce its message and action accessibly,
      apply feedback-kind styling from `src/constants/theme.ts`, and honour
      `src/hooks/useReducedMotion.ts` without raw route-level animation values.
- [x] 1.3 Extend `src/components/EmptyState.tsx` only as needed to make static
      recovery states consistently title, explanation, and actionable next
      step; retain its current non-decorative use for ordinary empty states.
- [x] 1.4 Add focused no-network tests for the feedback contract, accessible
      toast/empty-state requirements, and reduced-motion source boundary.

## 2. Durable save confirmation

- [x] 2.1 Update `app/review.tsx` to issue a truthful shared success message
      after its existing photo-meal save resolves, distinguishing a meal-only
      save from an existing pantry effect.
- [x] 2.2 Update `app/manual.tsx` and `app/dinner.tsx` to use the shared
      success feedback after their existing writes, without claiming pantry
      movement when none occurred.
- [x] 2.3 Complete `app/pantry-capture-review.tsx`'s success handoff: derive
      the confirmed item count from the accepted proposals, issue one success
      confirmation only after inserts resolve, and return to Pantry without
      changing photo cleanup or review rules.
- [x] 2.4 Migrate `app/receipt-review.tsx` to the same shared confirmation
      contract while preserving its confirmed names, haptic success, and
      post-write Pantry return.
- [x] 2.5 Verify and, where needed, make `app/(tabs)/index.tsx` and
      `src/components/DayRail.tsx` consume a newly saved meal indication once,
      show the refreshed day state, and keep the reduced-motion alternative
      visibly complete without replaying stale feedback.
- [x] 2.6 Add no-provider regression tests covering meal-only versus pantry
      save wording, pantry-review count confirmation, receipt confirmation,
      and one-time Today saved-meal feedback.

## 3. Capture lifecycle and recovery

- [x] 3.1 Update `app/capture.tsx` so preparing a selected meal photo is an
      accessible, duplicate-safe busy state and a recoverable preparation
      failure offers only truthful retry, manual-entry, or settings actions.
- [x] 3.2 Update `app/pantry-capture.tsx` so preparation, barcode, food,
      receipt, unusable, ambiguous, provider-failure, and saved-for-later
      outcomes use the shared status vocabulary while preserving existing
      routing and durable pending-capture behavior.
- [x] 3.3 Update `app/review.tsx`'s analysis, error, retry, manual, cancel,
      and discard presentation so a screen reader can discover the current
      state and no new action implies a write before confirmation.
- [x] 3.4 Audit `app/dinner.tsx` suggestion recovery modes and adopt the
      shared static/transient feedback primitives only for gaps in the
      no-key, error, insufficient-data, and no-eligible-result states.
- [x] 3.5 Add no-network regression tests proving unsupported capture output
      does not create inferred pantry data, provider failures retain their
      current pending/retry path, and review routes do not write before the
      existing confirmation action.

## 4. Local context and motion boundaries

- [x] 4.1 Audit all changed feedback copy to ensure it cites only active
      local facts (saved meal, confirmed item, provider status, pending state,
      local pantry, time, preference, or explicit venue) and marks estimates
      as estimates.
- [x] 4.2 Remove any new raw colour, spacing, or animation duration introduced
      by this change; use `src/constants/theme.ts` and
      `src/hooks/useReducedMotion.ts` for every changed transition.
- [x] 4.3 Add focused tests or static guard assertions for the local-context,
      no-unsupported-quantity, and reduced-motion boundaries of the changed
      capture and save routes.

## 5. Acceptance evidence and verification

- [x] 5.1 Add a reusable premium-interaction acceptance section to
      `docs/owner-app-test-checklist.md` and link it from
      `docs/premium-experience-playbook.md`; cover success return, pending and
      failure, cancellation, reduced motion, screen-reader discovery, and
      device review.
- [x] 5.2 Run `npm run typecheck` and the affected Vitest suite, then run the
      complete test suite; fix any regressions before marking code tasks done.
- [ ] 5.3 On a real device, test photographed meal save, manual save, cooked
      suggestion save, pantry-capture review, receipt review, and each
      recoverable capture route; record device, OS, build, expected versus
      actual, and screenshots without secrets in the change task file or
      `docs/product-decisions.md`.
- [ ] 5.4 With reduced motion enabled and a screen reader enabled, repeat the
      relevant save, busy, pending, error, cancellation, and return paths on
      supported iOS and Android devices; record unresolved platform issues
      before accepting the change.
