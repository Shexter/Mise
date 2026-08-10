# Implementation queue

The order changes as things land. The **principle** behind it is decision 162
and does not: fix what is live and wrong before adding what is new, and treat a
shipped mechanism's *inputs* as urgent once that mechanism starts enforcing.

Task counts are open tasks, not total.

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

Automated verification passed: typecheck, 497 tests, clean diffs, and strict
OpenSpec validation. These changes remain open until the owner completes their
in-app checks.

---

## Next batch

1. **`add-venue-inference`** — 38. Ready and self-contained. It improves
   depletion accuracy for every meal logged after it ships.

---

## 1 — Live wrongness in shipped paths

### 0. `add-venue-inference` — 38

Depletion accuracy compounds into stock status, expiry buckets, and suggestions.
The sticky default is mediocre rather than broken, which is why it sits here
rather than higher.

### 1. `add-energy-sources` — 75

The only item in this queue driven by outside feedback: a personal trainer said
onboarding does not ask enough to work out what someone needs. Body-scan and
known-figure paths, with today's flow kept as the preselected default.

**Parallel-safe.** It touches `src/logic/bmr.ts`, `profileStore`, the onboarding
screens, and `Profile` — and nothing else in this queue goes near any of them.
It appends a migration, so it still cannot run concurrently with another change
that does, but it is the cheapest one to slot in beside a long-running branch.

### 2. `add-openai-provider` — 41

Self-contained, no migration, and it fixes a live annoyance: `rate_limited` has
been in the taxonomy since the beginning with nothing acting on it. Good work to
slot between larger changes.

---

## 2 — Input channels

### 3. `add-unified-capture` — 56

One action for adding to the pantry. Closes `add-receipt-import` 7.2a and sets
the shape the next one depends on.

### 4. `add-barcode-capture` — 51

After unified capture, which revises its task 5.1.

### 5. `add-recipe-links` — 47

New capability rather than a fix, which is the only reason it is this low. High
user value and no blocking dependency.

---

## 3 — Nutrition and personalisation

### 6. `add-fibre-tracking` — 31
### 7. `add-suggestion-templates` — 49

Needs `add-macro-gap-suggestions` for the objective parameter after its plan
refresh (see below), and `add-dish-scorer` (shipped) for the scorer it weights.

---

## 4 — Needs a decision before it needs an implementer

### 8. `add-macro-gap-suggestions` — 29

**The data blocker is resolved; the plan is stale.** `CanonicalItem` now holds
nullable nutrition per 100 g, with usable FoodData Central figures for 49 of 77
catalogue entries. Missing figures remain unknown, so gap ranking must handle
partial coverage explicitly.

Do not implement the current tasks unchanged. The proposal still says the
dinner engine has not landed, and the queue text still assumes canonical
nutrition does not exist. Update the OpenSpec change against the shipped dinner
engine and the new nutrition fields first. After that revision, this change is
implementable without a new data source.

### 9. `add-shop-locations` — 42

Task 1.2 establishes whether departure events need always-on location. If they
do, that is a materially larger ask than the proposal weighed and the change
should be re-decided rather than built.

### 10. `add-off-taxonomy-seed` — 37

Gated on the ODbL answer (decision 144, `OPEN`). Task 1 produces it; nothing
else may start. It also needs the completed `add-open-data-catalogue` pipeline.

### 11. `add-spoonacular-lookup` — 48

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
