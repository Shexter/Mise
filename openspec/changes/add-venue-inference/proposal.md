## Why

Every logged meal asks the user whether they cooked it, ate out, or are eating
leftovers. The control shipped with `add-stock-depletion` and currently defaults
to whatever was chosen last, which is right roughly as often as your habits are
consistent and wrong the moment they are not.

The app can do better than a sticky default, and it can do it for free. The
estimator already looks at the photograph. A restaurant table and a home kitchen
do not look alike — plating, background, cutlery, the presence of other diners'
dishes. Asking for a venue guess in the request that is already being made costs
nothing extra.

There are two local signals too, both already recorded and neither currently
read. A dish whose ingredients are all in the pantry was probably cooked from
them. And decision 10's servings multiplier means the app knows a batch made
four portions — so it knows how many are still outstanding, which is what
leftovers are.

The user still chooses. This only changes what is already selected when they
arrive, so that most of the time they change nothing.

## What Changes

- **The estimator returns a venue guess** alongside the meal. One field in the
  existing schema, in the existing request — no second call, no added latency.
- **Two local signals refine it.** The share of the meal's ingredients that
  match current stock, and whether an earlier batch of the same dish still has
  portions outstanding.
- **The guess arrives preselected, never applied silently.** The control is
  visible with the guess already chosen, and changing it is one tap.
- **Uncertainty leans toward home**, because the two mistakes are not equally
  costly (below).
- **Leftovers are offered when the app has reason to think so** — a batch logged
  recently with servings remaining — rather than being a thing the user has to
  remember exists.
- **A correction teaches the default** for that dish, so a dish you always eat
  out stops guessing home.

## Capabilities

### New Capabilities

- `venue-inference`: Guessing whether a logged meal was cooked at home, eaten
  out, or is leftovers. Covers the estimator's contribution, the local signals,
  how they combine, the bias under uncertainty, presenting the guess as a
  preselected default, and learning from corrections.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet. The venue
control and its effect on depletion already ship; this changes only what arrives
selected.

## Non-goals

- **Removing the control.** The user chooses. This changes the starting point,
  not the authority. A guess the user cannot override would be worse than no
  guess.
- **Applying a guess without showing it.** Decision 11 makes venue determine
  whether the pantry is debited, so a silent guess would move stock on an
  inference the user never saw.
- **Location or GPS.** Position would be a strong signal and a poor trade — it
  needs a permission the app has never asked for, against a privacy story
  (decision 5) that is one of its better properties. Not worth it for a default.
- **New venue values.** `home | out | leftovers` is unchanged; decision 51 made
  that a single closed field deliberately.
- **Inferring servings.** The multiplier stays a user figure.

## Impact

**Schema.** A small table recording a per-dish venue default learned from
corrections. No change to `meals`.

**Code.**
- `src/api/prompt.ts` and `src/api/parse.ts` — one optional field.
- `src/logic/venue.ts` — new, pure: combine the model's guess with the local
  signals into a preselection. Testable with no network.
- `src/db/queries.ts` — outstanding leftover portions, and the learned default.
- `app/review.tsx` — the control arrives preselected rather than sticky.

**Dependencies.** None added.

**Depends on** `add-stock-depletion` (merged) for the venue field, the servings
multiplier, and the consumption events that reveal outstanding portions.

## The mistakes are not symmetric, and that sets the bias

Guessing **out** when the meal was cooked at home means the pantry is not
debited. The app then believes you still have the soy sauce you just finished —
which is precisely the failure decision 3 exists to prevent, and the user
discovers it mid-cook.

Guessing **home** when the meal was eaten out means the pantry is debited for
food that never left it. Annoying, and self-correcting twice over: decision 55's
receipt re-anchor resets the amount on the next shop, and decision 53's drift
counter already softens what the app claims about an item decremented many times
without an anchor.

So an uncertain guess should lean home. The commoner case and the cheaper
mistake happen to agree, which is convenient but not the reason — the reason is
that a missed decrement breaks the core promise and a phantom one does not.
