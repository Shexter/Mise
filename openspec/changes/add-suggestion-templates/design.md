## Context

See `proposal.md` — Why, plus its two closing sections: why a template is a bias
rather than a promise, and why no template may switch off the use-first
constraint.

What exists today: `Profile.goal` is `'lose' | 'maintain' | 'gain'`, collected at
onboarding, read by `energyTargets` in `src/logic/bmr.ts` and nowhere else.
`docs/dinner-decision.md`'s output contract already carries `effort_minutes` and
notes that it is "worth a quick/proper toggle on the screen" — nothing reads it.
`add-macro-gap-suggestions` established that the engine takes an objective and
that the cache is keyed by it.

What does not exist: `src/logic/suggest.ts`, `src/api/suggestPrompt.ts`, and the
dinner decision surface are all planned and unimplemented. This change specifies
their shape rather than retrofitting them.

## Goals / Non-Goals

**Goals:**

- The user states their objective once, or never, and gets suggestions shaped by
  it.
- Adding a template is a table entry, not a feature.
- Nothing about templates weakens the constraints that make the feature more
  than a chatbot.

**Non-Goals:**

- Diet plans, outcome claims, per-template targets, filtering, a template
  editor, stacking, new model calls. See the proposal.

## Decisions

### The template set

Six, chosen to cover distinct questions rather than to be comprehensive:

| Template | The question it answers |
|---|---|
| `use_it_up` | What clears the most food that is about to go off? |
| `lean` | What is filling and protein-forward for its calories? |
| `strength` | What gets the most protein in, calories welcome? |
| `balanced` | What should I cook? (the neutral default) |
| `quick` | What can I make in twenty minutes? |
| `stretch` | What gets me to Sunday without shopping? |

*Why these six:* each changes the answer for the same kitchen. A seventh that
reorders nothing is a label, and labels that do nothing are how a picker becomes
noise.

*Why `use_it_up` is on the list at all,* given that every template must already
use expiring stock: the constraint says *at least one* item. `use_it_up` makes
clearing the maximum value at risk the whole objective rather than a floor. It is
the product's native question, and having it selectable is what lets the other
templates be honestly about something else.

*Why `quick` sits alongside the nutrition ones* despite being a different axis:
because it is the question people actually have on a Tuesday, and because
`effort_minutes` is already in the output contract. Mixing axes in one picker is
the cost, and it is the open question below.

*Why `stretch` moves here:* `add-dinner-decision` planned "make it to Sunday" as
its own mode. It is an objective over the same engine, which is exactly what a
template is. One surface, one control, one less concept.

### The scorer this change was written against does not exist

Corrected after `add-dinner-decision` shipped. `src/logic/suggest.ts` exports
`urgency`, `bucketStock`, `shapeStockPayload`, `summarisePersonalisation` and
`computeFingerprint`. Every one of those ranks or shapes **stock items** for the
payload. Nothing sorts the returned dishes — the model's order is the order the
user sees.

So "a template is a weight vector over the existing scorer" describes a scorer
that was never built, and decision 124 is wrong as recorded. What is actually
available to a template is three levers, all real:

- **Payload shaping** — which stock reaches the model, in what detail, and with
  what summary. `shapeStockPayload` already makes these choices and they are
  where `use_it_up` and `stretch` genuinely live.
- **Prompt framing** — one sentence of objective, which is what `lean`,
  `strength` and `quick` mostly are.
- **Portion policy** — post-parse, local, and the correct home for the calorie
  dimension for the reason argued below.

That is a weaker mechanism than a weight vector and it is honest. Whether this
change should also build the missing dish scorer is a real question and a much
larger one; it should not be answered as a side effect of adding templates, for
the same reason `add-dietary-profile` declined to build it to hold one dislike
weight.

### A template is a weight vector, not a code path

`src/logic/templates.ts`, pure:

```
TEMPLATES: Record<TemplateId, Template>
Template = { weights, portionPolicy, framing, reasonKinds }
defaultTemplate(goal): TemplateId
```

The scorer reads weights from the active template. It does not branch on which
one is active.

*Why:* a template that can run its own logic will, and six code paths through the
ranker is six places for the use-first constraint to be forgotten. A weight
vector cannot forget a constraint, because the constraint is not in the weights.

*Why the facts are shared:* every template weights the same inputs — urgency,
value at risk, familiarity, effort, macro fit. A template that introduced a
private input would make its results incomparable and its bugs unreproducible
under any other template.

### Portion is how a template expresses calories

Decision 36 says calories inform and never filter, and `add-dinner-decision`
already specifies that an overshooting dish is offered at a smaller portion.
`lean` and `strength` push on *that* dial: `lean` sizes toward the remaining
allowance, `strength` sizes up and allows the overshoot.

*Why this rather than a calorie weight:* weighting dishes by calories would
quietly become the filter decision 36 rejected — a low enough weight on a high
enough calorie count is exclusion with extra steps. Portion keeps every dish
reachable and puts the adjustment where the user can see and change it.

### The default comes from `goal`, and the choice never writes back

`defaultTemplate(goal)`: `lose → lean`, `gain → strength`, `maintain →
balanced`.

*Why default from it:* the user already answered this question at onboarding.
Asking again is asking twice, and the whole argument for templates is that the
objective should be stated once or never.

*Why the choice must not write back:* picking `strength` for one dinner because
there is a lot of chicken to use is not a decision to gain weight, and
`profileStore.update` recalculates `targetCalories` through `energyTargets` on
every write. A per-meal choice silently moving the user's calorie target would be
a serious and invisible bug — the two concepts touch at exactly one point and
must not touch anywhere else.

*Why the last choice is remembered anyway:* remembering a selection is not the
same as editing a profile. It lives with the suggestion state.

### Templates rank; dietary rules exclude; the order is fixed

Exclusion runs first, ranking second.

*Why stated explicitly:* the two features both "affect which suggestions appear"
and it would be easy to implement them as one pass. They are not the same kind
of thing — decision 103 makes exclusion a local, deterministic guarantee, and a
template is a preference. Running them together risks a weight ever being able to
outrank an exclusion, which must never happen.

### The cache key gains the template

`add-macro-gap-suggestions` already requires that a cached set is not reused
across objectives. Templates make the objective a small enumerated value, so the
key is a column rather than a hash of a payload.

*Cost, stated plainly:* decision 40 caches daily to avoid spending money on every
tab open. Six templates means up to six generations a day for a user who tries
them all. Mitigation is that the default is right for most people and the picker
is not the primary control — but this is a real cost and the tasks measure it
rather than assuming.

## Risks / Trade-offs

**A picker turns a one-tap screen into a decision** → the thing this feature
exists to remove. Mitigation: the default is correct without input, the control
is secondary to the suggestions, and no template is required to be chosen.

**Named templates read as health advice** → `lean` and `strength` especially.
Mitigation is a spec requirement and a copy audit, following decision 108's
approach for dietary language: describe the bias, never the outcome, and test the
strings.

**Six templates multiply the cost of a day's suggestions** → measured, not
assumed. If it is bad, the fix is a shared payload with a cheaper re-rank, which
the weight-vector design already allows.

**`quick` and the nutrition templates are different axes** → a user wanting a
quick high-protein dinner cannot say so. Real, chosen, and the open question.

**A template makes the suggestions worse** → a strong weight on one fact
produces monotonous results, which is the failure `add-dinner-decision` already
names. Mitigation: the weights are tuned against the fixture corpus that change
already requires, and per-template variety is measured.

## Migration Plan

One forward-only migration: the template on the suggestion cache key, and the
remembered last choice. `profile` is untouched, so no existing row changes and
every existing user gets a correct default from the goal they already recorded.

`DROP_ALL` gains nothing new if the cache table is already covered; confirm
rather than assume.

Rollback is to the single implicit objective, which is `balanced`.

## Open Questions

- **Whether `quick` should be a separate toggle rather than a template.** It is
  orthogonal to the nutrition templates, and one active template means a user
  cannot ask for quick *and* protein-forward. A second control is more
  expressive and is one more thing on a screen whose whole point is to answer a
  question rather than ask one. Deliberately deferred until there is a real
  screen to judge it on.
- **Whether `stretch` belongs in the same picker.** It answers a weekly question
  from a screen that answers a nightly one. Same engine, different cadence.
- **The weight values.** Every one is a named constant tuned against the fixture
  corpus, and none of them changes an interface.
