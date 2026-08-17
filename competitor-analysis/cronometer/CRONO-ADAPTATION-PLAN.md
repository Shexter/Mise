# Crono Adaptation Plan

The consolidated set of Cronometer features verdicted **Adopt** during the
teardown pass, with scope, dependencies, and open questions for each.

**Status: all 5 items now have real OpenSpec change proposals** at
`openspec/changes/<name>/` (proposal.md, design.md, a spec delta, and
tasks.md each) — this document is the index and rationale, not a
substitute for reading them. None have been implemented yet; each is
`openspec-apply`-ready when picked up.

Individual teardowns carry the full gap-check; this file exists to show how
the adopted pieces relate to each other and in what order they make sense.

---

## 1. Micronutrient tracking

**Teardown:** `nutrient-report/full-micronutrient-report.md`
**OpenSpec change:** `add-micronutrient-tracking`

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

**Scope (see `add-micronutrient-tracking/proposal.md` for the full
version):** extend `nutritionFromFdc()` with 8 more `nutrientValue()`
calls (fibre, vitamin C, iron, B12, calcium, folate, vitamin A, potassium),
add the matching 8 nullable `CanonicalItem` fields, reuse the existing
per-field provenance mechanism unchanged, keep missing-is-null discipline.
Folate's exact FDC ID needs verifying against live data before shipping —
multiple folate-related entries exist. The remaining ~70 FDC nutrients are
explicitly out of scope for this slice.

**Depends on:** nothing else in this plan.
**Feeds into:** item 3 (Oracle Nutrient Search needs nutrient data to
search over). **Does not** fully unlock item 5's chart picker for these
nutrients — see item 5's corrected note below.

---

## 2. Weight-goal + goal-rate pacing

**Teardown:** `goals-targets/weight-goal-and-rate-onboarding.md`
**OpenSpec change:** `add-weight-goal-pacing`

**Checked against the actual codebase:** `goalAdjustment(goal)` in
`src/constants/activityLevels.ts` is three fixed constants — -500/0/+300
kcal for lose/maintain/gain. No target weight, no rate, no forecast exists
anywhere.

**Scope:** an optional target weight + rate-of-change, unset by default,
that when both are set replace the fixed adjustment with one derived from
the rate — additive to the existing three-way choice, not a replacement of
it. A forecast date computed live from current weight (never stored, never
a fixed promise, in keeping with decision 15's spirit about overstating
certainty). Sits on top of `add-energy-sources`'s `TargetSource` dispatch
without changing how expenditure itself is computed. No weight history or
trend chart needed — pure forward arithmetic from the current figure.

**Depends on:** `add-energy-sources` (already shipped).
**Feeds into:** nothing else here — fully self-contained.

---

## 3. Oracle Nutrient Search

**Teardown:** `custom-foods/foods-hub.md`
**OpenSpec change:** `add-nutrient-directed-search`

**Checked against the actual codebase — this is a narrower, cleaner change
than "extend the suggestion engine."** `src/logic/macroGap.ts`'s
`assessMacroGap()` is already a general local ranking function — no
provider call, no cache, no dish scoring — that
`suggestionService.ts` currently only calls reactively, from inside its
`macro_gap` request mode. `MacroGapTarget`'s `'fibre'` case today
hard-returns `null` with a comment saying fibre "is not a pantry-suggestion
target yet" — item 1 is what finally makes it one.

**Scope:** extend `MacroGapTarget` with item 1's new nutrient fields, fix
the stale `'fibre'` case, and add a **pull-only, local-only** entry point
that calls `assessMacroGap` directly — explicitly *not* routed through
`suggestionService.ts`'s request-mode/cache/provider machinery, since
there's no "what should I cook" question here, just "what do I have."
Repeat Items (Cronometer's scheduled auto-logging) remains explicitly
rejected — conflicts with "the meal log IS the depletion signal."

**Depends on:** `add-micronutrient-tracking` — nothing to rank by for 7 of
8 target nutrients without it.

---

## 4. Fasting

**Teardown:** `other/quick-input-and-settings-hub.md`
**OpenSpec change:** `add-fasting-tracking`

Initially rejected as scope creep, reinstated on review. Note on evidence:
no screenshot of Cronometer's actual fasting screen was captured — only
"Fasting" and "New Fast" as menu entries — so this change's shape (timer,
optional target, history) is a reasonable generic fasting-tracker design,
not a copy of an observed Cronometer UI.

**Scope:** a self-contained fasting-window timer — start, optional target
duration, end, history — stored as one interval per fast (never bucketed
by calendar day, since fasts routinely cross midnight). **Structural**
boundary, not just a convention: no file in this feature imports pantry
depletion, consumption-event, or capture-review modules, checked by a
dependency test. No reminders, streaks, or meal-log integration on fast
end — Mise has no push-notification system today and this doesn't add one.

**Depends on:** nothing in this plan. Fully self-contained.

---

## 5. Configurable trend-chart dashboard

**Teardown:** `charts-trends/dashboard-and-charts.md`
**OpenSpec change:** `add-trend-charts`

Initially scoped down to a fixed 2-3 charts; reinstated with full
configurability on review.

**Two corrections found while writing the actual proposal, both narrowing
this item versus how it read here originally:**

- **Weight is not available at launch**, contrary to the earlier "weight,
  calories, macros at launch" scope note above. `profile.weight_kg` is a
  single current value, overwritten on every update — there is no
  `weight_log` table, no time series exists to chart. A weight trend chart
  needs that table built first, as its own change.
- **Micronutrients don't "extend automatically" once item 1 lands.** Item
  1 records nutrition per canonical *ingredient* in the build catalogue —
  charting "vitamin C consumed per day" needs a per-day *consumed* figure,
  which needs `meal_items` to carry a resolved vitamin C value the way it
  already carries `proteinG`. That's separate, unscoped work neither item
  1 nor this item builds.

**Scope, corrected:** available metrics at launch are energy, protein,
carbohydrate, fat, fibre — exactly `DailyNutritionMetric`'s existing union,
all already recorded per meal. A new ranged-summary function wraps the
existing per-day `dailyNutritionSummary` rather than reimplementing its
coverage logic. Chart rendering uses `react-native-svg` (a drawing
primitive, not a charting library) in a hand-rolled component matching
`MacroBars`' existing style — this is the first new dependency across all
5 items in this plan, flagged rather than glossed over. A singleton
`chart_preferences` row (matching the existing `suggestion_preferences`
pattern) stores which metrics are enabled and their order.

**Depends on:** nothing blocking for the launch scope (energy/macros/fibre
data already exists per day). Weight charting and micronutrient charting
are both real future work this item does not attempt — see corrections
above.

---

## Suggested sequencing

Not a commitment, just the dependency graph read as an order:

1. **Item 1 (`add-micronutrient-tracking`)** first. Cheapest lift (extends
   an already-shipped script), unlocks item 3.
2. **Item 2 (`add-weight-goal-pacing`)** or **item 4 (`add-fasting-
   tracking`)** — both fully self-contained, no dependencies, can run
   before, after, or in parallel with item 1.
3. **Item 5 (`add-trend-charts`)** — no hard blocker; can start any time,
   though its scope is now the corrected (weight/micronutrient-free)
   version above regardless of when it runs.
4. **Item 3 (`add-nutrient-directed-search`)** — last, since it's blocked
   on item 1 actually shipping.

## Next step

All 5 are `openspec-apply`-ready. Pick one — item 1 or item 4 are the
lowest-risk starting points — and run the apply workflow.
