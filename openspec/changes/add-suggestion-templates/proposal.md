## Why

`add-macro-gap-suggestions` established that the suggestion engine takes an
objective, so that one engine, one prompt, and one cache serve more than one
question. It then defined exactly one objective beyond the default: close a
macro gap.

The objective the user actually has is usually bigger than tonight's protein
number. Someone cutting wants dinner to be protein-forward and filling for its
calories, every night, without saying so each time. Someone gaining wants the
opposite pressure. Someone on a Tuesday at seven o'clock wants twenty minutes.
And the app already knows the first of these — `Profile.goal` is
`lose | maintain | gain`, collected during onboarding, and currently used for
exactly one thing: a number in `energyTargets`.

Meanwhile the suggestion screen has a real risk the plan already names: a
generically-worded prompt produces stir fry, fried rice, and pasta bake forever
and the feature dies of boredom by the fourth day. What prevents that is a
constraint set. A stated objective is the strongest constraint available, and it
costs the user one tap.

## What Changes

- **Named templates** the user picks from: `use_it_up`, `lean`, `strength`,
  `balanced`, `quick`, `stretch`. Each is a *bundle of weights* over the scorer
  and a framing for the prompt — not a new engine, not a filter.
- **The template defaults from the profile.** A user whose goal is `lose` opens
  the screen on `lean` without ever choosing it.
- **Choosing a template for one dinner never edits the profile.** Tonight's
  choice is tonight's.
- **Templates change ranking and portion, never availability.** Decision 36
  survives intact: a dish over the remaining calories is offered as a smaller
  portion, not withheld.
- **The use-first constraint survives every template.** Decision 34 is not
  something a template may switch off.
- **`use_it_up` is a template**, and the most native one — the objective the
  product was built around, made selectable rather than implicit.
- **`quick` uses `effort_minutes`**, which the output contract already carries
  and nothing currently reads.
- **`stretch` is where "make it to Sunday" lives**, so the planning mode becomes
  a template rather than a separate mode with its own surface.
- **Reason chips follow the template**, so the screen says why a dish is there
  *in the terms the user asked for*.

## Capabilities

### New Capabilities

- `suggestion-templates`: Named objectives for the suggestion engine. Covers the
  template set, defaulting from the profile without editing it, how a template
  expresses itself as weights and portions rather than filters, the constraints
  no template may override, per-template caching, and the language templates are
  allowed to use about themselves.

### Modified Capabilities

- `dinner-decision`: the objective the engine already accepts becomes one of a
  named set, and reason chips are drawn from the active template.

## Non-goals

- **Diet plans.** A template shapes what gets suggested for one meal. It is not
  a programme, a schedule, a week of meals, or anything the user is meant to
  adhere to.
- **Health or outcome claims.** `lean` does not cause fat loss and the app must
  not suggest it does. See below — this is the constraint that shapes the copy.
- **Macro or calorie targets per template.** The profile owns targets. A
  template shapes *tonight's dinner*, and letting it quietly move a target would
  make a one-off choice permanent.
- **Filtering by template.** Every template ranks. None excludes. The one thing
  that excludes is dietary rules, which are not a template.
- **A template editor.** A fixed, small, curated set. A user who can build
  arbitrary objectives will build a bad one and blame the suggestions.
- **Stacking templates.** One at a time. See the open question — this is a real
  limitation and it is chosen, not overlooked.
- **New model calls.** Same engine, same prompt module, same cache, per the
  requirement `add-macro-gap-suggestions` already set.

## Impact

**Schema.** One migration: the selected template on the suggestion cache key,
and a remembered last choice. `profile` is not touched.

**Code.**
- `src/logic/templates.ts` — new, pure: the template table, its weights, its
  portion policy, and the default from a profile goal. No network, no database.
- `src/logic/suggest.ts` — scoring reads weights from the active template
  instead of constants.
- `src/api/suggestPrompt.ts` — the template's framing sentence.
- `src/db/queries.ts` — cache key gains the template.
- The dinner decision surface — a template control.

**Dependencies.** None added.

**Depends on** `add-dinner-decision` (planned, unimplemented) for the engine and
scorer, and `add-macro-gap-suggestions` (planned) for the objective parameter.
This change should land after both. **Interacts with** `add-dietary-profile`:
dietary rules exclude and templates rank, and they compose in that order.

## A template is a bias, not a promise

`lean` and `strength` are the two names that could get this wrong.

The app can honestly say what a template *does*: prefer dishes with more protein
for their calories, size portions against what is left in the day, put filling
food first. It cannot say what a template *achieves*, because that depends on
everything the user eats, not on three dinner ideas, and the app is a diary with
a suggestion screen rather than anything clinical.

So the templates are named for the eating pattern, and every place a template
describes itself describes the bias — "leans protein-forward and portions
against your remaining calories" — never the outcome. This follows decision 64's
refusal to make a health claim about a default target, and it is the reason
`lean` is not called *fat loss* in the interface even though that is what the
user asking for it would call it.

## Why templates cannot switch off the use-first constraint

Decision 34 requires every suggestion to use at least one item bucketed
`use_first`. It is the difference between this feature and a recipe chatbot.

A template that could relax it would be relaxed immediately — `strength` wants
the chicken thighs and the rice, not the coriander wilting in the drawer — and
the feature would quietly become a generic recipe generator with a nutrition
filter, which is the thing decision 33 rejected and which any free chatbot does
better.

So the constraint holds under every template, and a template that cannot be
served within it returns fewer suggestions and says so, rather than returning
suggestions that ignore the kitchen. `use_it_up` exists precisely so that a user
who wants the constraint to be the *whole* objective can say so.
