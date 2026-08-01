## Context

See `proposal.md` — Why, and its two closing sections: why three kinds rather
than one list, and why unknown is not absent.

What ships today: `Profile` in `src/types.ts` holds sex, age, height, weight,
activity level, goal, target calories, a macro split, units, and an onboarding
timestamp. Nothing else. `grep -ri 'allerg\|dietary\|vegetarian\|halal' src/`
returns nothing. There is no dietary model at any layer.

What is coming: `add-dinner-decision` sends stock to a model and renders three
dinners; `add-macro-gap-suggestions` proposes food to close a gap. Both are
planned, neither is merged, and both currently generate without any notion of
what the user cannot eat.

## Goals / Non-Goals

**Goals:**

- A user who records an allergen never sees it in a generated suggestion,
  including under a name they did not use.
- The guarantee holds without trusting the model.
- A user who records nothing sees no change anywhere.
- The app's language never outruns what it actually did.

**Non-Goals:**

- Safety claims, packaging allergen data, medical advice, nutrient-based
  restriction, household members, blocking pantry items. See the proposal.

## Decisions

### Rules live in their own table, not on `profile`

`dietary_rules`: id, kind, canonical_id (nullable), text, normalised text,
created_at. `profile` is a single row of scalars, written whole by
`saveProfile`, and recalculated by `profileStore.update` on every edit.

*Why not extend `Profile`:* rules are a list of rows with their own lifecycle —
added one at a time, edited, deleted — and `profileStore.update` recomputes
`targetCalories` through `energyTargets` on every write. Editing an allergy
should not run the BMR calculation, and a list does not belong in a row of
scalars.

### Kind is the discriminator, and it is stored, not inferred

Three values: `allergen | restriction | dislike`. A `readonly` array in
`src/types.ts` alongside `MEAL_VENUES`, per the existing convention.

*Why stored rather than inferred:* the app cannot tell an allergy from a
preference by looking at the ingredient. "No pork" is a restriction for one
person and a dislike for another; "shellfish" is a dislike for many and an
emergency for a few. Only the user knows, so only the user says. Inferring it
would be guessing about the one thing that must not be guessed.

### The derivative relation is a table, seeded from the catalogue

`canonical_derivatives(parent_id, child_id)`, seeded from the same
`assets/canonical-items.json` build path that already seeds canonicals.

*Why a relation rather than allergen groups:* an allergen group table would
answer "does this contain milk" and nothing else. The parent/child relation is
the general fact — butter is derived from milk — and it is reusable. A
restriction against dairy reads the same edges. So will substitution, when it
comes.

*Why transitive closure at read time rather than a stored closure:* the graph is
tiny and shallow. Computing the closure in a recursive query on a set of a few
hundred edges costs nothing, and a stored closure would need maintaining every
time the catalogue grows, which is a class of bug for no measurable gain.

*What it is seeded with:* the common allergen families — milk, egg, wheat, soy,
peanut, tree nut, fish, shellfish, sesame — plus the derivatives already in the
catalogue under decision 4's Asian coverage, where the edges matter most and are
least obvious. Fish sauce derives from fish; oyster sauce from shellfish; hoisin
and gochujang from soy and wheat. A Western-only seed would miss exactly the
ingredients this app claims to be good at.

### Exclusion is a local pass over the returned suggestion

`src/logic/dietary.ts`, pure:

```
expandRules(rules, derivatives): ExclusionSet
applyDietary(suggestion, exclusionSet): DietaryVerdict
```

The prompt also states the rules. That is a request, and it will usually work.
It is not the mechanism.

*Why not trust the prompt:* a suggestion engine that relies on a model to
enforce an allergy has made a safety-adjacent guarantee out of a probabilistic
system, over a network, from a provider the user chose in Settings and may swap
tomorrow. Decision 66 already says confidence travels with the fact; this is the
same instinct taken to its end — where the cost of being wrong is not a wrong
number but a hospital visit, the check is local and deterministic or it is not a
check.

*Why after generation rather than instead of it:* generating without the rules
would waste the model's ability to produce something the user can actually eat.
Both: ask, then verify.

### Unknown excludes, for allergens only

See the proposal. Stated here so the asymmetry is not read as an oversight: this
is the same shape of argument as `add-venue-inference`'s lean toward home, run
the other way because the costs are the other way round. There, uncertainty
resolves to the *action* because a missed decrement is worse than a phantom one.
Here, uncertainty resolves to *inaction* because a missed exclusion is worse than
a lost suggestion.

Scoping it to allergens is what keeps it affordable. Applying it to dislikes
would mean an unresolved ingredient costs a suggestion for a user who merely
does not care for coriander, which is attrition with no payoff.

### Dislikes are a ranking term in the existing scorer

A negative weight in `add-dinner-decision`'s urgency scoring rather than a
separate filter stage.

*Why:* decision 33 puts three suggestions in front of the user. Removing
candidates from a pool that small collapses it, and decision 34's use-first
constraint has already narrowed it once. A dislike should lose a close contest,
not win an argument with an expiring ingredient.

*Interaction worth naming:* a strongly-weighted dislike and a high value at risk
will sometimes disagree, and value at risk should sometimes win — a dish using
the mushrooms that expire tomorrow is a reasonable thing to offer someone who is
lukewarm on mushrooms. Which is the whole reason it is a weight.

### Rules resolve through `resolve()`, with a text fallback

Free-text entry goes through the existing matcher with `source: 'dietary'`.
Resolved rules store `canonical_id`. Unresolved rules keep normalised text and
match by name.

*Why not require resolution:* refusing to record an allergy the catalogue does
not know is the worst possible failure — it happens most for the least common
allergens and the least Western ingredients, and it happens at the moment the
user is telling the app the most important thing they will ever tell it. Take
the rule, apply it more weakly, and say so.

*Why the fallback is weaker and must be labelled:* a name match has no
derivatives and no aliases. Someone who types an ingredient the catalogue lacks
gets a literal match and nothing more. The interface says which rules resolved,
because a user who can see that their rule did not resolve can add a second one.

### Nothing about this reaches the log

Logging stays untouched: no filter, no warning that blocks, no confirmation step.

*Why:* the app's core promise is a record of what was eaten. A tracker that
makes it harder to record a meal because it disapproves is broken as a tracker,
and the user already knows — they were there. A note is the ceiling.

## Risks / Trade-offs

**The app looks more capable than it is** → the single largest risk here, and it
is a language problem rather than a code one. Mitigation is a spec requirement
rather than a guideline: never *safe*, never *free from*, only what was
excluded. Reviewed as copy, tested as strings.

**The derivative seed is incomplete** → it will be. Mitigation: seed the common
families deliberately, test the coverage against a fixture list of derivative
names, and record the gaps in the ledger rather than discovering them in use.

**Exclusion silently empties the suggestion list** → a vegetarian with a pantry
of expiring meat gets nothing and no explanation. Mitigation: the short-list
requirement — show what survived, say rules were applied, never pad.

**A model names an ingredient obliquely** → "seafood stock", "mixed nuts". The
canonical matcher is the same one the whole app depends on, so this is not a new
weakness, but it is a load-bearing one here. Mitigation: unknown excludes, which
converts a matching failure into a lost suggestion.

**Rules make the prompt long enough to degrade suggestions** → a user with
fifteen rules pushes the constraint set past what the model handles well.
Mitigation: measure with a heavily-restricted fixture profile; the local filter
holds regardless of what the prompt does.

## Migration Plan

One forward-only migration: `dietary_rules`, and `canonical_derivatives` with
its seed. Both additive, no existing table altered. `DROP_ALL` gains both.

Existing users have no rules, and no rules means no dietary behaviour anywhere —
so the migration changes nothing for anyone who does not use it.

The catalogue seed follows the existing canonical seeding path, so a catalogue
version bump carries new edges the same way it carries new canonicals.

## Open Questions

- **The dislike weight.** Needs a real figure from real suggestions. Named
  constant, no interface change.
- **Whether a restriction should imply a set of allergen-style edges.**
  Vegetarian is not a single ingredient; it is a predicate over many. Modelled
  here as a rule resolving to a set of canonicals, which works, but the seed for
  "vegetarian" is a judgement call with genuine edge cases — gelatine, rennet,
  fish sauce, lard in pastry. Worth doing properly and worth doing visibly, so
  the user can see the set and edit it.
- **Cooking for someone else.** Real, common, and out of scope. A per-suggestion
  "ignore my rules this once" is the cheap version; a guest profile is the
  honest one. Neither belongs in this change.
