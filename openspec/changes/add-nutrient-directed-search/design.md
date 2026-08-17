## Context

See `proposal.md` — Why. `src/logic/macroGap.ts` today:

```ts
export type MacroGapTarget = 'protein' | 'carbs' | 'fat' | 'fibre';

function per100(canonical: CanonicalItem, target: MacroGapTarget): number | null {
  switch (target) {
    case 'protein': return canonical.proteinPer100;
    case 'carbs': return canonical.carbsPer100;
    case 'fat': return canonical.fatPer100;
    case 'fibre': return null;
  }
}
```

`assessMacroGap(items, canonicals, target, today)` is already generic over
`target` — it calls `per100()`, computes `availableGrams()` from the pantry
item, multiplies, filters out anything unmeasurable, and sorts by
contribution with an expiry tiebreak inside a 10% comparability band.
Nothing about `assessMacroGap` itself assumes the target is a macro; it was
simply never given a target that wasn't one.

`suggestionService.ts` calls `assessMacroGap` from inside its `macro_gap`
request mode — after checking a shortfall exists, before building a
provider request. This proposal calls the same function from a new,
separate path that has no shortfall check and never reaches
`suggestionService.ts` at all.

## Goals / Non-Goals

**Goals:**

- Any nutrient `CanonicalItem` carries a per-100g value for becomes
  rankable, by extending `per100()`'s switch, not by touching
  `assessMacroGap`.
- A pull-only surface, no shortfall required, no provider call.
- Honest about unmeasured stock, using the assessment's existing fields.

**Non-Goals:**

- Repeat Items, provider-backed suggestions, new nutrient targets, recipe
  results. See the proposal.

## Decisions

### This is not an extension of the suggestion engine

The new entry point calls `assessMacroGap()` directly. It does not add a
new `RequestMode`, does not touch the suggestion cache, does not build a
provider request, and never reaches `suggestionService.ts`.

*Why:* `add-macro-gap-suggestions`'s design deliberately built one engine
covering `tonight`/`stretch`/`macro_gap`, each producing a *cooked
suggestion* — a dish, scored, with a cook-this action. Oracle Nutrient
Search isn't that question. It's "what do I have," not "what should I
make" — the same distinction the original design draws between the dinner
decision (clear stock) and the macro gap (close a nutrient shortfall):
here there's no dish at all, just a ranked list of raw pantry items. Routing
it through the suggestion engine would mean paying for a model call, a
cache row, and dietary filtering machinery built for a question this
feature doesn't ask.

### `MacroGapTarget` grows to cover whatever `CanonicalItem` exposes, generically

Rather than hand-writing eight new literal-per-100 lookups, `per100()`'s
switch gains one case per new field, following the exact pattern the
existing three macro cases already establish — a straight field read, no
new logic.

*Why fix the `'fibre'` case here specifically:* it currently hard-returns
`null` with a comment saying fibre isn't a pantry-suggestion target *yet*.
`add-micronutrient-tracking` is what makes that comment stop being true —
once `canonical.fibrePer100` is populated, leaving the switch case
returning `null` would silently keep fibre unrankable even though the data
now exists. Fixing it is a one-line change living in the same file this
proposal already touches for the same reason.

### The surface is a ranked list, not a scored suggestion

Results show contributor items, their measured contribution, and days
remaining — the same fields `MacroContributor` already carries. No score,
no "why this" explanation beyond what the ranking already implies (highest
measured contribution first, expiry breaking near-ties), no accept/reject
action.

*Why not reuse the suggestion card UI:* that component is built to present
one recommended dish with a cook-this action. This is a list of pantry
items, not a dish — reusing that component would mean stripping most of
what it does, which is a sign it's the wrong component rather than one
that needs adapting.

## Risks / Trade-offs

**A ranked list with mostly-unmeasured stock looks broken** → mitigated by
surfacing `hasUnmeasuredStock`/`hasMeasuredCoverage` plainly, the same
fields the macro-gap feature already exposes for the identical situation.

**Eight more `MacroGapTarget` cases is eight more places `per100()` can be
wrong** → each case is a one-line field read with no branching logic, kept
that way deliberately (see Decisions) specifically to keep this risk small.

## Migration Plan

None. No schema change — this proposal is a new UI surface and a type/
switch extension over already-persisted data.

## Open Questions

- **Where the entry point lives.** Foods/pantry surface is the natural
  home, matching Cronometer's placement, but the exact screen is an
  implementation decision left open here.
