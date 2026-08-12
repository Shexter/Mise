## 1. Find out what a share sheet actually delivers

Ordered first because the whole intake is designed around it and none of it is
knowable from documentation.

- [ ] 1.1 Register a throwaway share target and record, per platform and per OS,
      exactly what arrives when a user shares a post: URL alone, URL plus title,
      URL plus full caption, or something else. Cover YouTube, Instagram, and
      TikTok on both iOS and Android.
- [ ] 1.2 Record how often the caption contains a usable ingredient list. If it
      is rare, the screenshot route is the primary path and the tasks should be
      ordered accordingly.
- [ ] 1.3 **Do not build on an assumption here.** The design already degrades to
      "we saved the link, now paste or screenshot the ingredients"; confirm that
      is the common case or the exception before optimising either.
- [ ] 1.4 Collect at least 20 real captions as fixtures, including CJK ones —
      decision 4's audience is exactly who saves these — plus ones that are
      mostly emoji and hashtags, and ones with quantities written in prose.

## 2. Schema

- [x] 2.1 Append the migration creating `recipes` and `recipe_ingredients`, with
      the source link on the recipe and a nullable `canonical_id` and nullable
      quantity on the ingredient.
- [x] 2.2 Add `Recipe` and `RecipeIngredient` to `src/types.ts` with their
      `readonly` value arrays.
- [x] 2.3 Extend `DROP_ALL`, and extend the delete-all path to remove stored
      recipe images alongside meal photos and receipt images.
- [x] 2.4 Verify the migration runs from the current head and `npm run typecheck`
      passes.

## 3. Intake

- [ ] 3.1 Register the app as a share target for URLs, text, and images in the
      Expo config.
- [ ] 3.2 Build one intake that accepts all three and works out which it has. Do
      not ask the user to choose — decision 92's argument applies again.
- [ ] 3.3 Save a bare link with no usable content as a recipe awaiting content,
      and offer paste or screenshot. This is the degraded path and it must be
      pleasant, not an error.
- [ ] 3.4 Route the screenshot case through `add-unified-capture`'s image path
      where it has landed, rather than building a second image pipeline.
- [ ] 3.5 **Make no request to any platform.** No scraping, no API call, no
      oEmbed, no media download. Add a test asserting no request is made to a
      platform host when a link is saved.

## 4. Extraction

- [x] 4.1 Write `src/api/recipePrompt.ts` following `src/api/receiptPrompt.ts`:
      raw JSON only, explicit schema, title, ingredients with quantity and unit,
      steps.
- [x] 4.2 Implement `src/api/recipe.ts` through the existing provider facade and
      `src/api/errors.ts`. One call. Do not touch `keyStore.ts`.
- [x] 4.3 **Record no quantity where none is stated.** "A splash of sesame oil"
      has no number, and inventing one is decision 15's mistake at the point of
      storage.
- [x] 4.4 Report content containing no recipe rather than inventing one from it.
- [x] 4.5 Parse defensively; a malformed response is an error, not a crash.
- [ ] 4.6 Unit-test against the 1.4 fixtures, including a caption that is mostly
      hashtags and one in CJK.

## 5. Resolution and coverage

Pure logic. No network.

- [x] 5.1 Resolve ingredients through the existing `resolve()`. Do not add a
      recipe-specific matching path.
- [x] 5.2 Surface uncertain matches for confirmation and learn the answer through
      the existing user-resolution path.
- [x] 5.3 Retain an unresolvable ingredient as text and keep the recipe usable —
      the same discipline `add-dietary-profile` applies to an unresolvable rule.
- [x] 5.4 Implement coverage in `src/logic/recipe.ts`: which resolved ingredients
      are in stock and which are not, computed against current stock at view
      time rather than stored.
- [x] 5.5 **Never report an unresolved ingredient as held.** Not knowing what it
      is means not knowing whether you have it.
- [x] 5.6 Unit-test coverage including the unresolved case and an empty pantry.

## 6. Cooking it

- [x] 6.1 Reuse `suggestionService`'s meal construction rather than writing a
      second one. Same shape, same `MealItem.canonicalId`, same depletion against
      stated quantities.
- [x] 6.2 Hardcode `venue: 'home'` and run no inference — decision 148. Record no
      learned per-dish default from it.
- [x] 6.3 Skip ingredients with no stated quantity when depleting rather than
      guessing one, and say so.
- [x] 6.4 Test that cooking a saved recipe decrements the same way cooking a
      suggestion does.

## 7. Attribution

- [x] 7.1 Store the source link with every recipe and display it wherever the
      recipe appears.
- [x] 7.2 Retain it through edits.
- [x] 7.3 Distinguish a recipe with no source from one that has one.
- [x] 7.4 **The app is never the place someone would go instead of the video.**
      Review the recipe screen against that sentence — the link is a primary
      action, not a footnote.

## 8. Surfaces

- [x] 8.1 Build the saved-recipes list and the recipe detail screen.
- [x] 8.2 Allow editing ingredients and quantities, and learn corrections.
- [x] 8.3 Show coverage prominently — what you have and what you are missing is
      the question the user actually has.
- [x] 8.4 Do not build search, tags, folders, or sharing. Each is reasonable and
      none is this change.
- [x] 8.5 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.

## 9. Verification

- [ ] 9.1 Share a real cooking video from each of the three platforms and confirm
      a recipe is saved with its link.
- [ ] 9.2 Share one whose caption has a full ingredient list and confirm
      extraction works end to end.
- [ ] 9.3 Share one with no usable caption and confirm the degraded path is
      pleasant rather than an error.
- [ ] 9.4 Screenshot an on-screen ingredient list and confirm it extracts.
- [ ] 9.5 Confirm coverage against a real pantry, then buy a missing ingredient
      and confirm it updates.
- [ ] 9.6 Cook a saved recipe and confirm the meal is logged and stock moved.
- [ ] 9.7 Confirm with the network disabled that saving a link still works and
      extraction is deferred.
- [ ] 9.8 Confirm *Delete all data* removes recipes and any stored images.
- [ ] 9.9 Run `npm run typecheck` and `npm test`, then record what each
      platform's share sheet delivers in `docs/product-decisions.md`.
