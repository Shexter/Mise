# Cronometer feature-by-feature analysis

Working framework for turning Cronometer screenshots into scoped, decidable
work for Mise. This folder is scratch space, not a shipped artifact — it does
not ship in the app and is not read by any runtime code.

## Loop

1. **Drop screenshots into `inbox/`** — however they're named (`IMG_0234.png`,
   `Screenshot_2026...`, whatever the phone gives you). Don't sort them
   yourself.
2. **I sort and rename** — I look at each one, move it into the right feature
   subfolder below, and rename it to `<feature-slug>-<what-it-shows>.png`
   (e.g. `nutrient-report/rda-bars-collapsed.png`). `inbox/` should end up
   empty after each batch.
3. **Teardown** — one `<feature-slug>.md` per feature, from `_teardown-template.md`.
4. **Gap-check** — teardown gets checked against `docs/product-decisions.md`
   and the non-negotiables in `openspec/config.yaml`. Anything server-side,
   account-based, or that shows a bare quantity Mise "can't defend" is an
   automatic reject per the existing ledger — no need to re-litigate those.
5. **Verdict** — one row added to `TRACKER.md`: adopt / adapt / reject, with why.
6. **Adopt → OpenSpec** — anything verdicted "adopt" gets a real
   `openspec-propose` change, same as any other Mise feature. This folder
   never substitutes for that; it's the input to it.

## Folders

- `inbox/` — drop raw screenshots here, any filename. I sort/rename from here;
  nothing should sit in `inbox/` for long.
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
