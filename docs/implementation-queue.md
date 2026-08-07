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

## Next batch

Three, in this order. They touch disjoint files, so a conflict between them is
only possible in `MIGRATIONS` — and the first two do not append one.

1. **`add-history-calendar`** — 45. User-reported friction, and the cheapest
   thing in the queue: no schema change, no new stored data, one new query.
   The app has held every logged day since the first release and shows one week.
2. **`add-open-data-catalogue`** — 48. Task 1 is measured and says go. Also
   unblocks `add-macro-gap-suggestions`, which is paused on exactly the nutrition
   data group 8 produces.
3. **`add-venue-inference`** — 38. Ready, self-contained, and it improves
   depletion accuracy for everything already shipped.

---

## 1 — Live wrongness in shipped paths

### 0. `add-history-calendar` — 45

**User-reported.** `DateStrip` renders `weekOf(selectedDate)` — seven cells,
with no control that reaches another week, while `getLoggedDates()` already
returns every day ever logged, unbounded, on every refresh. Six days in seven
are in memory and unreachable.

No schema change and no new stored data (decision 182); the only missing piece
is a per-day summary query. A migration here means something was
misunderstood.

### 1. `add-open-data-catalogue` — 48

Every expiry prediction runs on 77 hand-authored guesses (69 at proposal time;
`add-dietary-profile` added 8 allergen-class markers since). That was cosmetic
while expiry only *sorted*. It stopped being cosmetic when decision 136's
use-first check landed, because expiry now decides the `use_first` bucket and
that bucket now **drops suggestions**. Wrong shelf life is no longer a bad sort;
it is a filter operating on invented numbers.

**Task 1 is done (5/5), measured 2026-08-06 against real data — go.** The
`foodsafety.gov`/`fsis.usda.gov` 403 was Akamai bot-blocking on those specific
hosts, not a general egress block; a Wayback Machine snapshot of the same live
file (July 2025) got past it. FoodKeeper: 661 products, 24/77 (31%) confident
match through the real `resolve()` cascade, 19/77 (25%) uncertain, 34/77 (44%)
no match. Asian/regional entries: every genuinely differentiating one
(gochujang, doubanjiang, belacan, kecap-manis, mirin, tamari) has no match, as
expected — the never-delete rule's justification holds. FoodData Central:
41/77 (53%) confident, 24 uncertain, 12 effectively no match (5 spurious top
hits + 7 zero-hit) — conditionally the real fix for `add-macro-gap-suggestions`
below, but a naive top-1 API call would mismatch ~16% of ingredients, so group
8 needs real disambiguation, not a thin search wrapper. A real, measured
cross-species mismatch surfaced in the FoodKeeper run too: `chicken-breast`
resolves confidently against a Turkey FoodKeeper row (0.87) over the correct
Chicken row (0.64) — worth a look before group 5 trusts confident matches
unattended. Full numbers, per-item lists, and methodology notes are inline in
`tasks.md` under task 1.
Groups 2-10 (53 tasks minus the 5 done = 48) not yet started.

### 2. `add-venue-inference` — 38

Depletion accuracy compounds into stock status, expiry buckets, and suggestions.
The sticky default is mediocre rather than broken, which is why it sits here
rather than higher.

### 3. `add-energy-sources` — 75

The only item in this queue driven by outside feedback: a personal trainer said
onboarding does not ask enough to work out what someone needs. Body-scan and
known-figure paths, with today's flow kept as the preselected default.

**Parallel-safe.** It touches `src/logic/bmr.ts`, `profileStore`, the onboarding
screens, and `Profile` — and nothing else in this queue goes near any of them.
It appends a migration, so it still cannot run concurrently with another change
that does, but it is the cheapest one to slot in beside a long-running branch.

### 4. `add-openai-provider` — 41

Self-contained, no migration, and it fixes a live annoyance: `rate_limited` has
been in the taxonomy since the beginning with nothing acting on it. Good work to
slot between larger changes.

---

## 2 — Input channels

### 5. `add-unified-capture` — 56

One action for adding to the pantry. Closes `add-receipt-import` 7.2a and sets
the shape the next one depends on.

### 6. `add-barcode-capture` — 51

After unified capture, which revises its task 5.1.

### 7. `add-recipe-links` — 47

New capability rather than a fix, which is the only reason it is this low. High
user value and no blocking dependency.

---

## 3 — Nutrition and personalisation

### 8. `add-fibre-tracking` — 31
### 9. `add-suggestion-templates` — 49

Needs `add-macro-gap-suggestions` for the objective parameter (see below —
currently blocked) and `add-dish-scorer` (shipped) for the scorer it weights.

---

## 4 — Needs a decision before it needs an implementer

### 10. `add-macro-gap-suggestions` — 29

**Blocked on missing data, not code.** Tasks 3.1 and 3.3 (`gapScore` ranking
by contribution to the targeted macro, and computing the best achievable
contribution from stock *before* the model is asked) both assume the app can
look up how much protein/carbs/fat a canonical ingredient supplies. It
cannot: `CanonicalItem` carries no nutrition fields at all — protein/carb/fat-
per-100g exists only on `Product` rows tied to a specific barcode-scanned SKU,
and most pantry items (receipt, vision, or manually entered) have no linked
product. Confirmed by reading `src/types.ts`, not assumed.

Discovered mid-implementation this round and paused rather than shipped with
a fabricated or degenerate local ranking. A real fix needs a nutrition-per-
canonical data source — `add-open-data-catalogue`'s FoodData Central half,
whose task 1 is now measured (see above): 41/77 catalogue entries get a
confident FDC nutrition hit, 12/77 effectively none. Still blocked on that
change's groups 2/8 actually being built, not on network access anymore.
A cheaper interim path exists (a coarse `FoodClass`-based local heuristic,
with the model supplying the actual numeric contribution per suggestion, the
same way it already estimates `kcalPerServing` with no local nutrition DB) —
not taken without the user's say-so, since it ships with materially weaker
fidelity than the design assumed.

### 11. `add-shop-locations` — 42

Task 1.2 establishes whether departure events need always-on location. If they
do, that is a materially larger ask than the proposal weighed and the change
should be re-decided rather than built.

### 12. `add-off-taxonomy-seed` — 37

Gated on the ODbL answer (decision 144, `OPEN`). Task 1 produces it; nothing
else may start. Also needs 1 for the pipeline.

### 13. `add-spoonacular-lookup` — 48

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
