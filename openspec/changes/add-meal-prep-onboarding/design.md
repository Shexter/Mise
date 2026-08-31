## Context

The current first run assumes every person is setting an energy target. The
existing `Profile` data model requires personal body and activity fields, while
meal prep needs a different set of facts: what the person wants to do, the
tools they own, their confirmed pantry, and dietary preferences if supplied.

The visual exploration in `docs/ui-overhaul/` establishes the intended order:
choose goals, choose appliances, seed pantry, then receive a first prep plan.
It must become a real, conditional product flow rather than a four-screen
tutorial.

## Goals

- Give meal-prep users a useful first plan without requiring a calorie target.
- Make appliance ownership and pantry contents explicit, editable constraints.
- Preserve the existing calorie onboarding path for calorie-only users.
- Keep all local inventory changes reviewable and reversible.
- Provide a credible, useful plan without requiring an online model or API key.
- Make skipped meal-prep setup easy to resume later.

## Non-goals

- Replace the existing dinner-decision system with a meal-planning platform.
- Infer food quantities, dietary rules, appliance ownership, or cooking skill.
- Depend on future generated illustrations for a complete usable interface.
- Change voice, receipt, photo, or barcode capture semantics in this change.

## Proposed flow

### 1. Choose what Mise should help with

After welcome, present two large, independently togglable cards:

- **I want to track my calories** — a simple meter visual.
- **I want to meal prep** — a simple bowl visual.

The cards use clear selected and unselected states beyond colour alone. At least
one choice is required to continue. Both choices are valid.

The selected intents drive the route sequence:

| Selected intent | Required route sequence |
| --- | --- |
| Calories only | Existing profile and target flow, then the current completion result. |
| Meal prep only | Optional dietary preferences, appliances, starter pantry, first prep plan, then app entry. |
| Both | Existing profile and target flow, then appliances, starter pantry, first prep plan, then app entry. |

The calorie profile remains valid only when its existing required data is
provided. Meal-prep-only completion creates no placeholder nutrition profile.

### 2. Choose available cooking appliances

Meal-prep users select from a controlled appliance list, initially including
cooktop, oven, microwave, air fryer, rice cooker, slow cooker/pressure cooker,
and blender. Each option has a plain vector/icon, text label, and accessible
selected state.

The screen includes **No appliances / no-cook ideas** and **Skip for now**.
Skipping does not imply any appliance ownership. A later result can offer only
plans whose equipment requirements are satisfied; no-cook plans remain eligible
when nothing is selected.

### 3. Add a few ingredients already on hand

The first pantry screen makes starter entry feel finite. It offers common,
recognisable starting points such as chicken, rice, potatoes, vegetables, and
other proteins, alongside explicit actions to add manually or use an existing
capture route.

The temporary selection is a draft. Before persistence, the person reviews
each resolved item, its location, quantity where known, and any uncertainty.
The confirmation uses the same canonical matching and pantry insertion rules as
normal intake. Unknown quantity stays unknown; it is never converted to a
guessed amount.

Photo-captured pantry items retain their source image when the normal capture
contract supports it. The later visual-food-identity work may provide a
canonical illustration or category fallback, but this onboarding flow must not
wait for it.

### 4. Show a first meal-prep plan

The result is a `MealPrepPlan`, separate from the current cached dinner
`Suggestion` contract. It contains:

- title and portion count;
- confirmed pantry items it uses and explicitly missing items;
- required appliance IDs;
- estimated duration only when the chosen template has a known duration;
- ordered cooking-guide steps, each naming the appliance or no-cook action;
- actions to start the guide, choose another eligible idea, or defer it.

Eligibility is strict:

1. Required appliance IDs must be a subset of owned appliance IDs.
2. A plan may only claim to use pantry items that have been confirmed.
3. Missing ingredients remain visible and must not be silently substituted.
4. Dietary filters apply only when the person supplied them.

For first-run value without an API key, the initial recommendation comes from a
small deterministic local template catalogue. Each template declares its
ingredient and appliance requirements. A future provider-backed enrichment may
offer variants, but cannot alter these constraints or become a prerequisite for
completion.

Starting the guide navigates into an explicit cooking state. Completing it may
handoff to the existing recipe review/logging path, where meal logging remains a
separate deliberate action.

### 5. Skip and resume

Every meal-prep step provides a safe exit to app entry. The Pantry surface and
Settings must expose an understandable way to resume or edit cooking setup.
The completion state records whether the person completed, skipped, or deferred
the starter pantry and first plan. It must not repeatedly force the same
onboarding screens after app entry.

## Data model

Introduce a new forward-only migration; do not make the existing required
`Profile` fields nullable merely to support meal prep.

Add local cooking-setup persistence with the following conceptual records:

- `cooking_preferences`: a singleton with enabled intents and meal-prep
  onboarding state, including timestamps for completed or deferred setup.
- `owned_appliances`: controlled appliance ID rows with an explicit owned flag
  and update timestamp.

The implementation may refine table names to match existing conventions, but it
must preserve these properties:

- a meal-prep-only person can finish onboarding without a nutrition profile;
- appliance IDs come from a controlled local enum, not free text;
- all setup is local and editable;
- onboarding state can distinguish not started, deferred, and completed;
- migration is forward-only and includes migration tests.

`MealPrepPlan` is a domain type and transient recommendation result in the
first release. Do not persist it as a completed meal, recipe, or pantry change
until the person explicitly takes the corresponding action.

## Architecture and routing

The existing onboarding store needs an intent-aware draft and a route resolver.
It must calculate dynamic progress from the selected path rather than displaying
a misleading fixed step count. The results route must be split or refactored so
it can persist a valid calorie profile when present without blocking
meal-prep-only completion.

Recommended module boundaries:

- `src/types/`: controlled appliance IDs, onboarding intents, `MealPrepPlan`,
  local template contracts, and guide steps.
- `src/store/`: intent-aware onboarding draft and transient starter-pantry
  draft.
- `src/db/` and migrations: cooking preferences and appliance persistence.
- `src/logic/`: deterministic template matching, eligibility, and plan
  construction.
- `app/onboarding/`: conditional intent, appliance, pantry, and plan routes.
- `app/(tabs)/pantry` and Settings: resume and edit entry points.

Existing pantry writes remain behind the current canonical resolution and user
confirmation boundary. Existing `Suggestion` caching should not be repurposed
until a later change explicitly reconciles its dinner semantics with
`MealPrepPlan`.

## Visual and interaction direction

Use the active Market Instrument design system: warm paper surfaces, aubergine
ink, persimmon for primary action, and restrained green or blue functional
states. The onboarding cards are generous and image-led, but must remain
scannable, native, and practical rather than decorative.

Use basic vectors or system icons for the goal and appliance visuals now.
Food photos remain source photos when available. Canonical ingredient
illustrations and generated assets are explicitly deferred to
`add-visual-food-identity-system` after the native interface is accepted.

All selectable cards and controls require visible focus, labels, and state text
or iconography in addition to colour. Touch targets, text scaling, and screen
reader announcements are acceptance criteria, not polish work.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Meal-prep-only users become trapped behind a required `Profile`. | Persist cooking setup separately and refactor completion routing before UI work. |
| Suggested recipes imply equipment or ingredients the person does not have. | Use controlled template requirements and strict eligibility filtering. |
| First pantry entry becomes a long inventory audit. | Keep starter selection finite, let people skip, and link to normal intake for more. |
| Generated art delays or obscures functional decisions. | Use basic vectors now; defer the visual asset system. |
| Existing dinner suggestions are destabilised. | Introduce a separate `MealPrepPlan` contract and integrate later only through an accepted change. |

## Open questions to resolve during implementation planning

- Which current onboarding route owns the final app-entry decision when a valid
  calorie `Profile` is absent?
- Which small local template set best covers the first starter ingredients and
  appliance combinations without overstating nutritional certainty?
- Should dietary preferences stay in the current profile-only model or move to
  a separately persisted preference that meal-prep-only users can set?
