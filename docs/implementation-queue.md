# Implementation queue

## Live queue snapshot — 11 August 2026

The older dependency narrative below is retained for history, but its task
counts are stale. Current code work has reached these boundaries:

1. `add-receipt-import` — **79/79**. Implementation complete; owner approval is
   required before archival.
2. `add-recipe-links` — **28/47**. Next is evidence collection (share-sheet
   payloads and real caption fixtures), then the gated intake work.
3. `add-premium-interaction-polish` — **39/41**. Code and concrete acceptance
   matrices are complete; two owner/device evidence tasks remain.
4. `add-brand-identity-system` — **30/32**. Owner acceptance remains.
5. `add-barcode-capture` — **52/65**. Remaining work is external licensing and
   device acceptance.
6. `add-openai-provider` — **35/41**, `add-energy-sources` — **66/75**,
   `add-unified-capture` — **46/58**, and `add-fibre-tracking` — **27/31**.
   Their remaining tasks require real keys, fixtures, research, or device
   acceptance; do not mark them complete from code-only verification.
7. `add-app-wide-editing` — **18/22**. Pantry dependent refresh and automated
   quality gates are implemented. Capture/barcode/receipt correction paths and
   owner device checks remain.

Do not archive any of these before owner app testing. Use `openspec list --json`
for the live counts before selecting the next task.

The order changes as things land. The **principle** behind it is decision 162
and does not: fix what is live and wrong before adding what is new, and treat a
shipped mechanism's *inputs* as urgent once that mechanism starts enforcing.

Fractions show complete tasks over total tasks. A standalone number is the total
for an unstarted change.

---

## Shipped

| Change | Tasks | Note |
|---|---|---|
| `add-identity-layer` | 43/43 | |
| `add-pantry-stock` | 32/32 | |
| `add-stock-depletion` | 51/51 | |
| `add-dinner-decision` | 56/58 | 2 open need a real key |
| `add-receipt-import` | 78/79 | 1 open waits on `add-unified-capture` |
| `fix-day-selection` | 24/25 | 1 open needs a standalone APK |
| `add-dish-scorer` | 41/47 | 6 open need a real key or `add-dietary-profile` |
| `add-dietary-profile` | 62/64 | 2 open: one waits on `add-macro-gap-suggestions`, one needs a real key |
| `add-cjk-matching` | 37/37 | |

**424 of 436.** Every remaining task needs a physical device or a real API key —
none is blocked on code. They are a parallel track, not a queue position.

---

## Implemented, awaiting owner acceptance

| Change | Tasks | Note |
|---|---|---|
| `add-open-data-catalogue` | 62/67 | Five in-app checks remain before archival. |
| `edit-logged-meals` | 26/32 | Six Expo Go checks remain before archival. |
| `add-history-calendar` | 39/46 | Seven in-app history-navigation checks remain before archival. |
| `add-venue-inference` | 26/38 | Twelve real-photo, provider, and in-app checks remain before archival. |
| `add-app-wide-editing` | 18/22 | Capture correction and owner device checks remain. |
| `add-voice-pantry-intake` | 33/35 | Device and kitchen measurement remain (tasks 7.5, 7.6). |

Automated verification passed: typecheck, 526 tests, clean diffs, and strict
OpenSpec validation. These changes remain open until the owner completes their
in-app checks.

---

## Next batch

1. **`add-energy-sources`** — 0/75, ready. Keep the current onboarding route as
   the preselected path. This change appends the next migration.
2. **`add-openai-provider`** — 0/41, ready. It is self-contained and adds no
   migration, so it is a useful follow-up after the larger onboarding change.
3. **`add-unified-capture`** — 0/56, ready. It closes the final receipt-import
   dependency and defines the capture shape used by barcode work.
4. **`add-barcode-capture`** — 0/51, blocked on `add-unified-capture`. Apply it
   only after unified capture revises its task 5.1.
5. **`add-recipe-links`** — 0/47, ready. It adds a user-owned recipe input path
   without depending on the stale macro-gap plan.
6. **`add-fibre-tracking`** — 0/31, ready. Keep unknown fibre nullable and do
   not infer zero from missing catalogue data.

Run migration changes one at a time. `add-openai-provider` is the only item in
this batch that does not append or revise persisted state.

---

## 1 — Live wrongness in shipped paths

### 0. `add-energy-sources` — 75

The only item in this queue driven by outside feedback: a personal trainer said
onboarding does not ask enough to work out what someone needs. Body-scan and
known-figure paths, with today's flow kept as the preselected default.

**Parallel-safe.** It touches `src/logic/bmr.ts`, `profileStore`, the onboarding
screens, and `Profile` — and nothing else in this queue goes near any of them.
It appends a migration, so it still cannot run concurrently with another change
that does, but it is the cheapest one to slot in beside a long-running branch.

### 1. `add-openai-provider` — 41

Self-contained, no migration, and it fixes a live annoyance: `rate_limited` has
been in the taxonomy since the beginning with nothing acting on it. Good work to
slot between larger changes.

---

## 2 — Input channels

### 2. `add-unified-capture` — 56

One action for adding to the pantry. Closes `add-receipt-import` 7.2a and sets
the shape the next one depends on.

### 3. `add-barcode-capture` — 51

After unified capture, which revises its task 5.1.

### 4. `add-recipe-links` — 47

New capability rather than a fix, which is the only reason it is this low. High
user value and no blocking dependency.

---

## 3 — Nutrition and personalisation

### 5. `add-fibre-tracking` — 31
### 6. `add-suggestion-templates` — 49

Needs `add-macro-gap-suggestions` for the objective parameter after its plan
refresh (see below), and `add-dish-scorer` (shipped) for the scorer it weights.

---

## 4 — Needs a decision before it needs an implementer

### 7. `add-macro-gap-suggestions` — 29

**The data blocker is resolved; the plan is stale.** `CanonicalItem` now holds
nullable nutrition per 100 g, with usable FoodData Central figures for 49 of 77
catalogue entries. Missing figures remain unknown, so gap ranking must handle
partial coverage explicitly.

Do not implement the current tasks unchanged. The proposal still says the
dinner engine has not landed, and the queue text still assumes canonical
nutrition does not exist. Update the OpenSpec change against the shipped dinner
engine and the new nutrition fields first. After that revision, this change is
implementable without a new data source.

### 8. `add-shop-locations` — 42

Task 1.2 establishes whether departure events need always-on location. If they
do, that is a materially larger ask than the proposal weighed and the change
should be re-decided rather than built.

### 9. `add-off-taxonomy-seed` — 37

Gated on the ODbL answer (decision 144, `OPEN`). Task 1 produces it; nothing
else may start. It also needs the completed `add-open-data-catalogue` pipeline.

### 10. `add-spoonacular-lookup` — 46

Gated, and the gate may end it. Spoonacular's terms forbid storing what it
returns, including derived data, and cap caching at an hour — which is
incompatible with a permanent food diary by construction (decision 179).

Task 1 confirms the terms against the original source; task 2 decides whether
the one permitted role, a browse-only surface that keeps nothing, is worth a
subscription and a second credential. Deciding not to build it is a successful
outcome and blocks nothing — decision 181 lists what already covers each want.

---

## Sequencing note

Most of these append a forward-only migration to `MIGRATIONS` and extend
`src/types.ts`. **Run them one at a time.** Concurrent branches conflict in the
one file where ordering is load-bearing, and the ledger has already collided
twice on parallel work.

## Open questions that need usage, not planning

- **132** — the suggestion engine's thresholds are named guesses
- **135** — extraction accuracy beyond the fixture corpus
- **144** — the ODbL question
- **176** — `add-dish-scorer`'s weights are measured against fixtures only,
  not real usage (tasks 2.5, 9.1-9.5)
- **177** — `add-dietary-profile`'s prompt-length-at-scale question (task 6.9)
  is measured against fixtures only, not real usage
- **new, from `add-cjk-matching`** — the CJK confirm-band scores (0.60-0.84)
  and the near-miss non-collision result are measured against an authored
  33-fixture corpus, not real receipts. Decision 32 notes the same limit for
  the Latin corpus.
