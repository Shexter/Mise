## 1. Reconcile scope and establish local contracts

- [x] 1.1 Recheck live Git/OpenSpec state and reconcile overlapping persistence/handoff tasks in `guide-into-first-prep-plan`; retain its separable visual work and preserve unrelated dirty files.
- [x] 1.2 Append superseding product decisions for planner-first emphasis and curated recipe selection (42, 58, 33/156), update PRODUCT positioning and align stale query-boundary wording in OpenSpec config with the existing query facade.
- [x] 1.3 Define recipe snapshot, dated slot, schedule, week-template and batch-allocation types; document base yield, produced portions, eaten portions, unknown data and status/link invariants.
- [ ] 1.4 Capture an incumbent native Today/Shop/recipe baseline in a persistent development-client session using synthetic fixtures; map the Mobile UI brief's screens to existing routes/components without changing the global visual identity.

## 2. Recipe content and offline calculation

- [x] 2.1 Build the template/saved-recipe snapshot adapter with explicit yield, ingredient basis, optional inclusion and per-nutrient provenance; test incomplete recipes and source deletion.
- [x] 2.2 Implement meal-type/cuisine selection and dietary/equipment checks independently of dinner pantry constraints; test empty pantry, recipes requiring every ingredient to be purchased, missing equipment, unresolved ingredients and sauce/optional conflicts.
- [x] 2.3 Author and audit at least three breakfast choices, including a no-cook option, with ingredient/instruction agreement and sourced nutrition.
- [x] 2.4 Author and audit at least three lunch choices with batch yields, cuisine tags and sourced nutrition; reuse reviewed recipes where appropriate.
- [x] 2.5 Author and audit at least three dinner choices and verify Asian coverage, canonical identities, units and appropriate existing visuals across the collection.
- [x] 2.6 Implement pure date/slot operations and week-template copying; test Monday boundaries, DST, timezone change, occupied slots and independent copied state.
- [x] 2.7 Implement batch capacity, production scaling and consumption allocation; test the 600 g/four-lunch fixture, six-portion production and invalid consumption dates.
- [x] 2.8 Implement planned/eaten/projected nutrition and existing-target selection; test linked-meal deduplication, incomplete totals and target changes.
- [x] 2.9 Implement bounded single-meal portion fitting and shared quantity projection; test no improvement, missing/nonpositive targets, unknown conversion, rounding and invalid manual values.

## 3. Durable scheduling

- [x] 3.1 Append a forward-only migration for schedule, snapshot, batch, slot and week-template records with uniqueness/foreign-key constraints; verify populated legacy-database upgrade.
- [x] 3.2 Add transactional schedule create/read/edit queries through the existing query facade with revision conflict handling; test failure rollback and duplicate saves.
- [x] 3.3 Add snapshot update and template application queries; test occupied-slot review, source deletion and preservation of historical snapshots.
- [x] 3.4 Add the schedule store with hydration, preserved drafts, retry and date selection; test restart and failure recovery offline.
- [x] 3.5 Extend export and Delete all data to cover planner records, links and drafts; verify legacy export data and credentials isolation remain intact.

## 4. Grocery calculation and persistence

- [x] 4.1 Implement pure batch-to-grocery demand aggregation with canonical provenance, compatible unit conversion, optional inclusion and unknown contributions; test repeated meals and incompatible units.
- [x] 4.2 Implement optional revision-bound pantry coverage allocation across all batches; test applying the full list with every pantry check skipped, Have enough invalidation, uncertain stock and prevention of repeated subtraction.
- [x] 4.3 Append a forward-only migration for plan grocery source quantities, coverage and application/completion provenance; test legacy shopping rows remain readable.
- [x] 4.4 Implement staged diff and atomic grocery apply with stable source identities; test repeat apply, removed meals and preservation of manual/other sources.
- [x] 4.5 Implement conservative grocery undo and transfer of a previously added recipe occurrence; test partial failure and prevention of duplicated demand.
- [x] 4.6 Extend purchase/receipt reconciliation for partial and unconvertible plan quantities; test exact/fuzzy identity, increased demand after purchase, closed history and receipt undo isolation.

## 5. Meal logging integration

- [x] 5.1 Adapt accepted planner snapshots into existing editable meal review with accurate nutrient estimates, consumed portion, production servings and actual date; remove zero-nutrition assumptions from this path.
- [x] 5.2 Link confirmed saves atomically to slots/batches using idempotency; test double-submit and cancellation without orphaned links or consumption.
- [x] 5.3 Route subsequent batch portions through existing leftover behavior; test one depletion for the batch, separate eaten dates, restaurant exclusion and future-date review.
- [x] 5.4 Reconcile links after meal edit/deletion and plan removal; test existing reversal behavior and preservation of historical meals.

## 6. Planner interaction surfaces

- [ ] 6.1 Build local recipe picker and detail preview with meal-type/cuisine filters, saved recipes, quantity review and incomplete/empty states.
- [ ] 6.2 Build readable Today/Week agenda and dated slot editor with add, move, copy, replace, skip and remove tap actions; test date preservation and occupied-slot confirmation.
- [ ] 6.3 Add drag placement with the same operations and conflict rules as tap actions; verify cancellation, scrolling and reduced motion.
- [ ] 6.4 Add week save/reuse and explicit shared-batch allocation controls with production/consumption summary and capacity recovery.
- [ ] 6.5 Add target comparison and portion preview/apply/cancel controls with residual differences, locked portions and unknown-data explanations.
- [ ] 6.6 Integrate grocery preview/apply/undo and Plan changed state into the existing Shop screen, including coverage review and source/quantity disclosures.
- [ ] 6.7 Wire planned-meal cooking guides to the existing meal review/save journey with no mutation from guide navigation alone.
- [ ] 6.8 Implement the Mobile UI brief's loading, failed-save, empty search, completed day and pending grocery revision states; verify context-preserving cancel/Back and partial-week Done planning.
- [ ] 6.9 Apply existing typography/food visuals and light/dark semantic tokens across the complete flow; verify logical phone widths, expanded panes, long original-script names, keyboard insets and platform touch targets.

## 7. Promote the complete journey

- [ ] 7.1 Replace Today's dinner hero with the schedule-led hierarchy and state-specific main action; retain four tabs, Add, actual nutrition/history and one-tap dinner fallback.
- [ ] 7.2 Add explicit suggestion-to-slot preview and cancel behavior to dinner; test standalone dinner, missing-key and provider-failure recovery with local recipes still usable.
- [ ] 7.3 Update first-run starting choices and the planning branch so local recipes precede optional pantry capture and goals; preserve calorie-first/manual/no-key paths.
- [ ] 7.4 Persist the first scheduled meal before Week handoff, preserve both setup bridges and implement skip/resume without duplicate plans or repeated onboarding.
- [ ] 7.5 Add the dismissible existing-user introduction and reconcile Pantry setup prompts with the shared planner, avoiding a second saved-plan system.

## 8. Verification and handoff

- [ ] 8.1 Run `npm run typecheck` and relevant local tests as each slice completes; run the full repository test suite, strict OpenSpec validation and whitespace checks before handoff. Record exact results.
- [ ] 8.2 Verify on Android: fresh/no-key onboarding with no pantry setup → choose recipes requiring a grocery haul → schedule partial week → adjust portions → apply the full grocery list without pantry checks → restart → cook/log → leftovers; retain screenshots and explicit expected/actual evidence.
- [ ] 8.3 Verify on iOS the same journey plus old-install upgrade and existing dinner/calorie-only routes; record any unavailable device coverage as incomplete.
- [ ] 8.4 Verify TalkBack/VoiceOver tap scheduling, narrow phone/200% text, reduced motion, drag parity, focus recovery, back/cancel, storage failure and stale grocery revision recovery.
- [ ] 8.5 Run a separate fallback regression matrix: unplanned dinner, incomplete nutrition, missing provider, skipped setup, partial receipt purchase, plan deletion and linked-meal edit/undo; confirm no double nutrition or depletion.
- [ ] 8.6 Execute the Mobile UI brief's computer-use review: capture all named native screens in one batched inspection, fix observed defects together, then run a confirmation pass; index screenshots by OS/device/build/state and distinguish emulator, physical-device and screen-reader evidence.
- [ ] 8.7 Record acceptance evidence against all six capability specs and residual limitations; leave unverified device/content gates unchecked and prepare the implementation handoff without deployment or publication.
