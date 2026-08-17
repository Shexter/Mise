# Crono Adaptation Plan

The consolidated set of Cronometer features verdicted **Adopt** during the
teardown pass, with scope, dependencies, and open questions for each. This
is a planning document, not an OpenSpec change — per the workflow in
`README.md`, each item below becomes a real `openspec-propose` change when
picked up.

Individual teardowns carry the full gap-check; this file exists to show how
the adopted pieces relate to each other and in what order they make sense.

---

## 1. Micronutrient tracking

**Teardown:** `nutrient-report/full-micronutrient-report.md`

Confirmed: Cronometer's ~80-nutrient RDA report runs on a genuinely
lab-sourced database (USDA FoodData Central, NCCDB, Canadian Nutrient File,
verified manufacturer label submissions) — not crowdsourced. Mise has no
equivalent licensed source, so this can't be copied mechanically.

**Scope:**
- Extend `CanonicalItem`/`Product` to carry per-nutrient fields beyond the
  current macros + fibre.
- Source packaged/barcoded items from Open Food Facts' existing extended
  nutrient fields where present (many products already carry them).
- For anything vision-estimated (photographed home-cooked meals), either
  omit the nutrient rather than fabricate a number, or mark it as a rough
  estimate — extend fibre's existing precedent (decision 188: default
  target, no health claim, historical rows stay unknown rather than
  reading as zero) nutrient-by-nutrient rather than inventing a new rule.
- Phase it: the 8 "highlighted" nutrients first (fibre shipped; add
  vitamin C, iron, B12, calcium, folate, vitamin A, potassium next), not
  all ~80 at once.

**Depends on:** nothing else in this plan — this is the foundation item.
**Feeds into:** item 3 (Oracle Nutrient Search needs nutrient data to
search over) and item 5 (chart picker gets more chartable metrics once
this lands).

---

## 2. Weight-goal + goal-rate pacing

**Teardown:** `goals-targets/weight-goal-and-rate-onboarding.md`

**Scope:**
- Target weight + a rate-of-change stepper (kg/week), computed against
  the expenditure figure Mise already derives via `add-energy-sources`'s
  `TargetSource` dispatch — this sits *on top of* that work, doesn't
  replace it.
- A forecast completion date, presented as a moving estimate that updates
  as logging continues — not a fixed promise, given how close a specific
  dated claim sits to the spirit of decision 15.

**Depends on:** `add-energy-sources` (already shipped).
**Feeds into:** nothing else here — fully self-contained. Good first
candidate to propose given no dependencies.

---

## 3. Oracle Nutrient Search

**Teardown:** `custom-foods/foods-hub.md`

Cronometer's "search for foods high in specific nutrients to meet your
needs," as a directed counterpart to the general suggestion engine.

**Scope:**
- Extend `add-macro-gap-suggestions` with a directed mode: "what's high in
  fibre / iron / vitamin C" rather than only "here's a general gap-filling
  suggestion."
- Note: **Repeat Items** (Cronometer's scheduled auto-logging) is
  explicitly **not** part of this plan — it conflicts with "the meal log
  IS the depletion signal," a scheduled phantom log has no capture event
  behind it. Left out on purpose, not forgotten.

**Depends on:** item 1 for any nutrient beyond the current macros/fibre —
searching "high in vitamin C" needs vitamin C data to exist first.

---

## 4. Fasting

**Teardown:** `other/quick-input-and-settings-hub.md`

Initially rejected as scope creep, reinstated on review.

**Scope:**
- A self-contained fasting-window timer: start time, target duration,
  active/complete state, history.
- **Explicit boundary:** must not touch pantry depletion or the capture
  pipeline. This is a logging/tracking surface like biometrics, not a
  capture path — keep it that way structurally, not just by convention.
- Open question, not required for v1: should breaking a fast prompt a meal
  log? A nice integration point later, not a launch requirement.

**Depends on:** nothing in this plan. Fully self-contained.

---

## 5. Configurable trend-chart dashboard

**Teardown:** `charts-trends/dashboard-and-charts.md`

Initially scoped down to a fixed 2-3 charts; reinstated with full
configurability on review — build the "Manage Charts" / "Add Chart"
richness, not a stripped-down version.

**Scope:**
- A user-level "which charts are shown, in what order" preference record.
- Chart picker over available metrics: weight, calories, macros at
  launch.
- Extends automatically as item 1 lands — once individual micronutrients
  are tracked, they become pickable chart metrics without new
  infrastructure.

**Depends on:** the underlying time-series data already exists (history
calendar, meal logs); item 1 extends *what* can be charted but isn't a
hard blocker for a v1 covering weight/calories/macros.

---

## Suggested sequencing

Not a commitment, just the dependency graph read as an order:

1. **Item 2 (weight-goal pacing)** or **Item 4 (fasting)** first — both are
   fully self-contained, no dependencies, good standalone proposals.
2. **Item 1 (micronutrient tracking)** — the foundation item; biggest
   scope, unlocks two other items.
3. **Item 5 (chart picker)** — can start in parallel with item 1 (weight/
   calories/macros charts don't need it), gets richer once item 1 lands.
4. **Item 3 (Oracle Nutrient Search)** — last, since it's the most
   dependent on item 1 actually shipping nutrient data to search over.

## Next step

Each item above becomes a real `openspec-propose` change when picked up —
this document is the input to that step, not a replacement for it.
