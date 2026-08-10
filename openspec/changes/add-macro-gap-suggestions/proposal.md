## Why

The Today screen already shows the gap. `PROTEIN 67.6 / 195 g` is a problem
stated plainly, and the app currently does nothing about it — the user is left
to work out what in their kitchen closes 127 grams of protein.

That is a smaller and more answerable question than "what should I cook
tonight", and it arrives at a different moment. The dinner decision is asked
once, in the evening, about a meal. This is asked whenever a bar looks wrong,
and the answer is often not a meal at all — 127 g of protein short at 11pm is
answered by yoghurt and eggs, not by a curry.

Implements decision 36's observation that the macro gap is the better signal,
and turns it into an entry point rather than a hint passed to another feature.

## What Changes

- **The macro bars become the entry point.** Tapping a bar asks for a suggestion
  that closes *that* gap from what is in the kitchen. The gap is already on
  screen; this makes it actionable where it is stated.
- **A macro-gap request through the shipped suggestion engine.** It extends the
  existing tonight/stretch request flow, reusing its stock payload, dietary
  filtering, cache, candidate validation, dish scoring, and cook-this path.
  **It must not build a second engine.**
- **Suggestions are scaled to the gap and the hour.** A snack, an addition to a
  planned meal, or a whole meal — chosen from how large the gap is and what time
  it is, not fixed at "a meal".
- **Recipe nutrition is hybrid.** Known canonical nutrition and quantities are
  calculated locally. The same suggestion request may provide an explicitly
  labelled whole-dish estimate for any remainder; accepting a suggestion makes
  no second provider request. If neither source can defend a nutrient, the
  logged meal preserves it as unknown rather than storing zero.
- **Expiry becomes a tiebreak, not the objective.** Among foods that close the
  gap, prefer the ones about to go off. The dinner decision inverts this, and
  the inversion is the point of having two objectives.
- **An unclosable gap is said plainly.** Where the kitchen cannot close it, the
  system says so rather than offering something that closes a fifth of it and
  letting the framing imply success.
- **Nothing is pushed.** The bar is tappable; no prompt, no notification, no
  badge. A gap exists most days and an app that says so most days is nagging.

## Capabilities

### New Capabilities

- `macro-gap-suggestions`: Turning a visible macro shortfall into a suggestion
  drawn from the kitchen. Covers the entry point, scaling the answer to the gap
  and the hour, ranking foods by their contribution to the deficient macro,
  expiry as a tiebreak, honest reporting of an unclosable gap, and the pull-only
  rule.

### Modified Capabilities

- `dinner-decision`: the shipped engine accepts an isolated macro-gap request
  while preserving its current tonight and stretch behaviour.

## Non-goals

- **A second suggestion engine.** The payload, prompt discipline, model call,
  cache, and cook-this path are `add-dinner-decision`'s. This adds an objective.
- **Nutrition advice.** The app suggests food that contains a macro; it does not
  say the user should eat more of it, and it makes no health claim (decision 64).
- **Automatic prompting.** See the pull-only rule above.
- **Closing calorie gaps.** "You have 800 calories left" is not a problem
  needing solving; the dinner decision already treats calories as context.
- **Supplements.** Food from the kitchen only.

## Impact

**Schema.** Forward-only migrations isolate persisted macro-gap cache rows and
allow meal nutrient fields to be null when a cooked suggestion has an
unresolved recipe-level value.

**Code.**
- `src/logic/suggest.ts` — macro-nutrition eligibility and gap-first ranking.
- `src/logic/suggestionService.ts` — a macro-gap request through the shipped
  cache, dietary, scoring, and cook-this seams.
- `src/api/suggestPrompt.ts` — a macro-gap instruction block.
- `src/api/suggest.ts` — parses a labelled recipe-level nutrition estimate.
- `src/components/MacroBars.tsx` — bars become pressable.
- `app/(tabs)/index.tsx` — routing from a bar to the suggestion surface.

**Dependencies.** None added.

**Depends on** the shipped dinner-decision engine. It initially supports
protein, carbohydrate, and fat. Fibre is deferred until `add-fibre-tracking`
ships. Catalogue nutrition is nullable; a suggestion may only claim a macro
contribution that current per-100 g data can defend.

**Risk.** The failure here is a suggestion that is technically responsive and
practically useless — "eat 400 g of chicken" to close a protein gap is arithmetic,
not help. What makes it useful is the same constraint set as the dinner decision
plus the scale-to-the-hour rule, and the tasks treat that as measurable against
fixtures rather than a matter of prompt taste.

## A note on sequencing

`add-dinner-decision` is shipped. This change extends its established request
and caching seams while preserving today’s tonight and stretch behaviour.
