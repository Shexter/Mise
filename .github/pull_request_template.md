<!--
  Mise pull request template.

  Fill in every section. Delete a section only if it is genuinely not
  applicable, and say so rather than leaving it blank — a blank section reads
  as "not done" and costs a review round to disambiguate.

  The sections are not bureaucracy. Each one exists because something went
  wrong here without it, and the notes say which.
-->

## What this is

**OpenSpec change:** `<!-- e.g. add-dietary-profile -->`
**Task groups in this PR:** `<!-- e.g. 1-5, 7-9 -->`

<!-- Two or three sentences. What now works that did not before, in product
     terms rather than file terms. A reviewer reads this to decide what to
     look at, so "the pantry now decrements on leftovers" beats "updated
     depletionService". -->

---

## Tasks

<!-- Be exact. `openspec validate --all --strict` must pass, and the checked
     state in tasks.md is the record. -->

- **Completed:** `<!-- n -->` of `<!-- n -->`
- **Left unchecked:** `<!-- n -->`

### Left unchecked, and why

<!-- One line each. Group them, because the reasons differ and the reader
     needs to tell them apart:

     - Needs a real device, a camera, or a real API key — cannot be done in a
       sandbox. Say which task and what it needs.
     - Blocked on another change that has not landed. Name it.
     - Deliberately deferred. Say why, and where it went.

     This section exists because "48/48 tasks" has been reported for work
     where a third of the tasks needed a phone. That is fine and expected —
     what is not fine is it being invisible. -->

### Tasks added during implementation

<!-- If the plan was wrong or incomplete, tasks.md should have grown. Say what
     you added and why. Check task numbers do not collide with existing ones —
     a duplicate `3.5` has happened. -->

---

## Decisions

**Implements:** `<!-- decision numbers from docs/product-decisions.md -->`
**Affects or constrains:** `<!-- decision numbers -->`

### Newly recorded

<!-- Numbers and one-line titles. If none, say "none".

     BEFORE PICKING A NUMBER: pull `main` and take the next free one. Parallel
     branches have collided twice, both times because a branch was cut before
     another's decisions merged. If you discover a collision at merge time,
     the earlier-merged number stays and the later-merged branch renumbers.

     Do not record a decision as SETTLED that was never measured against
     anything. Use OPEN, and say what would close it. -->

### A planned decision that turned out to be wrong

<!-- The project rule is: stop and flag rather than quietly deviating.
     Decisions get superseded in the ledger, not ignored.

     If you deviated from the plan at all — even for a good reason, even in a
     small way — it goes here. A deviation the reviewer discovers in the diff
     costs far more than one stated up front. If there were none, write
     "none". -->

---

## Measured vs assumed

<!-- The single most useful section in this template, and the one most likely
     to be skipped.

     The recurring failure mode in this repo is measuring accurately and then
     interpreting optimistically — the numbers are right and the sentence
     around them is wrong. So separate them explicitly. -->

### Measured

<!-- Real figures, with what produced them. Hit rates, accuracy across a
     fixture corpus, band placement before and after, cost, timings.
     "Recorded X in docs/product-decisions.md" belongs here with the number
     inline, so a reviewer does not have to go and look. -->

### Assumed, or asserted without evidence

<!-- Every threshold, weight, window, and named constant you chose by
     judgement rather than measurement. Say so plainly. A constant that looks
     measured but was not is worse than one openly labelled a guess, because
     the next person will trust it.

     Also: anything you believe holds but did not verify. -->

---

## Schema and data

<!-- Delete this section only if the diff touches no schema, no seed data, and
     no migration. -->

- [ ] Migration is **appended** to `MIGRATIONS` in `src/db/schema.ts`
- [ ] No shipped migration was edited — forward-only, always
- [ ] `DROP_ALL` extended for every new table
- [ ] *Delete all data* removes any new files on disk (images, captures) as well as rows
- [ ] Migration verified to run from the current head, not just on a fresh database
- [ ] New columns are nullable where the value is genuinely unknown, and not defaulted to `0` or `''`

<!-- Unknown-as-zero has bitten this codebase repeatedly. A null that becomes a
     zero is a fact the app then reports confidently and wrongly.

     If you added a column, say what writes it. A column nothing ever sets has
     shipped here before. -->

**New columns and what writes them:**

---

## Non-negotiables

<!-- From openspec/config.yaml. Tick honestly; an unticked box with a note is
     a normal outcome and an untrue tick is not. -->

- [ ] All SQL lives in `src/db/queries.ts` — none anywhere else
- [ ] The API key stays inside `src/api/keyStore.ts` — not in the database, logs, or the JSON export
- [ ] Every colour, font, and spacing value comes from `src/constants/theme.ts` — no literals
- [ ] No quantity is displayed that the app cannot defend (decision 15)
- [ ] Nothing is written before the user reviews it, on any new path
- [ ] Any new model-facing constraint is **also enforced locally** after the response

<!-- That last one is decision 136's lesson, and it is the most expensive
     mistake this repo has made. A rule stated in a prompt is a request. If
     the spec promises the app *does* something, the app has to check.

     If your change adds user-facing copy about safety, health, or an outcome,
     also confirm the language audit: decisions 108, 129, and 142 forbid
     specific words, each with a test. -->

---

## Verification

```
npm run typecheck   <!-- paste the result -->
npm test            <!-- paste the file/test counts -->
openspec validate --all --strict
```

**Run on a real device?** `<!-- yes / no — and if no, say which verification tasks are therefore outstanding -->`

<!-- Tests passing is not the same as the requirement being met. Decision 136
     was found in code where every test passed: the tests covered bucketing
     exhaustively and never asserted the property of a returned suggestion.

     So: name one behaviour you verified that a passing test suite would not
     have caught. -->

**Verified beyond the test suite:**

---

## For the reviewer

### Look here first

<!-- Point at the two or three places where the risk actually is — the
     subtlest logic, the widest blast radius, the thing you were least sure
     about. Reviews in this repo have found a real defect nearly every round,
     and the ones that worked went straight at a specific claim. -->

### Load-bearing claims worth checking

<!-- State the assumptions your code depends on that a reader would otherwise
     have to take on trust. For example: "this reads stock.full and assumes
     use_first is never compressed — shapeStockPayload guarantees it."

     Writing these down is how a wrong assumption gets caught in review rather
     than in use. If one of them is untested, say so — that is exactly the
     kind of thing a reviewer should spend their time on. -->

### Known gaps

<!-- What is incomplete, degraded, or deferred in this PR, and what would
     close it. Distinguish "not built yet" from "built and imperfect", because
     they need different responses. -->

---

## Sequencing

- **Depends on:** `<!-- merged changes this needs, or "nothing unmerged" -->`
- **Blocks:** `<!-- changes waiting on this -->`
- **Conflicts likely with:** `<!-- other in-flight branches touching MIGRATIONS, src/types.ts, or docs/product-decisions.md — these are the three files that collide -->`
