## Why

The dinner engine now has a real local candidate scorer, dietary exclusion,
daily cache, dedicated stretch planning, and a separate macro-gap flow. Its
normal "tonight" answer is still generic: it does not retain whether this
person values familiar food, time, protein-forward choices, lighter portions,
or maximum waste avoided. A single profile goal is too blunt to answer that
question every night.

Decision 33 says Mise is a dinner decision rather than a recipe browser.
Decisions 34 and 36 keep urgency and calories honest, and decision 40 limits
provider calls. This change gives the existing tonight mode a persistent,
explainable preference layer without weakening those rules or confusing it with
macro-gap and stretch planning.

## What Changes

- Add five fixed **base intents** for tonight: `balanced`, `use_it_up`,
  `protein_forward`, `lighter_portions`, and `familiar_favourites`.
- Add an optional **prep-speed modifier** (`standard` or `quick`) so a user can
  ask for a quick protein-forward dinner instead of having to choose between
  time and nutrition.
- Resolve a default base intent from the profile goal only when the person has
  not made an explicit preference. Persist an explicit choice locally, offer a
  visible reset to the profile recommendation, and never alter the profile or
  its energy targets.
- Apply the resolved intent and prep-speed only to `tonight`. `stretch` keeps
  its multi-dinner, no-shopping contract; `macro_gap` keeps macro-first ranking,
  targeted cache identity, and its no-template surface.
- Make the local scorer's weights and the provider prompt depend on a compact,
  typed intent policy. Unknown nutrition contributes no template-specific
  nutrition score and never causes a dish to be hidden.
- Keep hard dietary exclusion and the use-first constraint outside template
  ranking. Template effects can reorder, adjust a visible portion suggestion,
  and add a factual "why this" cue; they cannot make an ineligible dish appear.
- Persist cache rows per resolved base intent and prep-speed, and invalidate the
  disposable pre-template cache rows in a forward-only migration.
- Add a secondary, accessible "Tune dinner" control on the tonight surface.
  The recommended choice works with no interaction; tuning is optional and
  never appears in stretch or macro-gap flows.

## Capabilities

### New Capabilities

- `suggestion-templates`: Fixed, locally persisted tonight preferences that
  compose a base cooking intent with an optional prep-speed modifier, shape
  candidate generation and local selection, and remain explainable and safe.

### Modified Capabilities

- `dinner-decision`: Preserve distinct request modes while allowing the
  tonight mode to carry a resolved template context through generation,
  selection, caching, and presentation.

## Non-goals

- Diet plans, clinical nutrition advice, outcome claims, or changing calorie
  and macro targets.
- User-authored templates or arbitrary weights.
- Applying a template to stretch planning or macro-gap suggestions.
- Treating provider nutrition estimates as catalogue facts, or converting an
  unknown nutrient into zero.
- Relaxing dietary exclusions, use-first, or the current no-filter calorie
  rule.

## Impact

**Schema.** Append one migration for `suggestion_preferences`, template cache
identity, and disposal of old cache rows. `profile` is unchanged.

**Code.** Add pure policy and preference-resolution modules; extend
`src/logic/dishScore.ts`, `src/logic/suggestionService.ts`,
`src/api/suggestPrompt.ts`, `src/db/queries.ts`, and `src/types.ts`; add the
secondary control to `app/dinner.tsx` and reusable presentation components.

**Dependencies.** None. This refresh relies on the shipped dinner-decision and
macro-gap infrastructure, but does not treat their remaining real-provider
acceptance work as complete.
