## Why

The app is about to start telling people what to eat. `add-dinner-decision`
generates dinners from stock, `add-macro-gap-suggestions` proposes food to close
a macro gap, and both send a payload to a model and render whatever comes back.

Neither has any notion of what the user cannot eat.

There is nothing to have a notion *with*. `Profile` holds sex, age, height,
weight, activity, goal, and a macro split — nothing about allergies,
restrictions, or dislikes, and no table anywhere records them. A vegetarian gets
suggested pork belly because it is the thing expiring soonest, and decision 35's
value-at-risk weighting makes that *more* likely, not less: the expensive meat
they bought for a guest is exactly what the ranker pushes hardest.

That is the ordinary case. The one that matters is the person with a peanut
allergy opening a suggestion built out of their own pantry.

The app cannot make food safe and this change does not pretend to. What it can
do is stop putting an ingredient in front of someone who told it not to, and be
straight about the difference.

## What Changes

- **Three kinds of rule, kept apart**: allergens, restrictions, dislikes. They
  look like one list and behave like three. Collapsing them is the mistake this
  change exists to avoid — see below.
- **Exclusion is enforced locally, after the model returns.** The prompt is told
  as well, but the prompt is a request and the filter is the guarantee. A model
  is not a safety mechanism.
- **Rules resolve to canonical identities**, so avoiding milk also avoids
  butter, ghee, paneer, and condensed milk, which a string match on "milk" does
  not.
- **A derivative relation on canonical ingredients**, seeded for the common
  allergen families. Without it "avoid milk" is a word filter.
- **Unknown resolves to excluded**, for allergens only. An ingredient the app
  cannot identify is unknown, not absent.
- **Dislikes down-rank, they do not filter.** Filtering on "not keen on
  mushrooms" empties the pool and hides a dish where they would have been fine.
- **Logging is never filtered.** If the user eats it, the app records it. A
  tracker that argues with reality is broken.
- **Honest language.** The app says what it did — "nothing suggested contains
  peanut" — never what it cannot know, which is whether the food is safe.
- **Asked during onboarding, skippable, editable in settings.** Someone with a
  serious allergy should not have to find a settings screen to be asked.

## Capabilities

### New Capabilities

- `dietary-profile`: What the user cannot or will not eat, and what the app does
  about it. Covers the three kinds of rule and why they are separate, resolving
  a rule to canonical identity, the derivative relation, how exclusion is
  applied to generated suggestions, the treatment of unknown ingredients,
  dislikes as ranking, the guarantee that logging is never filtered, and the
  language the app is allowed to use about all of it.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.
`add-dinner-decision` and `add-macro-gap-suggestions` are both still unmerged
plans, and their tasks pick this up rather than being retrofitted.

## Non-goals

- **Claiming food is safe.** The app never says safe, suitable, or free-from. It
  reports what it filtered. Anything stronger is a promise it cannot keep about
  a recipe it did not test, from a model it does not control, cooked in a kitchen
  it cannot see.
- **Allergen data from packaging.** `add-barcode-capture` will bring back
  allergen fields from Open Food Facts for some products. Reading them is a
  later change and a different guarantee — that data is crowd-sourced, patchy,
  and jurisdiction-specific.
- **Medical advice, or diagnosis.** The user states their rules. The app does
  not infer them, suggest them, or question them.
- **Nutrition-based restriction.** Low-sodium, low-FODMAP, renal diets — these
  need per-ingredient nutrient data the app does not hold. Naming them as
  restrictions it cannot enforce would be worse than not offering them.
- **Household members.** Decision 6 cut sharing. One profile, one person.
  Cooking for a guest is real and handled by a later change, not by pretending
  the profile is plural.
- **Blocking a pantry item.** The user may buy, store, and cook things they do
  not eat. The pantry is a record of the kitchen, not of the diet.

## Impact

**Schema.** One migration: a rules table, and a derivative relation between
canonical ingredients. Both additive. No change to `profile`.

**Code.**
- `src/logic/dietary.ts` — new, pure: expand a rule set to an excluded canonical
  set, and apply it to a suggestion. No network, no database.
- `src/db/queries.ts` — rule CRUD, and the closure over derivatives.
- `assets/canonical-items.json` — derivative links for the common allergen
  families.
- `src/api/suggestPrompt.ts` — the rules stated in the prompt, as a request.
- `app/(tabs)/settings.tsx` and `app/onboarding/` — entry and editing.

**Dependencies.** None added.

**Depends on** `add-identity-layer` (merged) for canonical identity and
`resolve()`. **Depended on by** `add-dinner-decision` and
`add-macro-gap-suggestions`, both of which should land after it rather than
generate unfiltered suggestions first.

## Why three kinds and not one list

They differ in what a mistake costs, and a single list forces one policy onto
three problems.

**An allergen** is a safety matter. The cost of including one is measured in
hospital visits, so uncertainty must exclude, the match must cover derivatives,
and the filter must run locally rather than being asked of a model.

**A restriction** — vegetarian, halal, no pork, no alcohol — is a rule the user
holds and the app has no business softening. Breaking one is a real harm and not
a medical one. It filters hard, like an allergen, but the app may state it
plainly because the user is the authority on their own rule.

**A dislike** is a preference. Filtering on it is the wrong response: someone who
does not care for coriander has not asked to never be shown a dish that includes
a little. It should lose a ranking contest, not be deleted from one — and with
three suggestions in front of the user (decision 33), deleting from the pool is
expensive.

One list would have to pick a policy. Whichever it picked would be wrong twice.

## Unknown is not absent

The mirror of `add-venue-inference`'s bias, and worth stating in the same terms.

When a suggestion names an ingredient the app cannot resolve to a canonical, it
has two options: assume it is fine, or assume it is not.

For an allergen, assuming it is fine means the one case this change exists for
fails exactly when identification is hardest — an unfamiliar ingredient, a
regional name, a transliteration. Decision 4 makes Asian coverage the
differentiator, which means unresolved names are not a rare edge here; they are
the audience.

So an unresolved ingredient in a suggestion, for a user with allergens recorded,
excludes the suggestion. The cost is a suggestion lost, and there are others.
For restrictions and dislikes the same rule would be needless attrition, so
unknown passes and only allergens carry the strict reading.
