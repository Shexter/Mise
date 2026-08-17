# Full micronutrient report (Discover → Report)

**Screenshots:** `report-highlighted-targets.jpg, report-consumed-expenditure.jpg, report-targets-vitamins-start.jpg, report-minerals-carbs.jpg, report-lipids-protein-start.jpg, report-amino-acids.jpg, report-amino-acids-2.jpg`
**Cronometer tier:** free (the report itself); "Nutrition Scores" and "Crono Coach" summary panels are Gold-gated

## What it does

For any date range, Cronometer shows every logged nutrient against its RDA as a
labelled progress bar: 8 "highlighted" ones up top (fibre, vitamin C, iron,
B12, calcium, folate, vitamin A, potassium), then the full breakdown —
vitamins (B1–B12, C, D, E, K...), minerals (magnesium through zinc),
carbohydrate sub-types (net carbs, soluble/insoluble fibre, starch, sugars,
added sugars), lipids (down to omega-3 EPA, omega-6 AA/LA, saturated, trans),
and all nine/eleven amino acids. Roughly 80+ rows in one continuous list.
Each row shows a percent of target and a "No Data" state when nothing was
logged that could supply it.

## UI pattern observed

One long scrollable list under tabbed sections (Dashboard / Charts / Report /
Snapshots). Percent-complete progress bars throughout, consistent row shape:
name — value/status — % — bar. Sub-nutrients are visually nested and smaller
under their parent (e.g. Fibre → Fibre Soluble/Insoluble under Carbs). No
data yet reads as "No Data · 0%" rather than a blank space — always renders
the full nutrient list even at zero.

## Implied data model

Every food/ingredient needs per-100g values for ~80 individual nutrients
(not just the 4 macros + calories Mise currently tracks well, or the fibre
field just added). Amino acid and omega-subtype breakdown implies a much
richer ingredient nutrition schema than `Product`/`CanonicalItem` currently
carries.

## Gap-check against Mise

- **Already have:** calories, protein, carbs, fat (via vision + Open Food
  Facts/barcode), and fibre (`add-fibre-tracking`, just landed).
- **Partially have:** `add-macro-gap-suggestions` already reasons about
  macro gaps, so the *pattern* of "you're short on X" exists — it just
  doesn't extend past the four macros/fibre today.
- **Missing entirely:** ~75 other nutrients (vitamins, minerals, individual
  amino acids, fat sub-types). Nothing in `src/logic/nutrition.ts` or
  `Product`/`CanonicalItem` carries this data today.
- **Conflicts with a non-negotiable:** none found. Decision 15 ("never
  display a quantity we cannot defend") governs *pantry stock* estimates,
  not consumed-nutrition reporting — this is a different domain and doesn't
  trip that rule.

## Verdict

**Adapt** — the breadth of Cronometer's micronutrient tracking is its
single biggest differentiator over every other food-logging app, and it's
the most obvious "much more than Mise has" gap in this whole analysis. But
copy the *idea* (RDA-relative nutrient bars, an 8-nutrient highlighted
subset), not the mechanism: Cronometer relies on a licensed nutrition
database with lab-measured values per food. Mise's capture path is
vision-estimated and barcode/receipt-derived, so a micronutrient figure
built the same way for a lot of foods would be a much noisier estimate than
protein/carbs/fat are today — worth a confidence/provenance treatment (or a
"partial data" state) rather than presenting a precise-looking percentage
Mise can't actually stand behind for e.g. a photographed home-cooked meal.
Fibre's precedent (decision 188 — default target, no health claim,
historical rows stay unknown rather than reading as zero) is exactly the
model to extend nutrient-by-nutrient.

**Linked OpenSpec change:** `none yet` — candidate for a new
`add-micronutrient-tracking` change, phased (start with the 8 "highlighted"
ones: fibre already shipped, vitamin C/iron/B12/calcium/folate/vitamin
A/potassium next) rather than all ~80 at once.

**Confirmed:** Cronometer's core database really is lab-sourced, not
crowdsourced — anchored to USDA FoodData Central, the NCCDB (University of
Minnesota, considered the research-grade standard), the Canadian Nutrient
File, and verified manufacturer label submissions. User-submitted foods sit
in a separate, explicitly lower-trust tier. This confirms rather than
undercuts the verdict above: Mise has no equivalent licensed source, so the
confidence/provenance treatment isn't a nice-to-have, it's load-bearing.
See `CRONO-ADAPTATION-PLAN.md` for the sourcing strategy this implies.

Sources: [Cronometer Data Sources](https://support.cronometer.com/hc/en-us/articles/360018239472-Data-Sources), [What Database Does Cronometer Use?](https://wellnd.com/what-database-does-cronometer-use-a-look-at-its-data-sources)
