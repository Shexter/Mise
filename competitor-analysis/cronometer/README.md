# Cronometer feature-by-feature analysis

Working framework for turning Cronometer screenshots into scoped, decidable
work for Mise. This folder is scratch space, not a shipped artifact — it does
not ship in the app and is not read by any runtime code.

## Loop

1. **Drop screenshots** into the matching subfolder below (or paste them
   directly in chat — either works, but a saved folder gives us a durable
   record to diff against as Cronometer changes over time).
2. **Teardown** — one `<feature-slug>.md` per feature, from `_teardown-template.md`.
3. **Gap-check** — teardown gets checked against `docs/product-decisions.md`
   and the non-negotiables in `openspec/config.yaml`. Anything server-side,
   account-based, or that shows a bare quantity Mise "can't defend" is an
   automatic reject per the existing ledger — no need to re-litigate those.
4. **Verdict** — one row added to `TRACKER.md`: adopt / adapt / reject, with why.
5. **Adopt → OpenSpec** — anything verdicted "adopt" gets a real
   `openspec-propose` change, same as any other Mise feature. This folder
   never substitutes for that; it's the input to it.

## Folders

- `diary/` — food log / diary entry screens
- `nutrient-report/` — the nutrient-by-nutrient breakdown, RDA bars
- `custom-foods/` — custom food/recipe creation, barcode entry
- `biometrics/` — weight, measurements, custom biometrics
- `goals-targets/` — macro/micro targets, goal-setting flows
- `recipes/` — recipe builder, servings, recalculation
- `charts-trends/` — trend graphs, history views
- `gold-features/` — anything gated behind Cronometer Gold (paid tier) —
  flag these explicitly since "premium-gated" is itself a data point
- `other/` — anything that doesn't fit the above; rename/split once it fills up

## Files

- `_teardown-template.md` — copy this per feature
- `TRACKER.md` — the master status table, one row per feature
