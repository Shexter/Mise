## Why

Decision 149 found that the app has no dish scorer. `src/logic/suggest.ts` ranks
*stock items* to shape the payload; nothing sorts the dishes that come back. The
model returns three suggestions and the app renders them in the order they
arrived.

Two planned features assumed otherwise and had to be rewritten around its
absence. `add-dietary-profile` wanted a dislike weight; `add-suggestion-templates`
was designed as "a weight vector over the existing scorer". Decision 149 refused
to let either build it, on the grounds that the app's most consequential ranking
surface should not arrive as a side effect of a preferences feature, untuned and
justified by a single weight.

This is that change, with its own evidence.

## The thing that makes it worth building

`src/api/suggestPrompt.ts:32` says *"In 'tonight' mode, return exactly three
suggestions."*

A scorer that reorders three items is theatre. Three is already the number shown,
so ranking them changes which one is at the top and nothing else — no dish is
ever included or excluded by the scoring, which is the only thing ranking is for.

The change that makes a scorer meaningful is asking for **more candidates than
are shown** and choosing locally. Ten returned, three displayed, and the seven
that lose are the scorer's actual output.

That reframes several things at once:

- Decision 40 already caches daily, so the extra output tokens are paid once a
  day, on one request that was being made anyway.
- `add-dinner-decision`'s stated central risk — *"a generically-worded prompt
  produces stir fry, fried rice, and pasta bake forever and the feature dies of
  boredom by the fourth day"* — is a selection problem. With three candidates
  there is nothing to select from; with ten there is.
- Decision 136's use-first check and `add-dietary-profile`'s exclusion both
  *drop* suggestions, and dropping from three leaves one. Dropping from ten
  leaves plenty, so the constraints stop competing with having anything to show.
- Templates and dislikes get something real to weight.

## What Changes

- **The engine asks for a candidate pool**, not a final answer. A named
  constant, larger than the number displayed.
- **A pure local scorer ranks the pool** and the top N are shown.
- **The scorer ranks facts the app already holds**: value at risk cleared,
  expiry urgency, effort, calorie and macro fit, familiarity, and recency.
- **`effortMinutes` finally gets read.** It has been in the contract and in
  `Suggestion` since `add-dinner-decision` and nothing consumes it.
- **Diversity is enforced over the pool**, so three suggestions are three
  different ideas rather than three stir-fries.
- **Drops happen before scoring**, so the constraints choose what is eligible and
  the scorer chooses among the eligible.
- **Every weight is a named constant measured against the fixture kitchens**, and
  the measurement is the deliverable as much as the code.

## Capabilities

### New Capabilities

- `dish-scorer`: Ranking generated dish suggestions locally. Covers
  over-generation, the facts scored and their weights, diversity, the order
  constraints and scoring run in, what the scorer may and may not do to a
  suggestion, and how the weights are evidenced.

### Modified Capabilities

- `dinner-decision`: the engine returns a pool rather than a final set, and the
  displayed order becomes the app's rather than the model's.

## Non-goals

- **Scoring nutrition beyond what a suggestion states.** The scorer reads the
  figures the model returned; it does not recompute them.
- **Replacing the model's judgement about what is a good dish.** It proposes;
  the scorer chooses among proposals. A scorer cannot invent a dish the model
  did not think of, and over-generation is the only lever on that.
- **Personalisation beyond the existing history signals.** `summarisePersonalisation`
  already computes cuisine lean, repeats, and recency. This reads them; it does
  not add new ones.
- **A learned or adaptive scorer.** Fixed weights, tuned by measurement, legible
  in one file. A scorer that learns from taps would be unexplainable exactly
  when a user asks why a dish appeared.
- **Scoring for the stretch mode's set-selection problem.** "Make it to Sunday"
  picks a *set* that covers a period, which is a different problem — covering,
  not ranking. Named because it will look like it belongs here.
- **Templates.** `add-suggestion-templates` supplies weights to this scorer once
  both exist. This change ships one default weighting.

## Impact

**Schema.** One migration widening the suggestion cache to hold the pool and the
scores, so a cached day can be re-ranked without regenerating.

**Code.**
- `src/logic/dishScore.ts` — new, pure. The scorer and its weights.
- `src/api/suggestPrompt.ts` — asks for a pool.
- `src/api/suggest.ts` — parses a pool; the existing drops run before scoring.
- `src/logic/suggestionService.ts` — score, diversify, take the top N.
- `src/db/queries.ts` — cache the pool.

**Dependencies.** None added.

**Depends on** `add-dinner-decision` (merged). **Unblocks**
`add-suggestion-templates`, whose decision 124 can then be true rather than
corrected. **Interacts with** `add-dietary-profile`: exclusion drops from the
pool, dislikes become a weight here instead of the local reorder that change
settles for.

## Why the constraints run before the scorer, not as weights

Decision 34's use-first requirement and `add-dietary-profile`'s allergen
exclusion are both absolute. Neither is a preference that can lose a contest.

Expressing an absolute as a very large weight is the classic mistake: it works
until two large weights meet, and then something forbidden ranks first because
the arithmetic said so. Keeping them as a filter over the pool, run first, means
no weight can ever outrank them — the scorer only ever sees suggestions that are
already allowed.

It also keeps the scorer honest about what it is for. It is choosing between
acceptable options, which is a preference problem. Deciding what is acceptable is
not.
