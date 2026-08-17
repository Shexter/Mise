# Cronometer analysis tracker

One row per feature teardown. Keep this current — it's the thing to scan
before starting a new teardown, so we don't duplicate work.

| Feature | Teardown | Tier | Verdict | Why (one line) | OpenSpec change |
|---|---|---|---|---|---|
| Full micronutrient report (~80 nutrients) | `nutrient-report/full-micronutrient-report.md` | free | **Adopt** — in `CRONO-ADAPTATION-PLAN.md`, promoted to do first | confirmed genuinely lab-sourced (USDA/NCCDB/CNF), but FoodData Central is CC0 and `add-open-data-catalogue`'s script already fetches its full nutrient array — extending the mapping is cheap, not a new data source | `none yet` |
| Weight goal + goal-rate onboarding | `goals-targets/weight-goal-and-rate-onboarding.md` | free | **Adopt** — in `CRONO-ADAPTATION-PLAN.md` | goal-directed calorie budgeting (target weight + rate → forecast date) is missing entirely; composes on top of existing `add-energy-sources` | `none yet` |
| Foods hub — Oracle Nutrient Search | `custom-foods/foods-hub.md` | free | **Adopt** — in `CRONO-ADAPTATION-PLAN.md` | extends `add-macro-gap-suggestions` with a directed "what's high in X" mode | extend `add-macro-gap-suggestions` |
| Foods hub — Repeat Items (scheduled auto-log) | `custom-foods/foods-hub.md` | free | Reject | conflicts with "the meal log IS the depletion signal" — a scheduled phantom log has no capture event behind it | `n/a` |
| Fasting | `other/quick-input-and-settings-hub.md` | free | **Adopt** (overridden from Reject) — in `CRONO-ADAPTATION-PLAN.md` | self-contained timer/window/history surface; must not touch pantry depletion logic | `none yet` |
| Global Quick Input sheet — Voice Log | `other/quick-input-and-settings-hub.md` | free | Adopt | cheap, fits existing vision-capture pipeline, closes an accessibility gap | `none yet` |
| Global quick-add entry point (single "+") | `other/quick-input-and-settings-hub.md` | free | Adapt | check `add-unified-capture`'s existing scope before treating as new | `none yet` |
| Discover dashboard + trend charts (with full "Manage Charts" configurability) | `charts-trends/dashboard-and-charts.md` | free (Gold upsells inline) | **Adopt** (overridden — keep the configurability) — in `CRONO-ADAPTATION-PLAN.md` | user-configurable chart picker across weight/calories/macros, extending to micronutrients later | `none yet` |
| Diary (Today screen) | _no teardown — already equivalent_ | free | n/a | same concept as Mise's Today screen (energy rings, meal sections); no material gap found | `n/a` |
| Onboarding notifications/TOS permission screens | _no teardown — reviewed, no action_ | free | Reject | local-first, no accounts (decision: local-first, no server/auth) — Cronometer's account/ToS/marketing-consent flow doesn't apply to Mise | `n/a` |

**Adopted items are consolidated in [`CRONO-ADAPTATION-PLAN.md`](./CRONO-ADAPTATION-PLAN.md).**

<!-- Add rows above this line, most recent first. -->
