# Cronometer analysis tracker

One row per feature teardown. Keep this current — it's the thing to scan
before starting a new teardown, so we don't duplicate work.

| Feature | Teardown | Tier | Verdict | Why (one line) | OpenSpec change |
|---|---|---|---|---|---|
| Full micronutrient report (~80 nutrients) | `nutrient-report/full-micronutrient-report.md` | free | Adapt | biggest real gap; adopt the RDA-bar idea, not the false precision — needs a confidence/provenance treatment since Mise's data is vision-estimated | `none yet` |
| Weight goal + goal-rate onboarding | `goals-targets/weight-goal-and-rate-onboarding.md` | free | Adopt | goal-directed calorie budgeting (target weight + rate → forecast date) is missing entirely; composes on top of existing `add-energy-sources` | `none yet` |
| Foods hub — Custom Meals/Recipes/Foods, Repeat Items, Oracle Nutrient Search | `custom-foods/foods-hub.md` | free | Adapt (Oracle search) / Reject (Repeat Items) | Oracle Nutrient Search extends `add-macro-gap-suggestions`; Repeat Items conflicts with "the meal log IS the depletion signal" | extend `add-macro-gap-suggestions` |
| Global Quick Input sheet + More/settings hub | `other/quick-input-and-settings-hub.md` | free | Adopt (Voice Log) / Reject (Fasting) / Adapt (global add entry point) | Voice Log is cheap and closes an accessibility gap; Fasting is unrelated scope creep; check `add-unified-capture` before proposing single global add button | `none yet` |
| Discover dashboard + trend charts | `charts-trends/dashboard-and-charts.md` | free (Gold upsells inline) | Adapt | simple fixed weight/calorie trend charts are worth adding; skip user-configurable chart management, that's Gold-tier-justifying complexity Mise doesn't need | `none yet` |
| Diary (Today screen) | _no teardown — already equivalent_ | free | n/a | same concept as Mise's Today screen (energy rings, meal sections); no material gap found | `n/a` |
| Onboarding notifications/TOS permission screens | _no teardown — reviewed, no action_ | free | Reject | local-first, no accounts (decision: local-first, no server/auth) — Cronometer's account/ToS/marketing-consent flow doesn't apply to Mise | `n/a` |

<!-- Add rows above this line, most recent first. -->
