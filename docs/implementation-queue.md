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

**284 of 288.** Every remaining task needs a physical device or a real API key —
none is blocked on code. They are a parallel track, not a queue position.

---

## 1 — Headroom and safety

Ordered together because the second needs the first.

### 1. `add-dish-scorer` — 47

Not for ranking quality. For **headroom**.

`parseSuggestResponse` already drops a suggestion twice: an invented canonical
id, and decision 136's use-first check. The prompt asks for exactly three. Every
drop rule added from here competes with having anything to show, and the next
change in this queue adds a third.

Over-generating a pool of ten fixes that structurally. It also unblocks
`add-suggestion-templates` and makes its decision 124 true rather than corrected.

### 2. `add-dietary-profile` — 59

The suggestion engine is live and has no notion of allergies, restrictions, or
dislikes. Safety-adjacent, and the one item here whose failure mode is not
"worse product".

**After the scorer**, because dietary exclusion is a third filter over a pool of
three. A user with recorded allergens would otherwise see one suggestion or none
routinely, and the spec's "report a short list" mitigation is honest but a poor
experience if it fires every night.

---

## 2 — Live wrongness in shipped paths

### 3. `add-open-data-catalogue` — 53

Every expiry prediction runs on 69 hand-authored guesses. That was cosmetic
while expiry only *sorted*. It stopped being cosmetic when decision 136's
use-first check landed, because expiry now decides the `use_first` bucket and
that bucket now **drops suggestions**. Wrong shelf life is no longer a bad sort;
it is a filter operating on invented numbers.

Task 1 measures the FoodKeeper hit rate before anything is built, so this can be
abandoned cheaply if the match rate is poor.

### 4. `add-cjk-matching` — 37

Decision 4 says deep Asian ingredient coverage is *the* differentiator.
Decision 67 measured `李錦記 蠔油` at **0.27** against its own canonical and has
been `OPEN` ever since. The moat is measurably broken.

Below the catalogue only because matching degrades gracefully — an unresolved
reference queues rather than producing a wrong answer.

### 5. `add-venue-inference` — 38

Depletion accuracy compounds into stock status, expiry buckets, and suggestions.
The sticky default is mediocre rather than broken, which is why it sits here
rather than higher.

### 6. `add-energy-sources` — 75

The only item in this queue driven by outside feedback: a personal trainer said
onboarding does not ask enough to work out what someone needs. Body-scan and
known-figure paths, with today's flow kept as the preselected default.

**Parallel-safe.** It touches `src/logic/bmr.ts`, `profileStore`, the onboarding
screens, and `Profile` — and nothing else in this queue goes near any of them.
It appends a migration, so it still cannot run concurrently with another change
that does, but it is the cheapest one to slot in beside a long-running branch.

### 7. `add-openai-provider` — 41

Self-contained, no migration, and it fixes a live annoyance: `rate_limited` has
been in the taxonomy since the beginning with nothing acting on it. Good work to
slot between larger changes.

---

## 3 — Input channels

### 8. `add-unified-capture` — 56

One action for adding to the pantry. Closes `add-receipt-import` 7.2a and sets
the shape the next one depends on.

### 9. `add-barcode-capture` — 51

After unified capture, which revises its task 5.1.

### 10. `add-recipe-links` — 47

New capability rather than a fix, which is the only reason it is this low. High
user value and no blocking dependency.

---

## 4 — Nutrition and personalisation

### 11. `add-fibre-tracking` — 31
### 12. `add-macro-gap-suggestions` — 29
### 13. `add-suggestion-templates` — 49

Needs 12 for the objective parameter and 1 for the scorer it weights.

---

## 5 — Needs a decision before it needs an implementer

### 14. `add-shop-locations` — 42

Task 1.2 establishes whether departure events need always-on location. If they
do, that is a materially larger ask than the proposal weighed and the change
should be re-decided rather than built.

### 15. `add-off-taxonomy-seed` — 37

Gated on the ODbL answer (decision 144, `OPEN`). Task 1 produces it; nothing
else may start. Also needs 3 for the pipeline.

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
- **67** — closed by change 4 above
