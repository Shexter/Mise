## 1. Asset pilot started with planning

- [x] 1.1 Register the cuisine inventory target and two subject briefs with `consumerWired: false`; keep the existing dish suffix and render recipe unchanged.
- [x] 1.2 Reproduce the broccoli gold master, generate Chinese/Japanese staging candidates, and inspect the contact sheet without promoting assets.
- [x] 1.3 Verify staging-only promotion rejection, illustration tests, typecheck, inventory, and record exact pilot results.

## 2. Reconcile the implementation handoff

- [x] 2.1 Recheck the shared worktree, predecessor tasks, and the owner's cuisine/entry-policy responses. Update this draft if the responses change its proposed defaults.
- [x] 2.2 Append the decision superseding 199's vertical stacking; cross-link the active planner change and reconcile only its conflicting home/picker layout requirements.
- [x] 2.3 Map every current save, cancel, onboarding, and history return caller to the task/date contract; preserve legacy route inputs.

## 3. Separate Today state and navigation

- [x] 3.1 Add the subpage preference and one-time route-intent resolver. Test first entry, remembered entry, legacy parameters, invalid parameters, and explicit save precedence.
- [x] 3.2 Separate future-capable planning dates from logged dates. Test cross-week selection, midnight foregrounding, history return, and stale loads without discarding drafts.
- [x] 3.3 Extract the Calories content and add the persistent `Meal plan | Calories` selector with independent scroll positions and hidden-page accessibility handling.
- [x] 3.4 Replace duplicate planner date rails with one rail and a compact Day/Week view control; preserve tap/drag targets and partial-week actions.
- [x] 3.5 Wire manual/review saves, planner saves, onboarding Week handoff, and analytics returns to the correct page and date; test parameter consumption and cancellation.

## 4. Make Calories immediately useful

- [x] 4.1 Place compact energy, fibre, protein, carbohydrate, and fat summaries before the contribution rail, history, and setup banners; retain analytics and dinner-gap actions.
- [x] 4.2 Verify no-target, no-meals, unknown/partial intake, loading/error, delete/undo, and linked-plan deduplication behavior with focused tests.
- [x] 4.3 Implement large-text reflow and supported-theme styling; preserve the single generic Add affordance and calorie-only/no-plan flow.

## 5. Build the selected cuisine chooser

- [x] 5.1 Make headings/actions follow the selected meal type; preserve picker state through preview/Back; lock replacement context to its original slot.
- [x] 5.2 Define stable cuisine IDs mapped to actual catalogue labels. Correct authored/saved filter scope, zero-match recovery, and saved-read retry behavior.
- [x] 5.3 Build the labelled illustrated cuisine rail with native selection, All, overflow affordance, screen-reader state, and image-failure fallback.
- [x] 5.4 Implement the selected recipe-row composition with substantial thumbnails, factual metadata, and explicit preview actions; retain final scheduling review.
- [x] 5.5 Verify no-key/empty-pantry selection, dietary/equipment review, occupied-slot conflicts, search recovery, long names, and zero side effects on cancel.

## 6. Connect reviewed assets

- [x] 6.1 Extend the illustration schema and typed static registry for cuisine; add file/manifest/registry/ID parity checks before allowing promotion.
- [x] 6.2 Extend the authored dish ID guard to the union of starter templates and planner catalogue IDs. Preserve rejection of free-text/provider/saved matches.
- [x] 6.3 Add stable-ID planner recipe visual resolution, photo precedence, image-error recovery, and food-class fallback; wire picker and recipe preview.
- [x] 6.4 Wire the same resolver into planned-meal detail, agenda rows, and Up next; verify renamed recipes and unknown snapshots.
- [x] 6.5 Add subject briefs for the remaining approved first-release cuisines, then generate through the existing pipeline after wiring the consumer.
- [x] 6.6 Review the ten existing planner dish candidates against their recipe ingredients. Re-roll only rejected candidates; preserve valid existing sidecars.
- [x] 6.7 Obtain named human/native visual acceptance for the cuisine and planner dish candidates. Promote only accepted IDs through the pipeline and re-run parity checks.
- [x] 6.8 Add the Korean cuisine subject only after reviewed Korean recipes establish real filter coverage. Reproduce the locked gold master, generate and inspect the staged candidate, and keep runtime fallback until named human acceptance.
- [ ] 6.9 After named human/native acceptance, promote Korean through the existing pipeline and re-run manifest/file/registry/ID parity checks.

## 7. Native acceptance and final handoff

- [x] 7.1 Run typecheck, relevant planner/calorie/asset tests, the full suite, strict validation of affected OpenSpec changes, and whitespace checks. Record exact counts.
- [ ] 7.2 Inspect Android first-view Calories and Meal plan, Day/Week switching, future/history dates, saving/logging returns, and draft preservation using synthetic fixtures without replacing owner data.
- [ ] 7.3 Inspect the chooser and authored art on Android against the selected PNG: light/dark, narrow width, 200% text, long names, search keyboard, filter failures, and cancelled preview.
- [ ] 7.4 Verify TalkBack, reduced motion, tap/drag parity, and focus recovery. Record physical-device versus emulator evidence separately.
- [ ] 7.5 Verify the equivalent iOS navigation, safe areas, large text, VoiceOver, and Back behavior; leave unavailable checks explicitly incomplete.
- [x] 7.6 Fix observed defects in one batch, capture a confirmation pass, index OS/device/build/state evidence, and hand off remaining owner acceptance without publication or archive.


## What remains open, and why

Recorded 8 September 2026, revised 13 September. Native evidence and its
provenance are in `docs/ui-overhaul/today-task-pages/README.md`.

- **6.7 — closed 13 September 2026.** Timothy Lauw accepted all fifteen
  candidates. Promoted through `art:make --promote`: five cuisine assets and the
  ten `planner-*` dish assets, each with its own provenance entry and verified
  checksum. The seven starter dish assets kept their original 2 September review
  date, and a regression test now guards that. `art:list` reports 167 shipped,
  0 ready to make, 0 blocked, no inconsistent slots.
- **6.8 — closed 13 September 2026.** The broccoli gold master reproduced at
  `sha256:9b7ad077379ee607378932fda394a9a9b85d3d4dbaa0dc7ffc889434c8043e7a`.
  Korean salt 0 was rejected because it omitted the gochujang accent. Salt 1
  (`seed 2301309548`) restored it and was inspected at the rail's 64 px size.
  The candidate remains in `.art-staging/cuisine/`; the runtime still uses its
  labelled fallback until task 6.9 receives named human/native acceptance.
- **7.2** — everything but the meal-logging return was inspected on the emulator,
  including the planner save return, which was exercised with a synthetic slot
  that was then removed. Logging a meal was not: it would decrement the owner's
  real pantry estimates on this install, and reversing that is best-effort. Its
  route contract is covered by `test/today-task-pages.test.ts`.
- **7.3** — light, dark, 320 dp, 200% text, long names, the search keyboard and a
  cancelled preview were all inspected. Two residues: a failed saved-recipe read
  was not forced natively, because doing so means breaking the owner's database.
  The artwork residue is closed: after the 13 September promotion the chooser
  rail, picker rows, preview hero, agenda row, Up next and cooking guide were all
  re-inspected on the emulator showing real artwork, each title resolving to its
  own painting.
- **7.4** — TalkBack is installed on the AVD but was not driven, and no physical
  device was attached. Drag placement could not be exercised either: `adb input`
  cannot reliably produce a long-press-then-drag. The drag hit test *was*
  corrected in this change — it previously compared a gesture's window
  coordinates against rail-local ones — so it needs a real device pass.
- **7.5** — no simulator build of Mise exists on this machine, and building one
  was outside this pass. iOS navigation, safe areas, Dynamic Type, VoiceOver and
  Back are unverified.
