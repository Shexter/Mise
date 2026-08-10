## 1. Typed policy foundation

- [x] 1.1 Add base-intent, prep-speed, resolved-preference, and preference-source
      types to `src/types.ts`, distinct from `SuggestionMode`.
- [x] 1.2 Add a pure `src/logic/suggestionTemplates.ts` policy table for all
      base intents and prep speeds: named scoring multipliers, prompt framing,
      portion policy, descriptions, and reason policy.
- [x] 1.3 Define every multiplier and threshold as a named exported constant;
      no unexplained numeric literals in the policy table.
- [x] 1.4 Implement `defaultBaseIntent(goal)` with lose → lighter-portions,
      gain → protein-forward, and maintain → balanced.
- [x] 1.5 Implement pure preference resolution where an explicit local choice
      wins and profile default supplies standard prep speed otherwise.
- [x] 1.6 Unit-test policy completeness, bounded weights, stable labels, and
      total goal mapping.

## 2. Local preference persistence

- [x] 2.1 Append a forward-only migration creating the one-row
      `suggestion_preferences` table and adding nullable `template_id` and
      `prep_speed` columns to `suggestion_cache`.
- [x] 2.2 Clear the old disposable suggestion cache in that migration, rebuild
      its lookup index with both preference dimensions, and extend `DROP_ALL`.
- [x] 2.3 Add parameterized query helpers to read, save, and clear the explicit
      preference; do not add SQL outside `src/db/queries.ts`.
- [x] 2.4 Extend cache query, deletion, insertion, row mapping, and types so a
      tonight row uses both preference dimensions and non-tonight rows use null.
- [x] 2.5 Add upgrade and cache-isolation tests for old rows, template changes,
      speed changes, reset, and non-tonight modes.

## 3. Preference-aware selection

- [x] 3.1 Extend `DishScoreContext` and score construction with the resolved
      tonight preference only when the request mode is tonight.
- [x] 3.2 Replace fixed scorer weights with policy-provided multipliers while
      keeping all shared candidate facts and named base constants.
- [x] 3.3 Add an effort threshold and quick modifier using `effortMinutes`;
      quick must not branch the scorer by id.
- [x] 3.4 Add conservative labelled nutrition-fit terms for protein-forward and
      lighter-portions. Missing estimate data must return a neutral term.
- [x] 3.5 Retain the existing variety selector and demonstrate a meaningful,
      deterministic ordering difference for representative policies.
- [x] 3.6 Keep macro-gap macro-first assessment and stretch-plan selection
      outside template scoring.
- [x] 3.7 Test that the same facts are evaluated under all policies and that no
      policy turns an unknown nutrient into zero or rejects a candidate.
- [x] 3.8 Test policy selection with dietary exclusions and use-first failures
      before scoring for every intent and prep speed.

## 4. Portion guidance and factual explanations

- [x] 4.1 Add a typed optional portion recommendation to a displayed
      suggestion, calculated only from defensible calories and remaining
      allowance.
- [x] 4.2 Implement lighter-portions and protein-forward portion policies
      without hiding an overshooting dish.
- [x] 4.3 Add a local explanation-cue builder that emits a policy cue only when
      its underlying fact is present; preserve existing reason tags.
- [x] 4.4 Add quick explanation coverage based on the known effort estimate.
- [x] 4.5 Add selected-intent explanation coverage without health or outcome
      wording.
- [x] 4.6 Test no portion is presented when its calculation is unavailable and
      no explanation claims unknown nutrition as fact.
- [x] 4.7 Update suggestion-card presentation using shared components and theme
      tokens only.

## 5. Service, prompt, and cache integration

- [x] 5.1 Resolve the tonight preference in `suggestionService` after profile
      loading and pass it through generation, selection, and cache access.
- [x] 5.2 Ensure stretch and macro-gap requests carry no template context and
      retain their current cache keys and outcomes.
- [x] 5.3 Add short, typed base-intent and prep-speed framing to
      `suggestPrompt.ts` for tonight only; never interpolate editable UI copy.
- [x] 5.4 Preserve provider prompt rules for dietary restrictions, use-first,
      calorie non-filtering, canonical ids, and unknown macro coverage.
- [x] 5.5 Add cache fingerprints and persistence tests proving exact preference
      reuse and regeneration for either changed dimension.
- [x] 5.6 Add service tests that cached pools reselect safely when dietary rules
      change under every preference.
- [x] 5.7 Add service tests that macro-gap and stretch do not receive template
      prompt context or cache identity.
- [x] 5.8 Document and test the cache-clearing migration path rather than
      assigning an old generic cache row a false preference identity.

## 6. Tonight surface

- [x] 6.1 Keep the existing tonight/stretch segmentation and add a compact
      preference summary plus secondary “Tune dinner” affordance for tonight.
- [x] 6.2 Build an accessible tuning sheet with base-intent cards, standard and
      quick prep-speed controls, descriptions, active states, and a visible
      “Use recommended” reset.
- [x] 6.3 Load the resolved preference before a tonight request and reload
      through the cache-aware service after a selection or reset.
- [x] 6.4 Keep the profile untouched during selection; assert profile calories,
      goal, and macro targets are byte-identical after every choice.
- [x] 6.5 Do not render tuning controls in stretch or macro-gap flows.
- [x] 6.6 Present portion and factual explanation cues without displacing stock,
      dietary, cache-origin, or macro-gap information.
- [x] 6.7 Use `src/components` and `src/constants/theme.ts`; add no local
      colour, font, or spacing literals.

## 7. Language and safety audit

- [x] 7.1 Audit labels, descriptions, accessibility labels, and cues for
      outcome or medical claims; keep them about suggestion behaviour.
- [x] 7.2 Add a forbidden-language test covering all policy-owned strings.
- [x] 7.3 Verify each base intent and prep speed preserves the use-first
      constraint, dietary exclusion, and calorie non-filter rule.
- [x] 7.4 Verify nullable catalogue and provider nutrition remains explicit in
      display, ranking, and cooked-meal persistence.
- [x] 7.5 Add owner-app checks for reset-to-recommended, quick + base-intent
      composition, cache distinction, and the absence of controls from
      macro-gap and stretch.

## 8. Verification and tuning

- [x] 8.1 Add fixture pools covering each base intent, both prep speeds,
      unknown nutrition, dietary conflicts, use-first conflicts, and varied
      cuisines.
- [x] 8.2 Assert each base intent produces a meaningful but deterministic
      selection difference on its fixture while preserving variety.
- [x] 8.3 Assert quick returns lower average `effortMinutes` than standard on
      the same fixture without removing eligible dishes.
- [x] 8.4 Assert use-it-up ranks more value at risk than balanced on its fixture.
- [x] 8.5 Assert explicit preferences survive restart, profile changes do not
      overwrite them, and reset adopts the new profile recommendation.
- [x] 8.6 Run `npm run typecheck`, `npm test`, `openspec validate
      add-suggestion-templates --strict`, and `git diff --check`.
- [x] 8.7 Record offline fixture findings separately from real-provider/device
      acceptance; do not mark provider behaviour accepted without configured
      provider runs.
