## Why

`src/logic/macroGap.ts`'s `assessMacroGap()` already answers "what in my
kitchen contributes to protein/carbs/fat/fibre" — ranked, expiry-tiebroken,
excluding anything whose nutrition or mass can't be measured. It's a
general-purpose "rank my stock by nutrient content" function that
`suggestionService.ts` currently only calls in one direction: reactively,
when a macro bar shows a shortfall.

That leaves the same question unaskable the other way round: "what do I
have that's high in iron," asked directly, with no shortfall on screen
prompting it. `MacroGapTarget` is `'protein' | 'carbs' | 'fat' | 'fibre'`
today, and `per100()`'s `'fibre'` branch hard-returns `null` with the
comment "not a pantry-suggestion target yet" — `add-micronutrient-tracking`
is what finally makes it one, by populating `canonical.fibrePer100`, and
the same change gives `assessMacroGap` seven more nutrients it has never
been able to rank by.

Competitor teardown: `competitor-analysis/cronometer/custom-foods/
foods-hub.md` and `CRONO-ADAPTATION-PLAN.md` item 3. Cronometer calls this
Oracle Nutrient Search — "search for foods high in specific nutrients to
meet your needs" — as a standalone tool, not gated behind an existing
displayed gap.

## What Changes

- **`MacroGapTarget` grows by up to eight entries** — one per nutrient
  `add-micronutrient-tracking` adds to `CanonicalItem` — and `per100()`'s
  existing `'fibre'` branch is fixed to read `canonical.fibrePer100` instead
  of hard-returning `null`, now that the field is actually populated.
- **A directed, pull-only entry point**, reachable without a currently
  displayed shortfall — the user picks a nutrient, the app ranks pantry
  stock against it using `assessMacroGap` directly.
- **No provider request, no suggestion engine, no cache.** This is
  explicitly *not* an extension of `suggestionService.ts`'s request-mode
  path — there is no "what should I cook" question here, no dish, no
  recipe, no cook-this action. It's a local, synchronous ranked list, the
  same computation `assessMacroGap` already performs, called directly
  instead of from inside a macro-gap suggestion request.
- **Coverage is reported honestly.** `hasUnmeasuredStock` and
  `hasMeasuredCoverage` already exist on `MacroGapAssessment` for exactly
  this — the surface says plainly when some pantry stock couldn't be
  measured for the chosen nutrient, the same discipline the existing
  macro-gap feature already applies.
- **Cronometer's Repeat Items (scheduled auto-logging) is explicitly not
  part of this proposal.** Left out on purpose: a scheduled log with no
  capture event behind it has no depletion signal, and Mise's whole model
  is that the meal log *is* the depletion signal. Recorded here so the
  omission reads as a decision, not an oversight.

## Capabilities

### New Capabilities

- `nutrient-directed-search`: Ranking in-stock pantry items by their
  contribution to a user-chosen nutrient, reusing the existing
  `assessMacroGap` primitive directly rather than through a suggestion
  request — pull-only, no provider call, honest about unmeasurable stock.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.
`macro-gap-suggestions` remains unarchived as a change; this proposal
extends its shipped `macroGap.ts` module directly.

## Non-goals

- **Repeat Items / scheduled auto-logging.** See What Changes — conflicts
  with the meal log being the depletion signal.
- **A provider-backed suggestion for the chosen nutrient.** No recipe, no
  "cook this," no dish scoring. Ranking existing stock only.
- **Nutrient *targets* for the eight new micronutrients.** This proposal
  ranks stock against a chosen nutrient; it does not add a Today-screen bar
  or a daily target for vitamin C, iron, and the rest. That's separate,
  unscoped work this proposal does not attempt.
- **Recipes or meals as ranked results.** Only pantry items, matching
  `assessMacroGap`'s existing scope exactly.
- **Any nutrient beyond what `CanonicalItem` exposes.** If
  `add-micronutrient-tracking` ships fewer than eight fields, or is
  reordered, this proposal ranks by whatever exists at the time it's
  implemented — it does not itself add nutrient data.

## Impact

**Schema.** None. This proposal adds no columns and no tables — it's a new
UI surface and a `MacroGapTarget` union extension over data
`add-micronutrient-tracking` already persists.

**Code.**
- `src/logic/macroGap.ts` — `MacroGapTarget` grows; `per100()` gains a case
  per new nutrient plus the fibre fix; `assessMacroGap` itself is
  unchanged, since it already operates generically over whatever
  `per100()` returns.
- A new screen or sheet — not `suggestionService.ts` — calling
  `assessMacroGap` directly with a user-selected target and the current
  pantry/canonical data.
- `src/types.ts` — no changes; this proposal reads fields
  `add-micronutrient-tracking` already adds.

**Dependencies.** `add-micronutrient-tracking` must ship first — this
proposal has nothing to rank by for seven of its eight target nutrients
without it, and its own fibre fix depends on that change populating
`fibrePer100`.

**Risk.** Low. `assessMacroGap` is shipped, tested code being called from
a new direction rather than modified in its core logic — the changes to it
are additive (`MacroGapTarget` cases), not structural.
