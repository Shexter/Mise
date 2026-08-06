## Context

See `proposal.md` — the terms, the honest comparison against sources that permit
storage, and the second-key cost.

What ships today: `src/api/keyStore.ts` holds exactly one credential and is the
only module permitted to touch it. `src/api/errors.ts` defines the shared
`VisionError` taxonomy. `src/api/vision.ts` dispatches to provider transports.
The suggestion cache persists to SQLite. Every existing remote lookup in the
plans — Open Food Facts in `add-barcode-capture`, FoodData Central in
`add-open-data-catalogue` — is designed to be *cached durably*, because their
licences permit it.

This one cannot be, which makes it structurally unlike everything else in the
codebase.

## Goals / Non-Goals

**Goals:**

- If this is built, it cannot accidentally persist anything.
- The app is provably unchanged when it is absent.
- The decision whether to build it at all is made on evidence, before the code.

**Non-Goals:**

- Storing results, populating the app's records, replacing the estimator, the
  catalogue, or the dinner decision, offline support, shipping a key. See the
  proposal.

## Decisions

### The constraint is enforced by shape, not by care

`src/logic/lookupStore.ts` is an in-memory map with a TTL. The client returns
its types, and **those types never appear in any function that writes**.

*Why structural rather than a rule:* "do not save this" is a discipline that
survives exactly as long as the person who knows why. The next contributor sees
a nutrition figure in hand and a nutrition column beside it, and the terms are
not in the diff. Making the persistence layer unable to accept the type is the
only version of this that holds.

*How it is checked:* a test asserting no database write occurs across a lookup
session, and a type boundary — lookup result types live in their own module and
are not imported by `src/db/queries.ts`. A grep-level assertion is weak; an
import-level one is not.

### Retention is in memory, because disk is storage

The permitted window is one hour and requires written permission. In-memory
retention with a TTL, discarded on process exit.

*Why not a disk cache with a TTL:* a file on disk is storage, and a TTL is a
promise about deletion rather than a fact about it. A killed process leaves the
file. This is the distinction the terms actually draw, and getting it wrong is
not a bug, it is a breach.

*Consequence, named plainly:* the feature is useless on a plane, slow on bad
signal, and spends the user's quota on every session. That is what the terms
buy, and it is why the surrounding app must never depend on it.

### It may not touch a single existing write path

Not the meal log, not the pantry, not the catalogue, not aliases, not dietary
rules.

*Why this is the load-bearing rule:* it is what keeps the terms satisfiable
*retroactively*. If a subscription lapses, the terms require deleting everything
obtained under it — and if a lookup had ever populated a logged meal, honouring
that would mean reaching into a user's own diary and removing figures they
believe are theirs. That is a conflict with no acceptable resolution, so the
only safe position is that it never happens.

*What the user gets instead:* they read the result and, if they want it
recorded, they log the meal the way they log any other. Their record is theirs
because they made it, not because it was copied.

### The key is the user's, and `keyStore` becomes plural

*Why not ship one:* it would leak from the APK — the project already refuses
this for vision keys — and it would put our billing behind every user's usage of
a metered API.

*Why this is a real cost:* `keyStore.ts` holding exactly one credential is a
non-negotiable convention, and a second slot with a different lifecycle
(monthly, lapsing, with deletion obligations on expiry) is a change to the most
carefully guarded module in the app, for a feature that is optional by design.
The plural shape should be introduced deliberately, not as a side effect.

### The gate comes first, and it may end the change

Task 1 establishes in writing what is permitted. Three outcomes:

- **Browse-only with in-memory retention is fine.** Build it.
- **Even that needs written permission.** Get it, or stop.
- **It is not workable.** Record why and abandon. The comparison table in the
  proposal is what the app does instead, and none of it is blocked.

*Why a gate rather than building and checking:* the same argument as decision
144 on ODbL, and stronger here. There, the question was whether an obligation
attaches. Here the terms are explicit and restrictive, and the risk is building
an integration whose only honest use turns out to be narrower than the effort.

## Risks / Trade-offs

**The feature is thin** → browse-only, online-only, keeping nothing. That is
what the terms permit, and calling it more would be dishonest. Whether it earns
a subscription and a second key is a product judgement the gate exists to
inform.

**Someone later wires it into a write path** → the highest-consequence risk, and
why enforcement is structural. A well-meaning contributor connecting a nutrition
result to a nutrition column would put the app in breach with no test failing,
unless the type boundary makes it impossible.

**Quota exhaustion mid-session** → metered, and a per-session cache does not
amortise across days. Handled through the existing error taxonomy, which already
distinguishes rate limiting from billing.

**Users assume it is the app's data** → results appearing beside the catalogue
look like the catalogue. Mitigated by visible provenance and by offering no save
action, which is also the terms requirement.

**Deleting on lapse** → if nothing is ever stored, this is satisfied by
construction. This is the entire reason for the no-write rule.

## Migration Plan

None. **A migration in this change is a sign the no-persistence rule has been
broken.** If one appears, the change is wrong.

## Open Questions

- **Whether attribution has a required form.** Could not be verified —
  `spoonacular.com/food-api/terms` returned 403 from this environment, so the
  terms language quoted in the proposal comes from secondary sources and must be
  confirmed against the original before anything is built.
- **Whether the free tier is usable at all** for a browse surface, given points
  are charged per request plus per result.
- **Whether the recipe corpus is the real draw**, and if so whether a
  browse-only view of it is worth the second key — or whether
  `add-recipe-links`, where the user brings recipes and the app *can* keep them,
  serves the same want better.
