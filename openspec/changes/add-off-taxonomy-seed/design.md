## Context

See `proposal.md` — the measured shape of the taxonomy, and the licence question
this change is gated on.

What ships today: 69 hand-authored canonical ingredients, and an alias table
populated by seed data and by user resolutions through `resolve()`.
`add-cjk-matching` is planned and its task 4b.4 asks for seeded romanisation
variants that do not exist. `add-open-data-catalogue` establishes the build
script, the per-field provenance model, and the merge rules this change reuses
wholesale.

## Goals / Non-Goals

**Goals:**

- The catalogue stops being the app's smallest component.
- `add-cjk-matching` gets real in-script data rather than a hand-written corpus.
- The licence position is a recorded decision, not an assumption anyone has to
  reconstruct later.

**Non-Goals:**

- Product data, images, romanisation, wholesale import, automatic contribution
  back. See the proposal.

## Decisions

### The licence answer is a gate, not a caveat

Task 1 produces it. Nothing else may start.

*Why a gate rather than "build it and check later":* the cost of being wrong is
asymmetric and irreversible in the way that matters. If share-alike applies to a
shipped seed and the catalogue has already gone out in an APK, the obligation
already attached — and unwinding it means identifying which fields came from
where in a file that, without the provenance requirement below, would not record
it. Doing the investigation first costs a day. Doing it last costs a
reconstruction.

*Why the outcomes are enumerated in the proposal:* so the answer resolves the
change rather than reopening it. Two of the three outcomes are "proceed", which
is worth saying out loud — this is a gate, not a prediction that it will fail.

### Provenance is what makes the gate reversible

Every seeded field records its origin, per `add-open-data-catalogue`'s model.

*Why this is load-bearing here specifically:* it is the difference between "we
can withdraw the OFF-derived subset" and "we would have to rebuild the catalogue
from memory". It also makes the second outcome — publish the derived catalogue
under ODbL — a mechanical operation rather than a judgement call about which
rows are ours.

### Seeding is curated, and the curation is the work

4,733 entries is not an import. A home pantry does not need every entry a food
labelling taxonomy carries.

*Why not take everything and let matching sort it out:* a larger candidate pool
makes the matcher's job harder, not easier. Decision 32's confidence bands were
measured against a small corpus of things people actually buy; flooding it with
thousands of near-synonymous labelling terms moves scores in ways nobody has
measured, and the failure mode is a confident wrong match rather than a visible
miss.

*Why the selection is reviewable:* it is a product decision about what the app
knows, arriving in the shape of a data file.

### Seeded aliases are weaker than confirmed ones

A seeded alias records that it was imported, and a user resolution outranks it.

*Why:* `add-identity-layer` already had a confirm-band leak where an unconfirmed
alias was written back and the next sighting resolved silently at a flat high
confidence. Seeding thousands of aliases at an undifferentiated confidence would
recreate that failure at scale, and the taxonomy's translations are of uneven
quality — a machine translation and a native contributor look identical in the
file.

### The Euro-centric shape is the reason this is safe

Measured: 4,733 entries, and zero for gochujang, hoisin, doenjang, or oyster
sauce.

*Why that is good news rather than a gap to fill:* it means the seed cannot
dilute decision 4's differentiator, because it does not reach it. The 4,700
entries it does bring are the unglamorous ones — flour, tinned tomatoes, cheddar
— that the catalogue lacks and that nobody was ever going to hand-author with
enthusiasm. The moat and the seed occupy disjoint territory, which is the ideal
arrangement and is not something that had to be true.

*What follows practically:* the merge rules must never delete on absence, which
`add-open-data-catalogue` already requires and which matters more here because
this dataset is larger and its absences are more numerous.

## Risks / Trade-offs

**The licence answer arrives after work has started** → prevented structurally
by the gate rather than by discipline.

**Seeding thousands of aliases degrades matching** → the real technical risk.
Mitigation: curated selection, seeded aliases carry lower confidence, and the
Latin corpus's band placement is re-measured against decision 32's recorded
evidence before and after. Any movement is a regression.

**Translation quality is uneven** → machine translations and native
contributions are indistinguishable in the file. Mitigation: seeded aliases are
weaker than confirmed ones, and a user correction always wins.

**The catalogue becomes hard to reason about** → 69 entries can be read; 2,000
cannot. Mitigation: provenance makes the hand-authored core listable on its own,
which is the subset anyone actually needs to reason about.

**Attribution becomes clutter** → an attribution on every ingredient name would
be absurd. Mitigation: attribute where derived data is shown as data, not on
every rendering of a word.

## Migration Plan

No schema change of its own. Reuses the provenance columns
`add-open-data-catalogue` adds, and arrives as a catalogue version bump through
the existing seed path.

Rollback is the previous asset and version. Because provenance is recorded per
field, a withdrawal is a filter over the asset rather than a revert of history.

## Open Questions

- **How many of the 4,733 are worth having.** The curation criterion is
  unwritten and the honest answer probably comes from looking at a few hundred
  entries rather than from a rule.
- **Whether the CJK translations are good enough to seed as aliases.** 944
  Japanese, 783 Chinese, 606 Korean — but quality is unmeasured, and soy sauce
  looking correct is one data point rather than evidence. Measure before
  trusting, the same way decision 67 was closed.
- **Whether the licence answer should be sought from Open Food Facts directly.**
  They are a community project with a forum and are the people best placed to
  say how they read their own licence. Asking is cheap and the answer is public
  interest.
