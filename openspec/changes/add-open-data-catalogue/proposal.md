## Why

Every expiry prediction in the app comes out of `assets/canonical-items.json`,
and every number in that file was guessed. Sixty-nine items, hand-authored,
carrying `shelfLifeDays` per location and `openLifeDays` — and `predictExpiry`
does nothing but add one of those to a date. Decision 19 made expiry a lookup
rather than a model precisely so it would be defensible. The lookup table is the
part nobody has defended.

Meanwhile the USDA publishes FoodKeeper: storage timelines for 500+ foods,
maintained by the food safety agency, in a schema that maps onto ours almost
field for field.

```
Pantry_Min/Max/Metric       →  shelfLifeDays.pantry
Refrigerate_Min/Max/Metric  →  shelfLifeDays.fridge
Freeze_Min/Max/Metric       →  shelfLifeDays.freezer
"after opening" fields      →  openLifeDays
```

That is not a coincidence worth ignoring. It is the authoritative version of a
table we invented, and it is public domain — US federal work, no attribution
obligation, no share-alike, nothing to negotiate.

The same argument applies a second time to nutrition. FoodData Central publishes
600,000+ foods under CC0. Today a calorie figure for an ingredient can only come
from a model looking at a photograph, which means manual entry has no numbers at
all and a generated dinner suggestion's calories are a guess inside a guess.

## What Changes

- **A build-time enrichment pipeline** producing `assets/canonical-items.json`
  from open datasets plus the hand-authored entries. A script and a reviewed
  diff, not a runtime call.
- **FoodKeeper supplies shelf life.** Its ranges are mapped onto the two buckets
  the app already has rather than flattened to one number — see below.
- **FoodData Central supplies per-ingredient nutrition**, so an ingredient has
  calories and macros without a photograph.
- **Every field records where it came from.** A hand-authored figure is never
  silently overwritten by a dataset refresh.
- **Asian entries are protected explicitly.** Neither dataset has gochujang,
  doenjang, hoisin, or oyster sauce; a refresh must not treat their absence as a
  reason to drop or blank them.
- **The app makes no safety claim.** FoodKeeper is a food safety publication.
  What the app shows is a quality estimate, and the wording says so.
- **CC0 and public-domain sources only** in this change. Nothing here is
  encumbered, which is why it can start immediately.

## Capabilities

### New Capabilities

- `open-data-catalogue`: Building the canonical catalogue from open datasets.
  Covers the build-time boundary, mapping FoodKeeper ranges onto shelf life and
  the urgency buckets, per-field provenance, protecting hand-authored entries
  across refreshes, nutrition from FoodData Central, and the language the app
  may use about numbers that came from a food safety dataset.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Runtime lookups against either dataset.** Decision 5 is local-first, and
  FoodData Central needs an API key that would have to be shipped inside the
  APK — which is exactly the thing the project already refuses to do with vision
  keys. Build-time or not at all.
- **Open Food Facts.** ODbL carries share-alike, and whether a shipped seed
  derived from it is a derivative database is an unanswered question.
  Deliberately excluded so this change is unblocked; `add-off-taxonomy-seed`
  holds that work behind the licence answer.
- **Replacing the hand-authored catalogue.** These datasets enrich it. The
  entries that make this app worth using are the ones they do not have.
- **Safety guidance.** The app is not telling anyone whether food is safe to
  eat. See below.
- **Per-user or per-region shelf life.** FoodKeeper reflects US practice and
  assumptions. One table for everyone, with the limitation recorded rather than
  papered over.
- **Nutrition overriding a photograph.** A vision estimate of the actual plate
  beats a table figure for a generic ingredient, and stays authoritative.

## Impact

**Schema.** One migration adding per-field provenance to canonical ingredients,
and nutrition columns. Additive. A catalogue version bump carries the new data
through the existing seed path.

**Code.**
- `scripts/build-catalogue.ts` — new. Runs on a developer machine, not in the
  app. Fetches, maps, matches, and writes the asset.
- `assets/canonical-items.json` — regenerated, with provenance.
- `src/logic/expiry.ts` — reads the early-warning figure as well as the expiry
  figure.
- `src/logic/suggest.ts` — bucketing uses both.
- `src/types.ts` — `CanonicalItem` gains provenance and nutrition.
- `src/db/queries.ts` and `src/logic/canonicals.ts` — seed load.

**Dependencies.** None added to the app. The build script may use whatever it
likes; it does not ship.

**Depends on** `add-identity-layer` (merged) for `resolve()`, which is how a
FoodKeeper row finds its canonical ingredient.

## A range is information, and flattening it throws the information away

FoodKeeper gives a minimum and a maximum — "3 to 5 days" — plus a metric that
can be Days, Weeks, Months, *When Ripe*, *Indefinitely*, or *Not Recommended*.
The app stores one number per location. Picking one end is the obvious move and
it is wrong in both directions:

**Take the minimum** and the `use_first` bucket fills with food that is
perfectly good. Decision 34 then *forces* every suggestion to be built around
one of those items, so the engine spends its whole output chasing false
urgency, and "clears the pork belly (2 days)" becomes a claim the user can check
and disbelieve. Crying wolf does not degrade the feature gracefully; decision 34
makes it systematic.

**Take the maximum** and the app fails to warn while food is still worth
rescuing, which is the one job decision 3 gave it.

The app already has two urgency buckets. Use them: the **maximum** sets the
predicted expiry date and therefore `use_first`, and the **minimum** opens
`use_soon`. That is what a range actually means — start thinking at the low end,
act at the high end — and it needs no new display concept, no new bucket, and no
invented midpoint.

## Numbers from a food safety dataset are not safety advice

FoodKeeper exists to help people avoid foodborne illness. This app is a pantry
tracker with a suggestion screen.

The distance between those two things has to be visible in the wording. What the
app can honestly say is that quality is expected to hold for about so long, and
that the figure came from a published table. What it must never say — and what
the source's provenance will tempt someone into saying — is that food is safe,
unsafe, or safe until a date. It does not know how the food was handled, how
long it sat in a car, or whether the fridge runs warm.

This is the same refusal as decision 64 on health claims, decision 108 on
dietary language, and decision 129 on template names, and it is enforced the
same way: a copy audit and a test asserting the forbidden words appear in no
expiry string.
