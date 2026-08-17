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
verified manufacturer label submissions) — not crowdsourced. But most of
that isn't proprietary: FoodData Central is CC0 public domain, and **Mise
already has the pipeline that pulls from it.**

**Checked against the actual codebase — this is cheaper than it looks.**
`scripts/build-catalogue.ts` (built by `add-open-data-catalogue`, 62/67
tasks done) already calls the FoodData Central API per ingredient and reads
its full `foodNutrients` array. Task 2.3 scoped the mapping to exactly four
fields — `kcalPer100`, `proteinPer100`, `carbsPer100`, `fatPer100`, each
pulled through a small `nutrientValue(food, nutrientId, nameRegex)` helper
keyed on FDC's standard numeric nutrient IDs (1008 = Energy, 1003 =
Protein, 1005 = Carbohydrate, 1004 = Fat). The API response already
contains every other nutrient FDC tracks — fibre, vitamin C, iron, B12,
calcium, folate, vitamin A, potassium, and the rest of the ~80 — sitting
unread in the same array the script already fetches. Adding a nutrient is
one more `nutrientValue()` call and one more schema field, not a new data
source, a new API integration, or a new licence question.

One correction to the earlier read: `fibrePer100` exists on `CanonicalItem`
but is **not** currently populated by this pipeline — `build-catalogue.ts`
has no fibre mapping at all. Today's fibre values come only from
`fibreDerivation.ts`'s per-meal vision estimate. Wiring fibre through the
catalogue script doesn't just add coverage, it **upgrades** fibre from a
vision guess to an FDC lab-measured value for any ingredient the resolver
already matches — a strict quality improvement, not just new ground.

**Scope:**
- Extend `build-catalogue.ts`'s FDC mapping (not `CanonicalItem`'s schema
  design, which already has the right shape via `sources: Partial<Record<
  field, SourceId>>`) with one `nutrientValue()` call per target nutrient.
  Standard FDC nutrient IDs for the 8 highlighted targets (verify each
  against the live FDC schema before shipping — noted here from the
  standard numbering, not independently re-checked per ID): fibre ≈ 1079,
  vitamin C ≈ 1162, iron ≈ 1089, vitamin B12 ≈ 1178, calcium ≈ 1087, folate
  ≈ 1177/1190 (multiple folate forms exist — pick the one that matches
  Cronometer's "Folate" row), vitamin A ≈ 1106, potassium ≈ 1092.
- Per-field provenance (`sources`) already exists and already handles
  exactly this shape — a dataset value per field, hand-authored values
  never silently overwritten. No new plumbing needed there.
- For packaged/barcoded items: Open Food Facts already carries extended
  nutrient fields for many products — a second, already-integrated source
  alongside FDC, not a new one.
- For vision-estimated composite meals (the one place FDC/OFF can't help,
  because nobody logged a real ingredient): keep the existing
  "missing is unknown, not zero" discipline (decision 188, already applied
  to fibre) rather than fabricating a precise-looking percentage from a
  photograph.
- Phase it: the 8 "highlighted" nutrients first (this upgrades fibre from
  vision-only to catalogue-backed as part of the same batch, plus the
  other 7), before the remaining ~70.

**Depends on:** nothing else in this plan — this is the foundation item,
and per the finding above it's mostly extending existing, already-shipped
infrastructure rather than building new.
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

Not a commitment, just the dependency graph read as an order — revised now
that item 1 turns out to be a small extension of an existing script rather
than new infrastructure, which moves it earlier:

1. **Item 1 (micronutrient tracking)** first, not last. It's the foundation
   two other items depend on, and per the finding above it's mostly adding
   `nutrientValue()` calls to a script that already fetches the data,
   plus IDs to verify — not a new pipeline. Low cost, unlocks the most.
2. **Item 2 (weight-goal pacing)** or **Item 4 (fasting)** — both fully
   self-contained, no dependencies, can run before or in parallel with
   item 1.
3. **Item 5 (chart picker)** — can start once item 1 lands to get
   micronutrient charts for free, or earlier with just weight/calories/
   macros if sequencing pressure favours it.
4. **Item 3 (Oracle Nutrient Search)** — last, since it's the most
   dependent on item 1 actually shipping nutrient data to search over.

## Next step

Each item above becomes a real `openspec-propose` change when picked up —
this document is the input to that step, not a replacement for it.
