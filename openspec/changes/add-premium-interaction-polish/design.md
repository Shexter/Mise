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

This is a local presentation and read-model change. It adds no nutrition-data
tables, migrations, network requests, provider configuration, or collected
health data. It may persist only display preferences such as metric, period,
aggregation, and chart form through the existing local key-value boundary.

## Goals / Non-Goals

**Goals:**

- Make all relevant save, pending, and recoverable-failure feedback use one
  typed, accessible pattern.
- Reuse the existing route parameters, stores, and focus refresh behavior to
  make a completed mutation visible at its destination.
- Make busy and recovery states explicit without changing the camera, media,
  review, or persistence architecture.
- Make reduced-motion handling deliberate in every new or changed transition.
- Add configurable, long-term nutrition charts and a structured report-style
  view on a dedicated Analytics page without converting missing data into zero
  or implying medical judgment.
- Keep Today focused on today's decision and meal log, and group saved recipes
  with stock as an explicit subsection of Pantry.
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
- Diagnosing a condition, prescribing a target, inventing clinical reference
  ranges, or presenting Mise as a substitute for a clinician.

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

### 7. Borrow Cronometer's progressive disclosure without importing scores

Current Cronometer documentation and user feedback consistently value three
connected ideas: energy and nutrient targets visible at a glance, meal-level
totals in the diary, and a tap from a highlighted nutrient to its top
contributors. Mise already stores enough local data for energy, protein,
carbohydrate, fat, and fibre, so these patterns can improve clarity without a
new provider, schema, or nutrition calculation.

Today will keep one dominant energy figure and a compact target strip. Each
supported metric shows consumed and target using plain values and a
colour-independent progress treatment. Fibre joins only where the fibre change
has supplied a defensible daily target and nullable logged values. Missing
nutrition is displayed as incomplete or not provided, never coerced to zero.

Selecting a metric opens the dedicated Analytics page at that metric and day,
where a contributor view uses the day's existing meals and meal items ordered
by their known contribution. It explains that items with unknown values are
excluded from that metric's subtotal. Meal rows retain a factual energy
subtotal; macro/fibre detail and historical evidence live in Analytics rather
than expanding the Today screen. Today does not gain charts, report tables,
configuration controls, or a second nutrition dashboard.

This change rejects Cronometer nutrition scores, good/bad grading, and streak
pressure. The transferable principle is progressive disclosure: overview
first, evidence on tap, unknowns visible. Longer-range analysis belongs on the
separate Nutrition Analytics page rather than increasing Today density.

### 8. Add configurable trends and clinical clarity without clinical claims

`app/analytics.tsx` will provide the dedicated longer-range surface, titled
Nutrition Analytics so it cannot be confused with usage tracking. Its shared
read model is derived locally from recorded daily targets and meal-item values
through range queries in `src/db/queries.ts`. It supports energy, protein,
carbohydrate, fat, and fibre; 7-day, 30-day, 90-day, and custom periods; daily
or weekly aggregation; and bar or line presentation. The selected display
configuration may be remembered locally, but it does not alter targets or meal
records.

The chart model carries a value and coverage state separately for every bucket.
A missing or partially known nutrient is a gap or partial bucket, never a zero
point. Weekly values aggregate only defensible known contributions and expose
coverage for the period. Historical target comparisons use each day's recorded
target; they do not repaint old history with the current profile. A date with no
meal is visually distinct from a logged date whose nutrient is unknown.

Below the chart, a report-style summary uses restrained clinical information
architecture: report period, metric and units, average known intake, recorded
target context, data-coverage statement, min/max where defensible, and a compact
table of period values. This is an on-screen personal record, designed so a
future export could preserve its hierarchy; this change does not create a PDF,
clinician workflow, diagnosis, risk flag, or medical recommendation. Copy states
that the report reflects logged data and may be incomplete.

The chart itself should be a small accessible in-repo SVG or React Native
primitive if the installed stack can support it without a new chart framework.
It must expose a non-visual table/summary equivalent, use theme semantic roles,
remain readable under every theme, and avoid red/green judgment. Adding a broad
chart library is acceptable only if the implementation review proves the local
primitive cannot meet accessibility, interaction, and performance needs.

### 9. Put saved recipes inside Pantry without mixing their data models

`app/(tabs)/pantry.tsx` will expose two clear subsections, Stock and Recipes,
with Stock selected by default. This is navigation and composition, not a data
merge: Stock continues to use `usePantryStore`, while Recipes continues to use
the existing local recipe queries and routes. The Recipes subsection reuses the
saved-recipe list and its add action; selecting or adding a recipe continues to
open the existing recipe detail and intake routes.

Pending receipts, saved captures, storage locations, camera capture, and manual
stock addition belong only to Stock. Recipe attribution, coverage, intake, and
empty-state actions belong only to Recipes. Switching subsections must not
reload, rewrite, or discard either collection, and it must remain usable with a
screen reader, large text, and all themes.

Adding Recipes as another bottom tab was rejected because it would make a
primary navigation slot for a collection that is conceptually part of the
kitchen. Mixing recipes into the stock list was rejected because a saved recipe
is not inventory and has different actions, states, and persistence rules.

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
- [A denser Today view becomes Cronometer-like instrumentation] → Cap the
  overview at energy, macros, and fibre; route contributors and every historical
  control to Analytics, then test large text before adding any additional metric.
- [Incomplete nutrition looks like poor performance] → Show coverage or an
  explicit unknown state and exclude unknown items from factual subtotals; do
  not render scores, grades, red/green verdicts, or implied adherence.
- [A trend line connects missing data and implies certainty] → Model complete,
  partial, unknown, and absent buckets separately; break lines and label chart
  coverage rather than interpolating.
- [A changed target rewrites the meaning of history] → Read the target recorded
  for each date and disclose mixed-target periods in the report summary.
- [Report styling is mistaken for medical interpretation] → Use clinical
  clarity and units, but include a logged-data limitation and prohibit diagnosis,
  risk flags, clinical ranges, and treatment recommendations.
- [Pantry becomes a mixed, crowded feed] → Use separate Stock and Recipes
  subsections with independent empty states, actions, data sources, and tests.

## Migration Plan

1. Land the shared feedback and reduced-motion primitive changes with focused
   tests before migrating individual routes.
2. Migrate meal save and Today-return flows, then pantry and receipt review
   flows, validating each write and destination refresh independently.
3. Migrate capture busy and recovery presentation without modifying analysis,
   provider, or persistence code paths.
4. Add only the compact Today target summary and meal subtotals after
   nullable-fibre contracts are available; route detail to Analytics.
5. Add the Analytics range model, contributors, accessible charts,
   configuration controls, and report summary from the same local records.
6. Compose the existing saved-recipe list as a Recipes subsection in Pantry,
   keeping stock and recipe actions and data models separate.
7. Run automated checks and complete the premium device acceptance record
   before accepting the change.

There is no data migration. Rollback is a normal application release rollback:
the previous screens and persisted records remain compatible because this
change introduces no new stored state or protocol.
