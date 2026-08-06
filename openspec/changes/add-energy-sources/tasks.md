## 1. Types and schema

- [ ] 1.1 Add `TargetSource` (`estimated | measured | stated`) and
      `StatedFigureKind` (`resting | total | adjusted`) to `src/types.ts` with
      their `readonly` arrays, following the `MEAL_VENUES` convention.
- [ ] 1.2 Extend `Profile` with `targetSource`, and nullable `bodyFatPct`,
      `measuredAtWeightKg`, `measuredOn`, `statedCalories`, `statedFigureKind`.
- [ ] 1.3 **Nullable, not defaulted.** A user with no measurement has no
      measurement; zero is a body fat percentage.
- [ ] 1.4 Append the migration. Existing profiles get `targetSource:
      'estimated'`, which is what they already are.
- [ ] 1.5 Confirm `DROP_ALL` covers the profile table rather than assuming it.
- [ ] 1.6 Verify the migration runs from the current head and that an existing
      profile's target is byte-identical afterwards — same formula, same
      recalculation, same number.

## 2. The formulas

Pure. No database, no network. All of section 2 is testable before any screen
exists.

- [ ] 2.1 Add `katchMcArdle(fatFreeMassKg)` to `src/logic/bmr.ts`:
      `370 + 21.6 × fatFreeMassKg`.
- [ ] 2.2 Derive fat-free mass as `weightKg × (1 − bodyFatPct)`.
- [ ] 2.3 **Store body fat percentage, not lean mass.** DEXA reports lean soft
      tissue and bone mineral content separately, InBody uses its own
      vocabulary, and "lean mass" therefore means different quantities on
      different sheets. Body fat percentage is the field both print prominently
      under the same name meaning the same thing.
- [ ] 2.4 Leave `basalMetabolicRate` and Mifflin-St Jeor untouched.
- [ ] 2.5 Keep `activityMultiplier` and `goalAdjustment` shared — Katch-McArdle
      produces resting energy, so the two later stages are unchanged and do not
      care which formula produced it.
- [ ] 2.6 Implement `resolveTarget(profile): EnergyTargets` dispatching on
      `targetSource`, so there is one entry point rather than three call sites
      that will drift.
- [ ] 2.7 Apply the right transformations per stated kind: `resting` gets
      activity and goal, `total` gets goal only, `adjusted` gets neither.
      Applying the goal adjustment to a figure that already includes it
      double-counts the deficit.
- [ ] 2.8 Unit-test every source and every stated kind, plus a profile with a
      measurement whose weight differs from current weight.

## 3. Plausibility

- [ ] 3.1 Define plausible ranges per stated kind and for body fat percentage,
      as named constants.
- [ ] 3.2 **Flag, never clamp.** A clamped value looks like the value the user
      entered and is not, and they would have no way to see it. Clamping at
      `MIN_TARGET_CALORIES` is defensible for a figure the app derived and not
      for one the user typed.
- [ ] 3.3 **Flag, never reject.** Athletes, very tall people, and people
      recovering from illness have real figures outside any range worth
      encoding, and the app has no standing to tell someone their measured
      number is wrong.
- [ ] 3.4 Flag a resulting target below `MIN_TARGET_CALORIES` prominently, and
      still allow it. This is the one place a quiet note is not enough.
- [ ] 3.5 Store exactly what the user gave, whatever was flagged.
- [ ] 3.6 Test each range boundary, and test that an accepted out-of-range value
      round-trips unchanged.

## 4. The recalculation bug

Its own section because it is the one defect this change would otherwise
introduce, and it would be invisible.

- [ ] 4.1 Make `profileStore.update`'s recalculation conditional on
      `targetSource`: estimated recomputes from the profile, measured recomputes
      from the measurement, **stated recomputes nothing**.
- [ ] 4.2 Write the test first: set a stated target, change the weight, assert
      the target is unchanged. Today's code fails it.
- [ ] 4.3 Confirm an estimated target still recalculates exactly as it does now
      — this must not regress for the users who already exist.
- [ ] 4.4 Confirm a measured target recalculates when activity level or goal
      changes.
- [ ] 4.5 Confirm `ensureDailyTarget` still snapshots per day, so past days keep
      the target that was active then.

## 5. Staleness

- [ ] 5.1 Compare current weight against `measuredAtWeightKg` and disclose when
      they diverge materially.
- [ ] 5.2 Define "materially" as a named constant, probably a proportion of body
      weight rather than an absolute.
- [ ] 5.3 **Do not fall back to Mifflin-St Jeor.** Silently reverting would
      change someone's target without their involvement, which is the same class
      of mistake as 4.1. The measurement is still the best information
      available; it is only older.
- [ ] 5.4 Offer to update the measurement, and clear the disclosure when it is.
- [ ] 5.5 Use weight divergence rather than elapsed time — someone whose weight
      has not moved in a year has a measurement that is probably still fine, and
      someone who has lost eight kilos in three months does not.
- [ ] 5.6 Test the disclosure appearing, not blocking, and clearing.

## 6. Onboarding

- [ ] 6.1 Add one routing screen after `goal.tsx`: estimate it for me, I have a
      body scan, I already know my number.
- [ ] 6.2 **Preselect the first**, so the existing path is one tap longer and
      no more.
- [ ] 6.3 **Add no required questions to the default path.** A form that asks
      everybody for a body fat percentage makes onboarding worse for almost
      everyone to serve a few, which is the opposite of the feedback.
- [ ] 6.4 Build the measurement screen: body fat percentage, weight at
      measurement, date. Nothing else.
- [ ] 6.5 Build the stated-figure screen: the number, and **what kind of number
      it is**. This is the question that stops the feature being harmful — Apple
      Health exposes resting and active energy separately, rings show total or
      active or both, they differ by hundreds of calories, and all of them are
      "the number my health app says".
- [ ] 6.6 Show the profile's own estimate alongside whatever the user supplies,
      wherever both can be computed.
- [ ] 6.7 **Do not rank the sources.** A DEXA figure is solid; a consumer
      tracker's active-calorie estimate is often optimistic. The app cannot
      referee that and the user knows where their number came from — so show the
      working and let them choose.
- [ ] 6.8 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.

## 7. Editing later

- [ ] 7.1 Show the target's source wherever the target is shown.
- [ ] 7.2 Allow changing the source, and supplying or replacing a measurement or
      a figure, from the profile sheet.
- [ ] 7.3 Allow returning to estimation without losing a stored measurement, so
      switching back is not destructive.
- [ ] 7.4 Show what each available source would produce when changing it.

## 8. What the app refuses to store

- [ ] 8.1 Collect body fat percentage, measurement weight, and date. **Nothing
      else** — not visceral fat, segmental analysis, phase angle, metabolic age,
      or any score.
- [ ] 8.2 Confirm no schema field exists for any of them. Storing a number is
      how an app ends up rendering it, and rendering it is an assessment.
- [ ] 8.3 Derive no rating, score, or evaluation of the user's body from what is
      stored.

## 9. Language

- [ ] 9.1 Audit every string this change adds. A calorie target is a
      **calculation**; its inputs are inputs. Never a diagnosis, an assessment,
      a recommendation, or a health claim.
- [ ] 9.2 Add a test asserting the forbidden words appear in no string this
      change adds, matching how decisions 108 and 142 are enforced.
- [ ] 9.3 **A more precise input must not become a stronger claim.** A target
      derived from a DEXA scan is better arithmetic, and says nothing more about
      the person than the estimated one did. This is the sentence the whole
      section exists to protect.

## 10. Verification

- [ ] 10.1 Complete onboarding as a user with nothing, and confirm the
      experience is one tap longer than before and the target is identical.
- [ ] 10.2 Complete it with a real body fat percentage and confirm the target
      differs from the Mifflin-St Jeor estimate in the expected direction.
- [ ] 10.3 Enter a resting figure, a total figure, and an adjusted figure of the
      same magnitude, and confirm all three produce different targets.
- [ ] 10.4 Enter an active-energy figure as a daily total and confirm the app
      questions it. This is the harmful case.
- [ ] 10.5 State a target, then change weight, height, and activity in turn, and
      confirm the stated target survives all three.
- [ ] 10.6 Change weight materially against a stored measurement and confirm the
      disclosure appears and the target still works.
- [ ] 10.7 Confirm an existing profile upgraded through the migration has an
      unchanged target.
- [ ] 10.8 Confirm no screen displays anything resembling an assessment.
- [ ] 10.9 Run `npm run typecheck` and `npm test`, then record the plausible
      ranges and the divergence threshold in `docs/product-decisions.md`.
