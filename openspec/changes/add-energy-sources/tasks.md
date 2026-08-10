## 1. Protect what already works

First, because the hard constraint on this change is that the existing flow does
not move.

- [x] 1.1 Snapshot the regular onboarding: its screens, their order, and the
      target a known set of answers produces.
- [x] 1.2 Write a test asserting that target, so any drift in the shared
      calculation fails the build.
- [x] 1.3 Confirm at the end of the change that the regular flow has the same
      screens in the same order and produces the same number. **No new
      questions, no reordering, not one extra tap.**

## 2. Types and schema

- [x] 2.1 Add `TargetSource` (`estimated | dexa | inbody | stated`) and
      `StatedFigureKind` (`resting | total | adjusted`) to `src/types.ts` with
      their `readonly` arrays.
- [x] 2.2 Add `BodyMeasurement`: provider, the provider's own fields, derived
      fat-free mass, weight at measurement, and date.
- [x] 2.3 Extend `Profile` with `targetSource`, `statedCalories`,
      `statedFigureKind`.
- [x] 2.4 **Make `sex`, `age` and `heightCm` nullable.** A scan user is never
      asked for them. Grep confirms they are read only by `energyTargets` and
      `ProfileSheet.tsx` — fix both, and do not silence a null with a default.
- [x] 2.5 Append the migration creating `body_measurements`, keyed uniquely by
      provider so at most one row per provider can exist.
- [x] 2.6 SQLite cannot drop a NOT NULL constraint in place, so 2.4 is a table
      rebuild. **Verify it against a populated database, not a fresh one.**
- [x] 2.7 Existing profiles get `targetSource: 'estimated'` and keep every
      value. Confirm their target is byte-identical afterwards.
- [x] 2.8 Extend `DROP_ALL`.
- [x] 2.9 Verify the migration runs from the current head and `npm run typecheck`
      passes.

## 3. Per-provider derivation

Pure. No database, no network. All of section 3 is testable before any screen
exists.

- [x] 3.1 Add `katchMcArdle(fatFreeMassKg)` to `src/logic/bmr.ts`:
      `370 + 21.6 × fatFreeMassKg`.
- [x] 3.2 Create `src/logic/bodyComposition.ts` with one derivation per
      provider.
- [x] 3.3 **DEXA**: derive fat-free mass from body fat percentage and weight,
      or from lean tissue plus bone mineral content where the user has them.
      DEXA's "lean mass" usually excludes bone — several kilograms — so summing
      is required when working from those fields.
- [x] 3.4 **InBody**: take the printed fat-free mass **as given**. Do not
      recompute it from other fields, and do not confuse it with skeletal muscle
      mass, which is smaller, different, and printed right next to it.
- [x] 3.5 Implement `resolveTarget(profile, measurements)` as a
      `Record<TargetSource, Resolver>` so that adding a source without its logic
      is a **compile-time error** — the exhaustiveness discipline
      `add-openai-provider` applies to transports.
- [x] 3.6 Leave Mifflin-St Jeor untouched, and keep `activityMultiplier` and
      `goalAdjustment` shared. Katch-McArdle produces resting energy, so the two
      later stages do not care which formula produced it.
- [x] 3.7 Apply the right transformations per stated kind: `resting` gets
      activity and goal, `total` gets goal only, `adjusted` gets neither.
      Applying the goal adjustment to a figure that already includes it
      double-counts the deficit.
- [x] 3.8 Unit-test every source, every stated kind, both DEXA input shapes, and
      a measurement whose weight differs from current weight.
- [x] 3.9 Test that removing a source from the resolver map fails
      `npm run typecheck`, proving 3.5's guarantee.

## 4. Measurements per provider

- [x] 4.1 Store at most one current measurement per provider.
- [x] 4.2 **Switching provider must not delete anything.** InBody → DEXA →
      InBody is ordinary for someone who scans at a gym and gets a DEXA yearly,
      and losing a figure to a switch is a small betrayal for the audience most
      likely to notice.
- [x] 4.3 A new measurement replaces only its own provider's.
- [x] 4.4 Only the active provider computes the target. There is no honest way
      to reconcile a DEXA against an InBody, so the user picks which they trust.
- [x] 4.5 Test the full switch cycle: enter InBody, switch to DEXA, enter DEXA,
      switch back, and confirm the InBody figure is intact and used.

## 5. Recalculation

Its own section because it is the one defect this change would otherwise
introduce, and it would be invisible.

- [x] 5.1 Make `profileStore.update`'s recalculation conditional on
      `targetSource`: estimated recomputes from the profile, a provider
      recomputes from that provider's measurement, **stated recomputes
      nothing**.
- [x] 5.2 Write the test first: set a stated target, change the weight, assert
      the target is unchanged. Today's code fails it.
- [x] 5.3 Confirm an estimated target still recalculates exactly as now — this
      must not regress for the users who already exist.
- [x] 5.4 Confirm a measured target recalculates when activity or goal changes.
- [x] 5.5 Confirm `ensureDailyTarget` still snapshots per day.

## 6. Plausibility

- [x] 6.1 Define plausible ranges per field and per stated kind, as named
      constants.
- [x] 6.2 **Flag, never clamp.** A clamped value looks like what the user typed
      and is not. Clamping at `MIN_TARGET_CALORIES` is defensible for a derived
      figure and not for a typed one.
- [x] 6.3 **Flag, never reject.** Athletes, very tall people, and people
      recovering from illness have real figures outside any range worth
      encoding.
- [x] 6.4 Flag a resulting target below `MIN_TARGET_CALORIES` prominently, and
      still allow it.
- [x] 6.5 Store exactly what the user gave, whatever was flagged.
- [x] 6.6 Test each boundary, and that an accepted out-of-range value
      round-trips unchanged.

## 7. Staleness

- [x] 7.1 Compare current weight against the measurement weight and disclose
      material divergence.
- [x] 7.2 Make the threshold a named constant, probably a proportion of body
      weight, and allow it to differ per provider — an InBody taken monthly goes
      stale differently from a DEXA taken yearly.
- [x] 7.3 **Do not fall back to Mifflin-St Jeor.** Silently reverting changes
      someone's target without their involvement, which is section 5's mistake
      wearing different clothes.
- [x] 7.4 Offer to update, and clear the disclosure when updated.
- [x] 7.5 Test the disclosure appearing, not blocking, and clearing.

## 8. The entrance and the flows

- [x] 8.1 Add entry points to `app/onboarding/welcome.tsx` for DEXA, InBody, and
      a known figure, with the regular flow visually **primary** and the others
      secondary.
- [x] 8.2 **Change nothing else about the regular flow.** No routing screen
      inside it, no reordering, no new questions. Re-run 1.3 after.
- [x] 8.3 Build the DEXA flow: weight, scan fields, date, activity, goal.
- [x] 8.4 Build the InBody flow: weight, printed fat-free mass, date, activity,
      goal.
- [x] 8.5 **Ask for nothing a flow does not need.** No sex, age, or height in
      the scan flows — Katch-McArdle uses none of them, and a longer form for
      people with better data is exactly backwards.
- [x] 8.6 Build the stated-figure flow, asking **what kind of number it is**.
      This is the question that stops the feature being harmful: Apple Health
      exposes resting and active energy separately, rings show total or active
      or both, they differ by hundreds of calories, and all of them are "the
      number my health app says".
- [x] 8.7 Offer InBody's printed BMR as an optional shortcut, recorded as a
      **stated resting figure** rather than as a measurement, so it is never
      mistaken for something the app derived.
- [x] 8.8 Use each provider's own vocabulary on its own screens. An InBody user
      should see "Fat Free Mass" because that is what the sheet says.
- [x] 8.9 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.

## 9. Settings

- [x] 9.1 Show the active source wherever the target is shown.
- [x] 9.2 Allow changing the active source, entering or replacing a measurement,
      and editing a stated figure — the same way basic details are edited today.
- [x] 9.3 When switching to a source whose inputs were never collected, ask for
      them at that point. Estimation needs sex, age and height; a scan user was
      never asked.
- [x] 9.4 Show what each available source would produce when switching.
- [x] 9.5 **Do not rank the sources.** A DEXA figure is solid; a consumer
      tracker's active-calorie estimate is often optimistic. The app cannot
      referee that and the user knows where their number came from.
- [x] 9.6 Make `ProfileSheet.tsx` render absent sex, age and height without
      assuming a value.

## 10. What the app refuses to store

- [x] 10.1 Collect only the fields a target is computed from. **Nothing else** —
      not visceral fat, segmental analysis, phase angle, metabolic age, total
      body water, or any score.
- [x] 10.2 Confirm no schema field exists for any of them. Storing a number is
      how an app ends up rendering it, and rendering it is an assessment.
- [x] 10.3 Derive no rating, score, or evaluation of the user's body.

## 11. Language

- [x] 11.1 Audit every string this change adds. A calorie target is a
      **calculation**; its inputs are inputs. Never a diagnosis, assessment,
      recommendation, or health claim.
- [x] 11.2 Add a test asserting the forbidden words appear in no string this
      change adds, matching decisions 108 and 142.
- [x] 11.3 **A more precise input must not become a stronger claim.** A target
      from a DEXA scan is better arithmetic and says nothing more about the
      person than the estimated one did.

## 12. Verification

- [ ] 12.1 Complete the regular onboarding and confirm it is identical to before
      and produces the same target.
- [ ] 12.2 Complete the DEXA flow with a real scan sheet and confirm the target
      differs from the Mifflin-St Jeor estimate in the expected direction.
- [ ] 12.3 Complete the InBody flow with a real printout, using the fat-free
      mass as printed.
- [ ] 12.4 Confirm neither scan flow asked for sex, age, or height.
- [ ] 12.5 Enter a resting, a total, and an adjusted figure of the same
      magnitude and confirm all three produce different targets.
- [ ] 12.6 Enter an active-energy figure as a daily total and confirm the app
      questions it. This is the harmful case.
- [ ] 12.7 State a target, then change weight, activity, and goal in turn, and
      confirm it survives all three.
- [ ] 12.8 Switch InBody → DEXA → InBody and confirm nothing was lost.
- [ ] 12.9 Switch a scan user to estimation and confirm they are asked for the
      details estimation needs, and only then.
- [x] 12.10 Confirm an existing profile upgraded through the migration has an
      unchanged target, tested against a populated database.
- [x] 12.11 Confirm no screen displays anything resembling an assessment.
- [x] 12.12 Run `npm run typecheck` and `npm test`, then record the plausible
      ranges and the divergence thresholds in `docs/product-decisions.md`.
