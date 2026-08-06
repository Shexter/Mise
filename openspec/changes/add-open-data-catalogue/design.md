## Context

See `proposal.md` — Why, plus its two closing sections: why a range must not be
flattened, and why numbers from a food safety dataset are not safety advice.

What ships today: `assets/canonical-items.json` holds 69 hand-authored entries.
`CanonicalItem` in `src/types.ts` carries
`shelfLifeDays: Partial<Record<StorageLocation, number>>` and
`openLifeDays: number | null`. `predictExpiry` in `src/logic/expiry.ts` adds one
of those to a date and — correctly — returns `null` where there is no figure,
because "no data means no claim, not a guess". `bucketFor` in
`src/logic/suggest.ts` turns days remaining into `use_first | use_soon |
available`.

What the sources give:

- **FoodKeeper** (USDA FSIS, public domain): 500+ foods with
  `Pantry_Min/Max/Metric`, `Refrigerate_Min/Max/Metric`,
  `Freeze_Min/Max/Metric`, after-opening and after-thawing variants. Metrics are
  Days, Weeks, Months, *When Ripe*, *Indefinitely*, *Not Recommended*.
- **FoodData Central** (USDA, CC0): 600,000+ foods with full nutrient panels,
  behind a free data.gov API key.

## Goals / Non-Goals

**Goals:**

- The numbers behind every expiry prediction are attributable to something
  better than a guess.
- Regenerating the catalogue is safe to do repeatedly.
- Nothing about this makes the app claim more than it knows.

**Non-Goals:**

- Runtime lookups, Open Food Facts, replacing hand-authored entries, safety
  guidance, regional shelf life, nutrition overriding a photograph. See the
  proposal.

## Decisions

### The pipeline is a build script, and the app never sees a dataset

`scripts/build-catalogue.ts`, run by a developer, output committed.

*Why not runtime:* three independent reasons, any one sufficient. Decision 5 is
local-first and the expiry path must work on a plane. FoodData Central requires
a data.gov API key, and shipping one inside an APK is precisely what the project
already refuses to do with vision keys — with the added indignity that this one
would be ours rather than the user's. And a runtime lookup makes the app's
predictions depend on a third party's uptime for a number that changes roughly
never.

*Why committed rather than generated at packaging time:* the diff is the review.
A dataset refresh that moves 200 shelf lives should be looked at by a person, and
the only way to guarantee that is for the artefact to be in the repository.

### A range maps onto the buckets that already exist

Upper bound → `shelfLifeDays`, and therefore the predicted expiry and
`use_first`. Lower bound → a new `earlyWarningDays`, which opens `use_soon`.

*Why not flatten:* argued in full in the proposal. The short version is that
taking the minimum makes decision 34 systematically cry wolf, and taking the
maximum abandons decision 3's warning while the food is still rescuable.

*Why the buckets rather than a new display concept:* the app already says two
different things about urgency, and a range already means two different things.
Making them the same two things costs nothing and adds no vocabulary. It also
means the change is invisible for the 69 existing single-figure entries, whose
`earlyWarningDays` is simply absent.

*What `use_soon` means afterwards:* it stops being "a fixed number of days before
expiry" and becomes "the source thinks quality may start going". That is a
better definition and it is the one the reason chips can defend.

### A term is not a number

*Indefinitely*, *When Ripe*, and *Not Recommended* are not durations, and each
would be corrupted differently by a numeric coercion. Indefinite as a large
number produces an expiry date the app would then display. Not Recommended as
zero produces an item that is expired the moment it is created, which would put
salt in `use_first` forever.

All three produce **no figure**, which `predictExpiry` already handles — it
returns null and the app makes no claim. The existing code is right; the
pipeline must not undermine it.

### Provenance is per field, not per row

`sources: Partial<Record<field, SourceId>>` on the canonical.

*Why per field:* a single ingredient will legitimately mix origins — FoodKeeper
knows how long chicken keeps in a freezer and knows nothing about how much
gochujang a person uses in one go. A row-level source would force a choice
between them and would relabel hand-tuned figures as dataset-derived the moment
one field was filled.

*Why it must exist at all:* decision 66 says confidence travels with the fact.
This is the same principle at build time — and it is what makes a refresh a
mechanical operation rather than a merge conflict with a human.

### A refresh fills gaps, keeps hand-authored values, and never deletes

Three rules, in that order. A conflict between a dataset and a hand-authored
figure is **reported and not applied**.

*Why deletion must be impossible:* the measured facts are stark. The OFF
ingredient taxonomy carries 4,733 entries and has zero for gochujang, hoisin,
doenjang, and oyster sauce; FoodKeeper is a US supermarket dataset and will be
no better. Decision 4 makes those entries the differentiator. A pipeline that
treated absence from a dataset as a reason to drop or blank a row would delete
the product's reason to exist, in a commit that looked like a data refresh.

*Why conflicts are reported rather than auto-resolved either way:* auto-keeping
hides that the guess was wrong; auto-taking discards deliberate tuning. A list of
twenty differences is a five-minute job for a person and the only outcome that
learns anything.

### Dataset rows reach ingredients through `resolve()`

`source: 'dataset'`, confident matches applied, uncertain ones reported.

*Why the existing matcher:* it is the same problem the app already solved —
arbitrary food text onto a canonical identity — and a second matcher here would
drift from the one users' data goes through, which is how a build script starts
producing a catalogue that behaves differently from the app that reads it.

*Why uncertain matches are not applied even at build time:* a wrong match writes
chicken's shelf life onto chicken liver, and nothing downstream would ever
detect it. Build time is exactly where a human is cheapest.

### Nutrition is a fallback, never an override

A photograph of the actual plate outranks a table figure for the ingredient.

*Why:* the table says what 100 g of raw chicken thigh contains. The photograph
was taken of a thing that was cooked in oil, and the estimator was asked about
that. The table is better than nothing, which is what manual entry currently has,
and worse than a look at the food.

*Missing nutrition is unknown, not zero* — the same discipline
`add-fibre-tracking` argued for, and for the same reason.

## Risks / Trade-offs

**A refresh silently degrades the catalogue** → the largest risk, and the reason
three of the requirements are about refresh behaviour rather than about data.
Mitigation: never delete, never overwrite, report conflicts, and the diff is
committed so a bad run is visible and revertible.

**FoodKeeper is US-centric** → its storage assumptions reflect US homes,
appliances, and retail practice. Accepted rather than solved: it is better than
the guesses it replaces, and the limitation is recorded in the ledger rather than
discovered later.

**Safety framing leaks in** → the source is a food safety publication and the
vocabulary is contagious. Mitigation is the same machinery as decisions 108 and
129: a copy audit plus a test asserting the forbidden words appear nowhere.

**`use_soon` changes meaning for existing users** → items that were `available`
may become `use_soon` after a catalogue bump. Mitigation: it is the less urgent
bucket, decision 34's hard constraint reads `use_first` only, and the change
makes the bucket more meaningful rather than noisier.

**Nutrition tempts a bigger feature** → a per-ingredient nutrient table invites
recipe-level nutrition analysis. Out of scope, stated, and the fallback-only rule
is what keeps it from creeping.

## Migration Plan

One forward-only migration adding per-field provenance, `earlyWarningDays`, and
nutrition columns to canonical ingredients. Additive; existing rows keep their
values and get provenance of hand-authored.

The catalogue version bump carries the regenerated asset through the existing
seed path, the same way new canonicals already arrive.

`DROP_ALL` needs no change if canonicals are already covered — confirm rather
than assume.

Rollback is the previous asset and the previous version number. Nothing in the
app depends on a field the migration adds being populated.

## Open Questions

- **How many FoodKeeper rows actually match the catalogue.** Sixty-nine entries
  against 500+ US supermarket product names, matched by a trigram scorer. The
  hit rate is measurable and unmeasured, and if it is low the honest response is
  that this change is worth less than it looks — which the tasks are written to
  discover rather than hide.
- **Whether the after-thawing figures are worth modelling.** FoodKeeper
  distinguishes refrigerated-after-thawing from refrigerated. The app has no
  concept of a thawed item, and inventing one for this would be the dataset
  driving the product.
- **Whether nutrition belongs in this change at all.** It shares the pipeline,
  the provenance model, and the licence posture, which is the argument for. It
  is also a second dataset and a second surface, which is the argument against.
  Split it if the tasks grow past what one review can hold.
