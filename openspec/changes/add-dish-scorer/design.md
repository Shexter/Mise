## Context

See `proposal.md` — Why, the over-generation argument, and why constraints run
before scoring.

What ships today: `src/api/suggestPrompt.ts:32` asks for *exactly three*
suggestions. `Suggestion` in `src/types.ts` carries `effortMinutes`, which
nothing reads. `parseSuggestResponse` in `src/api/suggest.ts` drops candidates
twice — invented canonical id, and missing the `use_first` bucket (decision 136)
— and reports `droppedForConstraint`. `src/logic/suggest.ts` exports `urgency`,
`bucketStock`, `shapeStockPayload`, `summarisePersonalisation` and
`computeFingerprint`, all of which act on *stock*. Nothing sorts dishes.
`src/logic/__fixtures__/kitchens.ts` is 566 lines of fixture kitchens.

## Goals / Non-Goals

**Goals:**

- Three suggestions are the best three of ten rather than the only three.
- Why a dish appeared is answerable from one file.
- The weights are measured, and the measurement is repeatable.

**Non-Goals:**

- Recomputing nutrition, replacing the model's dish invention, new
  personalisation signals, a learned scorer, stretch-mode set selection,
  templates. See the proposal.

## Decisions

### Over-generation is the change; the scorer is the consequence

Pool of ten, display three. Both named constants.

*Why this is the load-bearing decision:* a scorer over three candidates cannot
exclude anything, because three is the number shown. Ranking without exclusion
only chooses which of the same three is on top. Every benefit claimed for a
scorer — variety, constraint headroom, weighting that changes what you see —
requires candidates that lose.

*Why ten:* enough that the two existing drops plus dietary exclusion rarely
exhaust it, small enough that the output stays within a comfortable response.
It is a named constant and the tasks measure whether it is right.

*Why the cost is acceptable:* one request per day per mode already, per decision
40's caching. Ten candidates instead of three is more output tokens on a request
that was being made anyway — not more requests. The user's key pays once.

### The scorer is pure, and the constraints are not part of it

`src/logic/dishScore.ts`:

```
scoreDish(suggestion, context): number
selectDisplayed(pool, context, count): Suggestion[]
```

Constraints filter the pool upstream, in `parseSuggestResponse` where they
already live.

*Why absolutes must not be weights:* a very large weight is an absolute that
works until two large weights meet. Then something forbidden ranks first because
the arithmetic said so, and the failure is silent and arithmetic rather than
logical. Decision 34's constraint and an allergen exclusion are not preferences
that can lose a close contest, and modelling them as if they were is how a
safety-adjacent guarantee becomes a tuning parameter.

*What that leaves the scorer:* choosing among acceptable options, which is
genuinely a preference problem and correctly a weighted sum.

### What it scores

Six terms, all from facts already computed or already returned:

| Term | Source |
|---|---|
| value at risk cleared | `urgency` over the `uses` that are in stock |
| expiry pressure | days left on the most urgent item used |
| effort | `effortMinutes`, finally read |
| calorie fit | stated `kcalPerServing` against the day's remainder |
| familiarity | `summarisePersonalisation`'s cuisine lean and repeats |
| recency penalty | the same function's recently-eaten window |

*Why nothing new:* every one of these is already computed for the payload or
already returned by the model. A scorer whose first act is to invent new signals
is two changes wearing one name, and the new signals would be unmeasured while
the scorer was being blamed.

*Why `effortMinutes` matters more than it looks:* `docs/dinner-decision.md`
already says a tired Tuesday and a free Sunday are different questions. The
field has been in the contract since the beginning and has never been read,
which means the model has been estimating it into a void.

### Variety is a selection rule, not a weight

Select greedily: take the top scorer, then take the highest-scoring candidate
sufficiently unlike everything already selected.

*Why not a diversity weight:* a weight makes similarity a property of a dish,
and it is not — it is a property of a *pair*. A dish is only repetitive relative
to what else is being shown, so the comparison has to happen during selection.

*Why greedy:* three from ten. Anything cleverer is unmeasurable at this size and
harder to explain when a user asks why something appeared.

*How similarity is judged:* the ingredients two dishes share, and their cuisine
lean from `CUISINE_KEYWORDS` which already exists. Not dish-name similarity —
"chicken stir fry" and "pork stir fry" are different dinners with a similar
name, and "fried rice" and "chāhan" are the same dinner without one.

*The floor:* variety never empties the set. If every candidate is alike, three
alike candidates are shown, because showing one dinner idea is worse than showing
three similar ones.

### The pool is cached, so re-ranking is free

The cache holds the pool; the displayed set is derived.

*Why:* it makes selection cheap to change. Recording an allergy, correcting a
dislike, or later switching template re-selects from candidates already paid
for, with no request. Decision 40 caches to avoid spending money on a tab open;
caching the pool extends that to every change that affects only selection.

*Consequence worth naming:* a cached pool can outlive the stock state that
produced it. `computeFingerprint` already exists to detect that, and selection
must respect it rather than re-ranking a stale pool.

### Weights are evidenced against the fixture kitchens

`src/logic/__fixtures__/kitchens.ts` already holds the kitchens. The pools do
not exist and have to be authored.

*Why this is the deliverable:* decision 149 refused to let a scorer arrive
"untuned, unmeasured, and justified by a single weight". A weights table with no
measurement behind it is exactly that, wearing this change's name instead.

*What measurement means here:* for each fixture kitchen, an authored pool and a
recorded resulting order, asserted in a test. A weight change that reorders a
fixture fails the build — the same protection decision 32's confidence bands
have.

## Risks / Trade-offs

**Ten candidates degrade individual quality** → a model asked for ten ideas may
put less into each than one asked for three. Real, and measurable against the
fixtures rather than assumable. Mitigation: the pool size is a constant, and if
quality drops the honest answer is a smaller pool and a weaker scorer.

**The scorer becomes the thing everyone tunes** → a weighted sum invites endless
adjustment, and every adjustment is unfalsifiable without evidence. Mitigation:
fixture-asserted ordering makes a change visible, and the weights live in one
file rather than being spread through the service.

**Explaining a rank is harder than explaining a filter** → the reason chips
already answer "why is this here"; they do not answer "why is this first".
Accepted. The chips remain the explanation, and the scorer is not exposed.

**Over-generation makes a bad prompt worse** → ten mediocre ideas instead of
three. Mitigation: this is the same risk `add-dinner-decision` already names as
its central one, and over-generation is what gives selection anything to work
with. If the pool is uniformly poor the problem is the prompt.

**Stale pools** → mitigated by the existing fingerprint, and named as a
requirement rather than left to the implementation.

## Migration Plan

One forward-only migration widening the suggestion cache to hold the pool
alongside the displayed set. Additive; an existing cached row without a pool is
treated as a pool equal to its displayed set, which degrades to today's
behaviour rather than breaking.

`DROP_ALL` needs no change if the cache table is already covered — confirm.

Rollback is a pool size equal to the displayed count, which reduces the scorer
to a reorder of three and changes nothing else.

## Open Questions

- **The pool size.** Ten is a guess. The tasks measure quality-per-candidate and
  constraint headroom, and the answer may differ between the nightly mode and
  stretch mode.
- **Whether stretch mode should over-generate too.** It selects a covering set
  rather than a ranked list, which is a different problem this change explicitly
  does not solve. It may still benefit from a pool.
- **Whether the scorer should ever surface its reasoning.** "First because it
  clears the most value" is a good sentence and a slippery one — it invites
  arguing with the ranking. The reason chips may already be enough.
