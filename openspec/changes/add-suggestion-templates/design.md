## Context

See `proposal.md` for motivation. The current engine has three intentionally
different request modes: `tonight`, `stretch`, and `macro_gap`.
`src/logic/suggestionService.ts` owns stock loading, cache reuse, provider
generation, dietary filtering, and the cook-this route. `src/logic/dishScore.ts`
locally selects a varied displayed set from a provider candidate pool. The
macro-gap mode additionally carries a targeted macro and nullable nutrition
context; it must remain macro-first. `app/dinner.tsx` already exposes tonight
and stretch as a segmented control and enters macro-gap from the macro bars.

`suggestion_cache` is currently keyed by date, mode, and target macro. Cache
data is disposable. `Profile.goal` is a durable nutritional preference; it must
not be used as a write target for a one-evening dinner preference.

## Goals / Non-Goals

**Goals:**

- Make the tonight answer meaningfully personal with no mandatory new decision.
- Let time compose with the user's dinner intent without multiplying screens or
  creating a second suggestion engine.
- Make selection explainable, testable, locally safe, and cache-correct.
- Preserve explicit unknown nutrition as `null` end-to-end.

**Non-Goals:**

- Changing the semantics, UI, prompt contract, or cache identity of stretch and
  macro-gap requests.
- A nutrition coach, a weekly meal plan, user-authored scoring, or a clinical
  outcome claim.

## Decisions

### Modes and preference context are separate layers

`SuggestionMode` remains the job being requested:

| Mode | Job | Template context |
| --- | --- | --- |
| `tonight` | Pick a few dinners for now | Required after resolution |
| `stretch` | Produce a no-shopping multi-dinner plan | Not applicable |
| `macro_gap` | Contribute to a selected macro shortfall | Not applicable |

Only a `tonight` request receives:

```
TonightPreference = {
  baseIntent: 'balanced' | 'use_it_up' | 'protein_forward' |
              'lighter_portions' | 'familiar_favourites',
  prepSpeed: 'standard' | 'quick',
  source: 'saved' | 'profile_default'
}
```

This prevents a macro request from silently becoming a protein-template request
and prevents a multi-dinner plan from inheriting a one-night preference. The
alternative — folding stretch and macro-gap into a single objective enum — was
rejected because they have distinct payloads, output shapes, cache semantics,
and user entry points.

### A base intent and prep-speed compose, but only two controlled axes

The base intent answers *what trade-off matters tonight*:

| Base intent | Selection bias | Copy boundary |
| --- | --- | --- |
| `balanced` | Retains the existing neutral balance | "A balanced starting point" |
| `use_it_up` | Raises value-at-risk and expiry pressure | "Puts what needs using first" |
| `protein_forward` | Prefers available, labelled protein evidence | "Leans toward protein-forward ideas" |
| `lighter_portions` | Prefers calorie fit and a smaller visible portion | "Sizes portions against today" |
| `familiar_favourites` | Raises history and cuisine familiarity | "Leans toward what you cook" |

`quick` is not a competing base intent. It is the `prepSpeed` modifier that
raises the effort term and adds a short provider instruction. This lets a user
choose, for example, protein-forward + quick without accepting unlimited,
unexplainable combinations. There are no other stacking controls.

### Policies are pure, data-driven, and conservative about unknowns

`src/logic/suggestionTemplates.ts` will export a closed policy table and
helpers. Each base policy contains named score-weight multipliers, a portion
policy, prompt framing, accessible label/description, and a reason policy. The
speed policy supplies only the effort multiplier and prompt framing. No scorer
branch tests an id; it reads the resolved policy.

The existing dish facts remain shared: value at risk, expiry pressure, effort,
calorie fit, familiarity, recency, and disliked-ingredient penalty. A
template-specific nutrition term is allowed only where the existing suggestion
contains a labelled whole-dish estimate. Missing nutrition supplies a neutral
term, never a zero, penalty, or exclusion. The macro-gap local assessment
remains the sole macro-first eligibility calculation.

### Defaults are recommendations; explicit choices win until reset

`defaultBaseIntent(goal)` maps `lose` to `lighter_portions`, `gain` to
`protein_forward`, and `maintain` to `balanced`. A durable explicit choice is
stored in a one-row local `suggestion_preferences` table with the selected base
intent and prep speed. On resolution, that explicit choice wins; otherwise the
profile maps to a recommendation and `standard` prep speed.

Changing the profile goal updates the displayed recommendation but does not
overwrite an explicit choice. "Use recommended" clears the stored selection.
This is intentional: profile edits are long-term, while an explicit dinner
preference should not vanish as a side effect. Neither path writes `profile`.

### Selection, portions, and reasons use a strict precedence order

1. Provider prompt and local validation enforce dietary and canonical-id rules.
2. Local dietary exclusion removes hard exclusions.
3. The existing use-first constraint is checked; any candidate that misses it
   remains excluded, independently of policy weights.
4. The policy scores the surviving pool and the variety selector chooses the
   displayed set.
5. A visible portion recommendation is derived only from known calories and
   remaining allowance. It never hides a dish; unavailable data yields no
   recommendation.
6. A locally generated explanatory cue is shown only if its condition is
   defensible (for example, an effort value under the quick threshold). Existing
   stock and dietary reason chips are retained.

This preserves decisions 34 and 36. It also makes the feature auditable: a
policy can change order but cannot reach a hard gate.

### Prompt and cache use the resolved context, not label text

The provider sees a short, factual base-intent sentence and optional speed
sentence only for `tonight`; raw UI copy is not interpolated into the prompt.
The cache stores enum values `template_id` and `prep_speed`. Query, deletion,
and index predicates use all of `(local_date, mode, target_macro,
template_id, prep_speed)`. Non-tonight rows store both new columns as `NULL`.

The migration appends to `MIGRATIONS`, creates `suggestion_preferences`, adds
the two nullable cache columns and index, and clears existing cache rows. A
cache is a performance artifact, so clearing it is safer than assigning old
generic rows a potentially misleading preference identity. `DROP_ALL` already
covers `suggestion_cache`; it must be extended for the new preferences table.

### The surface is progressive, not a configuration screen

The existing mode control remains. Tonight displays the resolved concise summary
and a secondary “Tune dinner” affordance. Its sheet contains base-intent cards,
a two-option prep-speed control, short non-outcome descriptions, and “Use
recommended.” It announces selection changes accessibly and reloads through the
cache-aware service. The sheet is absent in stretch and macro-gap modes.

## Risks / Trade-offs

**More controls can create decision fatigue** → the recommended context works
without interaction; tuning is collapsed and has only two axes.

**Provider candidates may not contain enough nutrition evidence** → missing
evidence is neutral; it does not fabricate a nutrition ranking claim.

**Cache combinations increase provider cost** → cache exact combinations,
surface cache origin, and measure distinct combinations in owner testing before
changing the policy set.

**A saved preference can become stale after a goal edit** → show the current
recommendation and provide an explicit reset rather than silently replacing the
person's choice.

**Policy tuning can create repetitive results** → use the existing varied
selection mechanism and fixture tests that assert both meaningful ordering and
variety across intents.

## Migration Plan

1. Append the migration and cover old/new database upgrade tests.
2. Ship with a profile-derived recommendation when no preference exists.
3. Delete old cache rows during migration; regeneration remains demand-driven.
4. Roll back by ignoring preference context and using the existing neutral
   scorer. Persisted preferences and cache columns are harmless forward data.

## Open Questions

None. The initial policy weights and quick threshold are named tunables covered
by fixture and owner-app evaluation; changing them does not alter this approach.
