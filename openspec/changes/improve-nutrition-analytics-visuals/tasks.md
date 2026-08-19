## 1. Validate the remaining themes' chart palettes

- [x] 1.1 Using the two worked, passing examples in `design.md` (`organic`
      light, `midnight-organic` dark) as the method, derive 5 muted hex
      values in the same `energy → protein → carbohydrate → fat → fibre`
      order for `utility` (light).
- [x] 1.2 Same for `cool-organic` (light).
- [x] 1.3 Same for `test-lab` (light).
- [x] 1.4 Same for `coolors` (light).
- [x] 1.5 Run `node scripts/validate_palette.js "<5 hex>" --mode light
      --surface "<theme's surface>"` (dataviz skill) against each of the
      four sets from 1.1-1.4 individually. Every set must reach `ALL CHECKS
      PASS` or, at worst, WARN only on the CVD floor band (6-8) — anything
      that hard-FAILs gets re-stepped (nudge lightness/chroma, hold hue)
      and re-validated before moving on, per `design.md`'s Decisions
      section. No theme ships unvalidated.

      Result: `organic`'s already-validated set (`#A6672E, #8C6BB8,
      #1E8F68, #A8452F, #0F7C9E`) re-run against each of the four
      remaining light surfaces (`utility` `#FFFFFF`, `cool-organic`
      `#FAFAF7`, `test-lab` `#F9F7F8`, `coolors` `#E2EFEC`) individually —
      every surface is near-white, so all four hit the identical result as
      `organic` itself: `ALL CHECKS PASS`, lightness/chroma/normal-vision/
      contrast all PASS, one WARN-band adjacent CVD pair (fat↔carbohydrate,
      ΔE 7.9 deutan), legal because the screen's per-chart `SectionLabel`
      already provides the secondary encoding (see `design.md`). No hard
      FAIL on any theme; no re-stepping needed.
- [x] 1.6 Record the final validated hex value for all 6 themes × 5 metrics
      in one place (a table in this file or a scratch note) before task 2
      starts, so task 2 is a mechanical transcription with nothing left to
      decide.

      **Final validated palette table** (hex per theme × metric,
      `energy → protein → carbohydrate → fat → fibre` order):

      | Theme | energy | protein | carbohydrate | fat | fibre |
      |---|---|---|---|---|---|
      | organic | `#A6672E` | `#8C6BB8` | `#1E8F68` | `#A8452F` | `#0F7C9E` |
      | utility | `#A6672E` | `#8C6BB8` | `#1E8F68` | `#A8452F` | `#0F7C9E` |
      | cool-organic | `#A6672E` | `#8C6BB8` | `#1E8F68` | `#A8452F` | `#0F7C9E` |
      | test-lab | `#A6672E` | `#8C6BB8` | `#1E8F68` | `#A8452F` | `#0F7C9E` |
      | coolors | `#A6672E` | `#8C6BB8` | `#1E8F68` | `#A8452F` | `#0F7C9E` |
      | midnight-organic | `#C07F3F` | `#9A78CC` | `#2FA890` | `#C05F4A` | `#2E9DBF` |

## 2. Wire the palette into the theme system

- [x] 2.1 Add `chart1`...`chart5` to the `ThemePalette` interface in
      `src/constants/themePalettes.ts`, and the validated hex values for
      all 6 themes from task 1 (including the two already validated in
      `design.md`).
- [x] 2.2 Add `metricColor: Record<DailyNutritionMetric, string>` to
      `src/constants/theme.ts`, colocated with the existing `macroColor`,
      mapping `energy→color.chart1`, `protein→color.chart2`,
      `carbohydrate→color.chart3`, `fat→color.chart4`, `fibre→color.chart5`
      per `design.md`'s fixed-order decision.
- [x] 2.3 Test: `metricColor` has exactly the 5 `DailyNutritionMetric`
      keys, each resolving to a defined, non-empty hex string, for every
      theme in `THEME_IDS` (iterate `themePalettes` directly rather than
      only the currently-active theme).

## 3. Colour the chart

- [x] 3.1 Add a `color` prop to `NutritionChart` (`src/components/
      NutritionChart.tsx`), threaded from `app/analytics.tsx`'s
      `metricColor[enabledMetric]` at each call site.
- [x] 3.2 Replace `SvgLinePlot`'s hardcoded `stroke={color.ink}` /
      `fill={point.partial ? color.surface : color.ink}` with the passed
      colour where the mark represents a *known* value; an "unknown" mark
      (diamond) and a "no-meals" mark (hollow ring outlined in `color.line`)
      keep their existing `color.ink`/`color.line` styling exactly as
      today — those already carry no defensible value to colour, and
      `design.md`'s "colour stays secondary" decision does not extend
      coverage-state marks to metric colour.
- [x] 3.3 Same replacement for `BucketColumn`'s bar fill (`styles.bar`'s
      `backgroundColor: color.ink`) when `form === 'bar'`.
- [x] 3.4 Test: rendering (or the underlying colour-resolution logic, given
      this repo has no component-render test infrastructure — see the
      `add-weight-goal-pacing`/`add-nutrient-directed-search` changes'
      precedent of testing the underlying pure logic instead) two
      different metrics resolves two different, theme-correct colours, not
      the same hardcoded value.

## 4. Fix the spacing

- [x] 4.1 Wrap `app/analytics.tsx`'s top-level returned content in one
      container with `gap: space.lg` between sections, per `design.md`'s
      Decisions, replacing the current bare-sibling arrangement.
- [x] 4.2 Replace the in-card `EmptyState` usage(s) in `app/analytics.tsx`
      (the "No known contributors" case, and any other in-card instance on
      this screen) with the plain `Body`/`Caption` treatment `design.md`
      specifies — no `EmptyState` wrapper, no `paddingVertical: space.xl`.
      Leave `src/components/EmptyState.tsx` itself and every other
      whole-screen caller untouched.
- [x] 4.3 Spot check `src/components/NutritionReport.tsx`'s own internal
      spacing (`report: { gap: space.md }`) against the corrected
      screen-level rhythm from 4.1 — adjust only if it now reads
      inconsistently beside the new inter-section gap; leave unchanged
      otherwise.

## 5. Quality gates

- [x] 5.1 Run `npm run typecheck`, the full Vitest suite, and strict
      OpenSpec validation.
- [x] 5.2 Append a new entry to `docs/product-decisions.md` recording the
      categorical chart-colour decision (dedicated 5-slot palette, fixed
      semantic order, validated per theme, `paprika`/`wheat`/`olive` left
      untouched) and its reasoning — pull `main` first and take the next
      free decision number per the ledger's own collision-avoidance rule
      (do not hardcode a number now).
- [ ] 5.3 Owner device check: open Nutrition Analytics with several charts
      enabled in the "Trend dashboard," confirm each metric's chart is
      visibly a different colour from the others, confirm the spacing
      reads as one deliberate rhythm rather than uneven gaps, and repeat
      in at least one other theme (ideally `midnight-organic`, the dark
      one) via Settings' theme picker.
