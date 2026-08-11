## Context

See [proposal.md](proposal.md) for the motivation and
[premium-interaction-polish spec](specs/premium-interaction-polish/spec.md) for
the behavioural contract.

The app already has most of the primitives needed for a cohesive interaction
pass. `src/components/Toast.tsx` provides a single transient-message channel,
`src/components/EmptyState.tsx` provides action-oriented static states, and
`src/hooks/useReducedMotion.ts` exposes the operating-system preference.
`src/constants/theme.ts` owns the motion tokens. The parts do not yet share a
feedback contract: several screens construct success and error toasts locally,
the toast uses a fixed animation, and `app/pantry-capture-review.tsx` returns
to Pantry without confirming its saved items.

The main routes have distinct, established responsibilities that must remain
intact:

- `app/capture.tsx` and `app/pantry-capture.tsx` own the platform camera and
  picker handoff.
- `app/review.tsx`, `app/manual.tsx`, `app/dinner.tsx`,
  `app/pantry-capture-review.tsx`, and `app/receipt-review.tsx` own their
  existing review and save mutations.
- `app/(tabs)/index.tsx` already receives `savedMealId` and passes it to
  `src/components/DayRail.tsx` for a one-time saved-meal transition.
- `app/(tabs)/pantry.tsx` refreshes its local catalogue on focus and exposes
  pending receipt and capture work.

This is a presentation and interaction change only. It adds no tables,
migrations, network requests, provider configuration, or collected data.

## Goals / Non-Goals

**Goals:**

- Make all relevant save, pending, and recoverable-failure feedback use one
  typed, accessible pattern.
- Reuse the existing route parameters, stores, and focus refresh behavior to
  make a completed mutation visible at its destination.
- Make busy and recovery states explicit without changing the camera, media,
  review, or persistence architecture.
- Make reduced-motion handling deliberate in every new or changed transition.
- Leave a repeatable owner acceptance record for this change and future
  UI-facing OpenSpec changes.

**Non-Goals:**

- A general notification centre, event log, analytics event stream, or global
  animation framework.
- Changing the success semantics of a save, the source-of-truth store, or the
  order in which mutations occur.
- Animating every navigation change, introducing a custom capture surface, or
  adding decorative art to fill empty states.
- Treating a toast, haptic, or animated rail as proof that an underlying write
  succeeded.

## Decisions

### 1. Extend the existing toast into the shared feedback boundary

`src/components/Toast.tsx` will remain the single host for transient feedback.
Its request type will gain a small, explicit feedback kind (success, pending,
or recoverable error) and accessibility metadata needed to announce the
message and optional action. Screens will use the typed request instead of
assembling unrelated toast conventions.

The component will choose its own visual and motion treatment from the kind;
callers supply only a truthful message and, where applicable, one action. The
existing expiry and undo behavior stays intact. Save routes will emit feedback
only after their current mutation resolves. A persisted-pending route will say
that the work was saved for later rather than saying it completed.

This keeps feedback centrally testable and avoids multiple competing live
regions. A new app-wide notification system was rejected because messages in
this scope are short-lived, route-local confirmations. Per-screen bespoke
toasts were rejected because they cannot reliably share reduced-motion and
assistive-technology behavior.

### 2. Use destination state as the durable visual confirmation

A save confirmation has two layers: an immediate typed toast/haptic and a
visible destination state. Meal routes will continue to return a `savedMealId`
to `app/(tabs)/index.tsx`; the existing `DayRail` transition will remain the
in-place confirmation of the newly saved meal and refreshed totals. It must
use theme durations and `useReducedMotion`, with the non-motion state still
visibly complete.

Pantry review and receipt routes will return to `app/(tabs)/pantry.tsx` only
after their writes resolve. The destination's focus refresh is the source of
truth; the confirmation message will name the count or known items actually
added. This change will not invent a pantry quantity, scroll to an assumed row,
or encode state in a new database field.

Passing a broad "last action" state through Zustand was rejected. It would
survive beyond the navigation that needs it and make stale feedback easy to
replay. Route-local state plus the already refreshed destination is bounded,
recoverable, and already established for meals.

### 3. Represent capture progress and recovery as explicit screen states

`app/capture.tsx`, `app/pantry-capture.tsx`, and `app/review.tsx` will each
make their existing preparation or analysis phase discoverable as a busy
state. The relevant submit control remains disabled while work is in flight.
Where the operation supports cancellation, the existing cancellation path
remains available; where it does not, the UI must not imply that work was
cancelled.

For a recoverable outcome, the route will use an actionable inline state or
sheet action for choices that require a decision (retry, manual entry,
settings, saved capture, or receipt route). A transient toast is reserved for
brief confirmation after a completed, non-decision action. The current
provider-specific branches and pending-capture persistence remain the source
of truth for which action is available.

A single cross-route capture state machine was rejected. Meal, pantry,
barcode, receipt, and review stages have different data lifetimes and cleanup
rules; forcing them through one state object would obscure the existing safe
handoffs. The common contract is the user-facing state vocabulary and feedback
component, not a new shared persistence flow.

### 4. Strengthen the shared primitives rather than add decorative surfaces

`src/components/EmptyState.tsx` will be the baseline for static empty and
recovery states: concise title, truthful explanation, and an optional action
that can remedy the named condition. `Toast.tsx` will provide live transient
feedback. Each changed component must use `src/hooks/useReducedMotion.ts` and
motion values from `src/constants/theme.ts`; raw animation durations and
nonessential movement are not introduced in route code.

No illustration or image asset is added. The existing food photo, receipt
frame, day rail, typography, and spacing already give each state a product
specific visual anchor. A generic empty-state asset would increase visual
surface area without improving a user decision.

Building a new "premium" component family was rejected: it would duplicate
well-adopted primitives and make the result less coherent than a measured
upgrade of those primitives.

### 5. Preserve local, correctable context boundaries

The interaction copy may reference only facts already available to the active
screen: the selected meal, confirmed pantry items, the current provider error,
pending-capture status, local time, local pantry data, saved preferences, or
an explicitly chosen venue. It must distinguish an estimate from a confirmed
record and must not turn contextual hints into automatic mutations.

Adding location, behavioral tracking, server-side profiles, or a new
personalisation store was rejected. They are not needed to improve the
specified transitions and would change the app's privacy model.

### 6. Make the premium acceptance pass a maintained release gate

`docs/owner-app-test-checklist.md` will receive a compact, reusable premium
interaction section. The task list for this change will point to concrete
automated checks and the owner-run device checks: save and return, pending and
failure, cancellation, reduced motion, screen-reader announcement, and
Android/iOS device review when supported. A UI-facing change is not marked
accepted solely because TypeScript or unit tests pass.

Keeping acceptance criteria only in individual PR descriptions was rejected:
it would not be discoverable when the next visual change is planned. Making
the checklist mandatory before any coding would be impractical for non-UI
changes, so the gate is scoped to UI-facing OpenSpec work.

## Risks / Trade-offs

- [A route can unmount before a toast is perceived] → Trigger the success
  request only after the write resolves, then use the already refreshed
  destination as the lasting confirmation.
- [Two live announcements can become noisy] → Keep one transient feedback
  host and avoid separately announcing visual-only motion.
- [Reduced-motion behavior can drift across components] → Route every new or
  changed transition through `useReducedMotion` and theme motion values, then
  exercise it in the acceptance pass.
- [A polished error can make provider failure look complete] → Reuse the
  existing error classification and use language that states whether the user
  can retry, enter data manually, open settings, or return later.
- [Capture cleanup can accidentally lose a recoverable photo] → Do not alter
  pending-capture or receipt ownership rules; test cancellation, discard, and
  saved-for-later branches before consolidating presentation code.
- [A broad shared refactor can regress barcode and receipt handling] → Adopt
  the shared feedback contract incrementally by route and retain route-level
  tests for each existing outcome.

## Migration Plan

1. Land the shared feedback and reduced-motion primitive changes with focused
   tests before migrating individual routes.
2. Migrate meal save and Today-return flows, then pantry and receipt review
   flows, validating each write and destination refresh independently.
3. Migrate capture busy and recovery presentation without modifying analysis,
   provider, or persistence code paths.
4. Run automated checks and complete the premium device acceptance record
   before accepting the change.

There is no data migration. Rollback is a normal application release rollback:
the previous screens and persisted records remain compatible because this
change introduces no new stored state or protocol.
