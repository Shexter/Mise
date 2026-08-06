## Why

The catalogue has 69 ingredients. The Open Food Facts ingredient taxonomy has
4,733, with in-script translations, and it is the single largest thing available
that would move this app forward.

Measured directly from `taxonomies/food/ingredients.txt` (2.6 MB, 97,752 lines):

| | |
|---|---|
| canonical entries | 4,733 |
| Japanese translations | 944 |
| Chinese translations | 783 |
| Korean translations | 606 |

Where it has an ingredient, the quality is exactly what is wanted. Soy sauce
carries `ja: 醤油, しょうゆ` and `ko: 간장` — in script, unromanised, which is
decision 31's rule arrived at independently.

And where it does not, it really does not:

| Ingredient | Entries |
|---|---|
| gochujang, 고추장 | 0 |
| hoisin | 0 |
| doenjang | 0 |
| oyster sauce, 蠔油, 蚝油 | 0 |
| 魚露 | 0 |

That shape is the reason to want it. The taxonomy is broad, Euro-centric, and
empty precisely where decision 4's differentiator lives — so it fills in the
unglamorous 4,700 without touching what makes this app worth using.

Two changes are waiting on exactly this. `add-cjk-matching` task 4b.4 says to
seed the romanisation variants people actually write rather than invent a
transliteration algorithm; this is that seed. And the catalogue's smallness is
the quiet constraint behind every matching failure the identity layer has.

## The licence question this change is blocked on

Open Food Facts data is **ODbL**, which carries attribution *and* share-alike.
Product images are **CC-BY-SA**.

Share-alike attaches to a derivative database. Whether a catalogue seeded from
OFF taxonomies and shipped inside the APK is one — as opposed to a produced work
built from it — is the question, and it is not one this proposal answers. It is
also not the same question as the per-user runtime cache `add-barcode-capture`
already plans, which is a different situation and may well have a different
answer.

**This change does not start until that is settled in writing.** Task 1 is the
only task that may be worked before the answer, and it produces the answer.

Three outcomes, all planned for:

- **Distribution is fine under attribution.** Do the whole change.
- **Distribution triggers share-alike, and publishing the catalogue is
  acceptable.** Do the whole change and publish the derived catalogue under
  ODbL. Given the hand-authored Asian entries are the moat and they are not
  derived from OFF, this may be a smaller cost than it first sounds — but it is
  a decision about the product, not a technicality, and it is not mine.
- **Neither is acceptable.** Take nothing. `add-open-data-catalogue` already
  covers the CC0 sources and is unblocked; this change is abandoned and the
  reasoning recorded.

## What Changes

*Conditional on the above.*

- **General ingredients are seeded from the taxonomy**, expanding the catalogue
  from 69 towards a useful fraction of 4,733.
- **In-script CJK aliases are seeded** from the taxonomy's own translations,
  giving `add-cjk-matching` real data instead of a hand-written corpus.
- **Nothing hand-authored is touched.** Same merge rules as
  `add-open-data-catalogue`: fill gaps, never overwrite, never delete.
- **Attribution ships**, wherever taxonomy-derived data is shown.
- **Provenance marks every seeded field**, so the OFF-derived subset is
  identifiable — which is what makes a later licence decision actionable rather
  than archaeological.

## Capabilities

### New Capabilities

- `taxonomy-seed`: Seeding the catalogue and its aliases from an externally
  licensed taxonomy. Covers the licence gate, what may be taken, in-script alias
  seeding, keeping the hand-authored catalogue authoritative, attribution, and
  identifying the derived subset.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Product data.** GTIN lookups are `add-barcode-capture`'s, and are a runtime
  cache rather than a shipped derivative.
- **Images.** CC-BY-SA, a separate obligation, and the app has no use for them.
- **Romanising anything.** Decision 31 stands. The taxonomy stores in script and
  so do we.
- **Taking the whole taxonomy.** 4,733 entries includes a great deal a home
  pantry never sees. Seeding is a curation problem, not an import.
- **Contributing back automatically.** Writing user data to OFF would be a
  privacy decision (decision 5) dressed as a licence obligation. Share-alike
  concerns databases, not the user's kitchen.

## Impact

**Schema.** None beyond what `add-open-data-catalogue` adds. This change reuses
its provenance columns and its merge rules rather than inventing parallel ones.

**Code.**
- `scripts/build-catalogue.ts` — a second source behind the same interface.
- `assets/canonical-items.json` — larger.
- The alias seed path — in-script aliases.
- Wherever taxonomy-derived data is displayed — attribution.

**Dependencies.** None added to the app.

**Depends on** `add-open-data-catalogue` for the pipeline, the provenance model,
and the merge rules. **Blocks** nothing, and is blocked by a licence answer
rather than by code. **Unlocks** `add-cjk-matching`'s seeding tasks.
