<!--
Copy this file to <folder>/<feature-slug>.md, one per Cronometer feature.
Fill every section — an empty section reads as "not checked."
-->

# <Feature name>

**Screenshots:** `<folder>/<file1>.png, <file2>.png, ...>`
**Cronometer tier:** free / Gold-only / unclear from screenshot

## What it does

<Two or three sentences, product terms not UI terms. What the user
accomplishes, not which button they tapped.>

## UI pattern observed

<Layout, interaction model, states visible in the screenshot(s) — empty
state, error state, loading, edited/unsaved indicators. Note anything
inferred vs. actually visible.>

## Implied data model

<What fields/relationships this feature requires to exist, as best as can be
inferred from the screenshot. Flag anything that's a guess.>

## Gap-check against Mise

- **Already have:** <cite the existing spec/change/decision if yes>
- **Partially have:** <what's missing specifically>
- **Missing entirely:** <confirm nothing overlaps>
- **Conflicts with a non-negotiable or settled decision:** <cite
  `openspec/config.yaml` non-negotiables or the decision number from
  `docs/product-decisions.md` — this is an automatic reject, not a debate>

## Verdict

**Adopt / Adapt / Reject** — <one line why>

<If Adapt: what changes vs. Cronometer's version and why (e.g. "same idea,
but as a qualitative state, not a gram figure — decision 15").>

**Linked OpenSpec change:** `<add-x, or "none yet", or "n/a — rejected">`
